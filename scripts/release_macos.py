"""Mac上でのビルド、Sparkle更新ファイルの生成、GitHub公開をまとめる。"""
import argparse
import base64
import hashlib
from importlib import metadata
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / 'scripts/release-macos.json'
SPARKLE_NS = 'http://www.andymatuschak.org/xml-namespaces/sparkle'


def run(args, *, capture=False, cwd=ROOT):
    result = subprocess.run([str(arg) for arg in args], cwd=cwd, check=True,
                            text=True, stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else None


def load_config():
    config = json.loads(CONFIG_PATH.read_text())
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', config['repository']):
        raise ValueError('公開先リポジトリの形式が不正です。')
    if len(base64.b64decode(config['public_key'], validate=True)) != 32:
        raise ValueError('Sparkleの公開鍵が不正です。')
    return config


def version():
    value = json.loads((ROOT / 'package.json').read_text())['version']
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value):
        raise ValueError('バージョンは MAJOR.MINOR.PATCH で指定してください。')
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    if lock['version'] != value or lock['packages']['']['version'] != value:
        raise ValueError('package-lock.jsonとアプリのバージョンが一致していません。')
    return value


def digest(path):
    with Path(path).open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def sparkle_directory(config):
    return ROOT / '.cache/sparkle' / config['sparkle_version']


def ensure_sparkle(config):
    cache = ROOT / '.cache/sparkle'
    cache.mkdir(parents=True, exist_ok=True)
    name = f"Sparkle-{config['sparkle_version']}.tar.xz"
    archive = cache / name
    if not archive.exists():
        with tempfile.TemporaryDirectory(dir=cache) as temporary:
            download = Path(temporary) / name
            run(['/usr/bin/curl', '--fail', '--location', '--proto', '=https', '--output', download,
                 f"https://github.com/sparkle-project/Sparkle/releases/download/{config['sparkle_version']}/{name}"])
            if digest(download) != config['sparkle_sha256']:
                raise ValueError('Sparkleのチェックサムが一致しません。')
            download.replace(archive)
    if digest(archive) != config['sparkle_sha256']:
        raise ValueError('保存済みSparkleのチェックサムが一致しません。')
    destination = sparkle_directory(config)
    marker = destination / '.verified-sha256'
    if not marker.exists() or marker.read_text() != config['sparkle_sha256']:
        # 既存の展開先は使わず、検証済みアーカイブから全体を展開し直す。
        with tempfile.TemporaryDirectory(dir=cache) as temporary:
            with tarfile.open(archive) as source:
                source.extractall(temporary, filter='data')
            if destination.exists():
                shutil.rmtree(destination)
            shutil.move(temporary, destination)
        marker.write_text(config['sparkle_sha256'])
    return destination


def public_key(config):
    return run([sparkle_directory(config) / 'bin/generate_keys', '--account',
                config['keychain_account'], '-p'], capture=True)


def check_key(config):
    if public_key(config) != config['public_key']:
        raise ValueError('キーチェーンの署名鍵と設定の公開鍵が一致しません。鍵を作り直さず確認してください。')


def bundle_settings(config):
    return {
        'CFBundleVersion': version(),
        'LSMinimumSystemVersion': config['minimum_macos'],
        'SUFeedURL': f"https://github.com/{config['repository']}/releases/latest/download/appcast.xml",
        'SUPublicEDKey': config['public_key'],
        'SUEnableAutomaticChecks': False,
        'SUAutomaticallyUpdate': False,
        'SUAllowsAutomaticUpdates': False,
        'SUEnableSystemProfiling': False,
        'SUShowReleaseNotes': False,
        'SUVerifyUpdateBeforeExtraction': True,
    }


def embed_sparkle(bundle, config):
    source = sparkle_directory(config) / 'Sparkle.framework'
    if not source.is_dir():
        raise ValueError('先に npm run setup:release:mac を実行してください。')
    destination = Path(bundle) / 'Contents/Frameworks/Sparkle.framework'
    # PyInstallerによるバイナリ書き換えを避け、ヘルパーと署名をそのまま保持する。
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination, symlinks=True)
    run(['/usr/bin/codesign', '--force', '--sign', '-', bundle])


