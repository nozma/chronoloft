"""隔離した.appとDBで、Sparkleの更新から再起動まで確認する。GitHubは変更しない。"""
import argparse
from functools import partial
import http.server
import json
import os
from pathlib import Path
import plistlib
import secrets
import shutil
import subprocess
import sys
import threading
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from release_macos import ROOT, SPARKLE_NS, ensure_sparkle, load_config, run, sparkle_directory, version


def wait_for(action, timeout=40):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            result = action()
            if result:
                return result
        except (OSError, URLError, ValueError, KeyError) as error:
            last_error = error
        time.sleep(0.3)
    raise RuntimeError(f'テストの待機時間を超えました: {last_error}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-build', action='store_true')
    parser.add_argument('--tamper', action='store_true', help='署名後にZIPを改変し、更新が拒否されることを確認する')
    args = parser.parse_args()
    config = load_config()
    app_version = version()
    ensure_sparkle(config)
    root = ROOT / 'build/updater-test'
    root.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
                                            partial(http.server.SimpleHTTPRequestHandler, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    feed = f'http://127.0.0.1:{server.server_port}/appcast.xml'
    settings = {'feed_url': feed, 'secret': secrets.token_urlsafe(24)}
    (root / 'settings.json').write_text(json.dumps(settings))
    if not args.no_build:
        environment = os.environ | {'CHRONOLOFT_UPDATER_TEST_ROOT': str(root)}
        subprocess.run([sys.executable, '-m', 'PyInstaller', 'Chronoloft.spec', '-y',
                        '--distpath', root / 'output', '--workpath', root / 'work'],
                       cwd=ROOT, env=environment, check=True)
    source = root / 'output/Chronoloft Update Test.app'
    installed = root / 'installed/Chronoloft Update Test.app'
    new_bundle = root / 'new/Chronoloft Update Test.app'
    for path, bundle_version in [(installed, '1.1.99'), (new_bundle, app_version)]:
        if path.exists():
            shutil.rmtree(path)
        path.parent.mkdir(exist_ok=True)
        shutil.copytree(source, path, symlinks=True)
        info_path = path / 'Contents/Info.plist'
        with info_path.open('rb') as file:
            info = plistlib.load(file)
        info.update(CFBundleVersion=bundle_version, CFBundleShortVersionString=bundle_version, SUFeedURL=feed)
        with info_path.open('wb') as file:
            plistlib.dump(info, file)
        run(['/usr/bin/codesign', '--force', '--sign', '-', path])
    archive = root / 'update.zip'
    if archive.exists():
        archive.unlink()
    run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', new_bundle, archive])
    signature = run([sparkle_directory(config) / 'bin/sign_update', '--account',
                     config['keychain_account'], '-p', archive], capture=True)
    if args.tamper:
        with archive.open('ab') as file:
            file.write(b'tampered')
    ET.register_namespace('sparkle', SPARKLE_NS)
    rss = ET.Element('rss', {'version': '2.0'})
    item = ET.SubElement(ET.SubElement(rss, 'channel'), 'item')
    ET.SubElement(item, '{' + SPARKLE_NS + '}version').text = app_version
    ET.SubElement(item, 'enclosure', {'url': feed.rsplit('/', 1)[0] + '/update.zip',
                                   'length': str(archive.stat().st_size), 'type': 'application/octet-stream',
                                   '{' + SPARKLE_NS + '}edSignature': signature})
    ET.ElementTree(rss).write(root / 'appcast.xml', encoding='utf-8', xml_declaration=True)
    process_file = root / 'process.json'
    if process_file.exists():
        process_file.unlink()
    log = (root / 'app.log').open('w')
    process = subprocess.Popen([installed / 'Contents/MacOS/Chronoloft'], stdout=log, stderr=log)

    def request(command='status', post=False):
        address = json.loads(process_file.read_text())['url']
        with urlopen(Request(address + '/' + command, method='POST' if post else 'GET'), timeout=3) as response:
            return json.load(response)

    signature_checks = []

    def verify_signature(stage):
        run(['/usr/bin/codesign', '--verify', '--deep', '--strict', installed])
        signature_checks.append(stage)

    def stopped():
        try:
            request()
        except (OSError, URLError, ValueError):
            return True
        return False

    try:
        wait_for(lambda: request().get('sparkle'))
        verify_signature('initial_launch')
        request('test-termination-guard', True)
        guard = wait_for(lambda: request().get('termination_guard'))
        expected_checks = {'installing', 'blocked', 'intent_retained', 'retry_blocked', 'requests_reopened',
                           'idle_allowed', 'new_requests_blocked', 'abort_cleared', 'normal_quit_allowed'}
        assert set(guard) == expected_checks and all(guard.values()), guard
        (root / 'termination-guard-result.json').write_text(json.dumps(guard, indent=2))
        request('close', True)
        assert request()['version'] == '1.1.99'
        request('check', True)
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            try:
                status = request()
                if args.tamper and status.get('error'):
                    assert status['version'] == '1.1.99'
                    assert status['error_code'] in (3002, 4005), status['error']
                    assert 'EdDSA signature does not match' in status['error'], status['error']
                    verify_signature('rejected_update')
                    status['signature_checks'] = signature_checks
                    print('改変されたZIPが署名検証で拒否され、旧版のまま動作することを確認しました。')
                    (root / 'tamper-result.json').write_text(json.dumps(status, ensure_ascii=False, indent=2))
                    return
                if status.get('error'):
                    raise RuntimeError(status['error'])
                if status['version'] == app_version:
                    assert not args.tamper, '改変されたZIPが適用されてしまいました。'
                    if not status['sparkle']:
                        time.sleep(0.3)
                        continue
                    assert status['value'] == '更新前の記録'
                    request('reopen', True)
                    verify_signature('after_update')
                    # 更新完了後も一度終了して起動し直し、通常起動による署名の破損を検出する。
                    request('quit', True)
                    wait_for(stopped)
                    process_file.unlink()
                    process = subprocess.Popen([installed / 'Contents/MacOS/Chronoloft'], stdout=log, stderr=log)
                    wait_for(lambda: request().get('sparkle'))
                    status = request()
                    assert status['version'] == app_version and status['value'] == '更新前の記録'
                    verify_signature('cold_restart')
                    status['signature_checks'] = signature_checks
                    print('更新・再起動・記録の保持・閉じた画面の再表示と、起動後の署名保持を確認しました。')
                    (root / 'result.json').write_text(json.dumps(status, ensure_ascii=False, indent=2))
                    return
                request('install', True)
            except (OSError, URLError, ValueError):
                pass
            time.sleep(0.5)
        raise RuntimeError(f'更新が完了しませんでした。{root / "app.log"} と buttons.json を確認してください。')
    finally:
        try:
            request('quit', True)
        except (OSError, ValueError, URLError):
            if process.poll() is None:
                process.terminate()
        server.shutdown()
        log.close()


if __name__ == '__main__':
    main()