def validate_bundle(bundle, config):
    with (bundle / 'Contents/Info.plist').open('rb') as source:
        info = plistlib.load(source)
    expected = bundle_settings(config) | {'CFBundleIdentifier': config['bundle_id']}
    if any(info.get(key) != value for key, value in expected.items()):
        raise ValueError('アプリ内の更新設定またはバージョンが一致しません。')
    executable = bundle / 'Contents/MacOS' / info['CFBundleExecutable']
    if run(['/usr/bin/lipo', '-archs', executable], capture=True) != config['architecture']:
        raise ValueError('アプリのCPU形式が設定と一致しません。')
    run(['/usr/bin/codesign', '--verify', '--deep', '--strict', bundle])
    validate_minimum_macos(bundle, config['minimum_macos'])
    with (bundle / 'Contents/Frameworks/Sparkle.framework/Resources/Info.plist').open('rb') as source:
        if plistlib.load(source)['CFBundleShortVersionString'] != config['sparkle_version']:
            raise ValueError('同梱Sparkleのバージョンが一致しません。')


def validate_minimum_macos(bundle, configured):
    # Pythonや拡張モジュールが要求するOSより古いMacへ更新を案内しない。
    binaries = set()
    for path in bundle.rglob('*'):
        if path.is_file():
            with path.open('rb') as source:
                if source.read(4) in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf',
                                      b'\xca\xfe\xba\xbe', b'\xca\xfe\xba\xbf'):
                    binaries.add(path.resolve())
    if not binaries:
        raise ValueError('アプリ内の実行ファイルを検証できません。')
    commands = run(['/usr/bin/otool', '-l', *sorted(binaries)], capture=True)
    requirements = re.findall(r'\bminos\s+(\d+(?:\.\d+){0,2})', commands)
    requirements += re.findall(r'cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version (\d+(?:\.\d+){0,2})', commands)
    number = lambda value: tuple((list(map(int, value.split('.'))) + [0, 0])[:3])
    if not requirements or max(map(number, requirements)) > number(configured):
        raise ValueError('同梱ライブラリの必要OSが設定より新しくなっています。minimum_macosを確認してください。')


def validate_appcast(path, archive, config, app_version):
    items = ET.parse(path).getroot().findall('./channel/item')
    if len(items) != 1:
        raise ValueError('更新情報は今回のバージョン1件だけにしてください。')
    item = items[0]
    enclosure = item.find('enclosure')
    ns = '{' + SPARKLE_NS + '}'
    expected_url = f"https://github.com/{config['repository']}/releases/download/v{app_version}/{archive.name}"
    if item.findtext(ns + 'version') != app_version:
        raise ValueError('更新情報のバージョンが一致しません。')
    if enclosure is None or enclosure.get('url') != expected_url:
        raise ValueError('更新ファイルのURLが一致しません。')
    if enclosure.get('length') != str(archive.stat().st_size):
        raise ValueError('更新ファイルのサイズが一致しません。')
    if item.findtext(ns + 'hardwareRequirements') != 'arm64':
        raise ValueError('Apple Silicon用の更新条件がありません。')
    if item.findtext(ns + 'minimumSystemVersion') != config['minimum_macos']:
        raise ValueError('macOSの更新条件が一致しません。')
    signature = enclosure.get(ns + 'edSignature', '')
    if len(base64.b64decode(signature, validate=True)) != 64:
        raise ValueError('更新署名が不正です。')
    run([sparkle_directory(config) / 'bin/sign_update', '--account', config['keychain_account'],
         '--verify', archive, signature])


def verify_source_commit(commit, *, clean=False):
    if run(['git', 'rev-parse', 'HEAD'], capture=True) != commit:
        raise ValueError('生成開始時からコミットが変わっています。新しい配布物を生成してください。')
    if clean and run(['git', 'status', '--porcelain', '--untracked-files=normal'], capture=True):
        raise ValueError('生成開始後にソースが変更されています。変更をコミットして配布物を生成し直してください。')


def build_release(config, commit=None):
    if os.environ.get('CHRONOLOFT_UPDATER_TEST_ROOT'):
        raise ValueError('テスト用ビルドの環境変数を解除してから配布物を生成してください。')
    commit = commit or run(['git', 'rev-parse', 'HEAD'], capture=True)
    verify_source_commit(commit)
    run(['npm', 'test'])
    ensure_sparkle(config)
    check_key(config)
    run(['npm', 'run', 'build'])
    bundle = ROOT / 'dist/Chronoloft.app'
    validate_bundle(bundle, config)
    app_version = version()
    output = ROOT / 'dist/releases' / app_version
    output.parent.mkdir(parents=True, exist_ok=True)
    # 再生成に失敗しても、前回の配布物は最後まで残す。
    with tempfile.TemporaryDirectory(dir=output.parent, prefix='prepare-') as temporary:
        staging = Path(temporary) / 'release'
        staging.mkdir()
        archive = staging / f'Chronoloft-{app_version}-macos-arm64.zip'
        run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', bundle, archive])
        run([sparkle_directory(config) / 'bin/generate_appcast', '--account', config['keychain_account'],
             '--maximum-deltas', '0', '--maximum-versions', '1', '--download-url-prefix',
             f"https://github.com/{config['repository']}/releases/download/v{app_version}/", staging])
        validate_appcast(staging / 'appcast.xml', archive, config, app_version)
        verify_source_commit(commit)
        manifest = {'version': app_version, 'commit': commit,
                    'config_sha256': digest(CONFIG_PATH), 'files': {
                        path.name: digest(path) for path in [archive, staging / 'appcast.xml']}}
        (staging / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        previous = Path(temporary) / 'previous'
        if output.exists():
            output.rename(previous)
        try:
            staging.rename(output)
        except OSError:
            if previous.exists():
                previous.rename(output)
            raise
    return output


def load_release(output, config):
    manifest = json.loads((output / 'manifest.json').read_text())
    if manifest['version'] != version() or manifest['config_sha256'] != digest(CONFIG_PATH):
        raise ValueError('生成時からバージョンまたは設定が変わっています。')
    verify_source_commit(manifest['commit'])
    expected_names = {f'Chronoloft-{version()}-macos-arm64.zip', 'appcast.xml'}
    if set(manifest['files']) != expected_names:
        raise ValueError('配布ファイルの一覧が不正です。')
    if any(digest(output / name) != checksum for name, checksum in manifest['files'].items()):
        raise ValueError('生成済みの配布物が変更されています。')
    validate_appcast(output / 'appcast.xml', output / f'Chronoloft-{version()}-macos-arm64.zip', config, version())
    return manifest


def github(config, *args):
    suffix = [] if args[0] == 'api' else ['--repo', config['repository']]
    return run(['gh', *args, *suffix], capture=True)


def remote_release(config, tag):
    # 通信エラーを「リリースがない」と取り違えないよう、一覧取得の失敗はそのまま停止する。
    releases = json.loads(github(config, 'api', '--paginate', '--slurp',
                                f"repos/{config['repository']}/releases?per_page=100"))
    return next((release for page in releases for release in page if release['tag_name'] == tag), None)


def preflight(config, *, publishing, resume=False):
    if sys.platform != 'darwin' or platform.machine() != config['architecture']:
        raise ValueError('この公開処理はApple SiliconのMacで実行してください。')
    version()
    if not publishing:
        return
    run(['gh', 'auth', 'status'], capture=True)
    if run(['git', 'status', '--porcelain', '--untracked-files=normal'], capture=True):
        raise ValueError('変更をコミット・プッシュしてから公開してください。試作確認には --dry-run を使えます。')
    commit = run(['git', 'rev-parse', 'HEAD'], capture=True)
    # HEADがGitHubに存在することと、設定した公開先へのコミットであることを確認する。
    remote_commit = json.loads(github(config, 'api', f"repos/{config['repository']}/commits/{commit}"))
    if remote_commit['sha'] != commit:
        raise ValueError('ビルド対象のコミットをGitHubで確認できません。')
    existing = remote_release(config, 'v' + version())
    if existing and (not existing['draft'] or not resume):
        raise ValueError('同じバージョンのリリースが既にあります。下書きの再開には --resume を使ってください。')
    latest = json.loads(github(config, 'api', '--paginate', '--slurp',
                              f"repos/{config['repository']}/releases?per_page=100"))
    numbers = [tuple(map(int, release['tag_name'][1:].split('.'))) for page in latest for release in page
               if not release['draft'] and not release['prerelease']
               and re.fullmatch(r'v\d+\.\d+\.\d+', release['tag_name'])]
    if numbers and tuple(map(int, version().split('.'))) <= max(numbers):
        raise ValueError('公開済みのバージョンより大きい番号にしてください。')
    verify_source_commit(commit, clean=True)
    return commit


def check_build_dependencies():
    if sys.version_info[:2] != (3, 13):
        raise ValueError('ビルドにはPython 3.13の backend/venv を使ってください。')
    for line in (ROOT / 'scripts/requirements-build.txt').read_text().splitlines():
        name, expected = line.split(';')[0].strip().split('==')
        try:
            actual = metadata.version(name)
        except metadata.PackageNotFoundError:
            actual = '未導入'
        if actual != expected:
            raise ValueError(f'{name} は {expected} が必要です（現在: {actual}）。'
                             'scripts/requirements-build.txt の依存関係をインストールしてください。')


def publish(output, config, manifest):
    verify_source_commit(manifest['commit'], clean=True)
    tag = 'v' + manifest['version']
    refs = json.loads(github(config, 'api',
                            f"repos/{config['repository']}/git/matching-refs/tags/{tag}"))
    if not any(ref['ref'] == 'refs/tags/' + tag for ref in refs):
        github(config, 'api', f"repos/{config['repository']}/git/refs", '--method', 'POST',
               '-f', 'ref=refs/tags/' + tag, '-f', 'sha=' + manifest['commit'])
    tag_commit = json.loads(github(config, 'api', f"repos/{config['repository']}/commits/{tag}"))
    if tag_commit['sha'] != manifest['commit']:
        raise ValueError('リリースタグがビルドしたコミットと一致しません。')
    release = remote_release(config, tag)
    if release is None:
        notes = output / 'release-notes.md'
        notes.write_text(f"Chronoloft {manifest['version']}\n\nアプリ内更新用の配布ファイルです。\n"
                         f"\n対象コミット: {manifest['commit']}\n", encoding='utf-8')
        github(config, 'release', 'create', tag, '--draft', '--target', manifest['commit'],
               '--title', f"Chronoloft {manifest['version']}", '--notes-file', notes, '--generate-notes')
        release = remote_release(config, tag)
    if not release or not release['draft'] or release['target_commitish'] != manifest['commit']:
        raise ValueError('再開対象の下書きとビルドしたコミットが一致しません。')
    github(config, 'release', 'upload', tag, *[output / name for name in manifest['files']], '--clobber')
    # 下書きの添付ファイルをダウンロードし、手元と同じバイト列であることを確かめる。
    with tempfile.TemporaryDirectory() as temporary:
        github(config, 'release', 'download', tag, '--dir', temporary,
               '--pattern', '*.zip', '--pattern', 'appcast.xml')
        if any(digest(Path(temporary) / name) != checksum for name, checksum in manifest['files'].items()):
            raise ValueError('アップロード後のファイルが一致しません。下書きのまま停止します。')
    # アップロード中のコミット変更も、下書きを公開する前に検出する。
    verify_source_commit(manifest['commit'], clean=True)
    github(config, 'release', 'edit', tag, '--draft=false', '--latest')
    print(f"公開しました: https://github.com/{config['repository']}/releases/tag/{tag}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--setup', action='store_true', help='Sparkleとキーチェーンの署名鍵を準備する')
    parser.add_argument('--dry-run', action='store_true', help='GitHubを変更せず更新ファイルまで作る')
    parser.add_argument('--resume', action='store_true', help='検証済みの配布物で下書きの公開を再開する')
    args = parser.parse_args()
    if args.setup and (args.resume or args.dry_run):
        parser.error('--setup は他のオプションと同時に指定できません。')
    config = load_config()
    commit = preflight(config, publishing=not (args.dry_run or args.setup), resume=args.resume)
    if args.setup:
        check_build_dependencies()
        ensure_sparkle(config)
        run([sparkle_directory(config) / 'bin/generate_keys', '--account', config['keychain_account']])
        check_key(config)
        print('準備できました。秘密鍵はキーチェーンに保存されています。バックアップも保管してください。')
        return
    if args.resume:
        ensure_sparkle(config)
        check_key(config)
        output = ROOT / 'dist/releases' / version()
    else:
        check_build_dependencies()
        output = build_release(config, commit=commit)
    manifest = load_release(output, config)
    if args.dry_run:
        print(f'公開せずに検証しました: {output}')
    else:
        # ビルド中にソースが変更された場合も、公開直前に検出する。
        preflight(config, publishing=True, resume=args.resume)
        publish(output, config, manifest)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, ET.ParseError) as error:
        print(f'公開処理を停止しました: {error}', file=sys.stderr)
        sys.exit(1)
