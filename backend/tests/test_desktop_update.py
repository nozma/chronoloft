import json
from pathlib import Path
import sys
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import uuid
import xml.etree.ElementTree as ET

from test_backend import DatabaseTestCase

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts import release_macos as release
from backend.desktop_updater import allow_update_termination, cancel_update_termination, check_for_updates


class DesktopUpdateGateTests(DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.gate = self.app.extensions['desktop_update_gate']
        self.device_id = str(uuid.uuid4())
        self.client.put('/api/stopwatch-devices/' + self.device_id, json={'name': 'テスト端末'})

    def start(self):
        return self.client.post('/api/stopwatches', json={
            'id': str(uuid.uuid4()), 'device_id': self.device_id,
            'activity_id': self.activity_id, 'discord_enabled': False})

    def test_running_and_confirming_sessions_delay_update(self):
        item = self.start().json['item']
        self.assertTrue(self.gate.busy())
        self.assertFalse(self.gate.prepare())
        response = self.client.post(f"/api/stopwatches/{item['id']}/confirm", json={'revision': item['revision']})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.gate.prepare())

    def test_update_blocks_new_sessions_until_canceled(self):
        self.assertTrue(self.gate.prepare())
        self.assertEqual(self.start().status_code, 503)
        self.assertEqual(self.client.get('/api/stopwatches').status_code, 200)
        self.gate.cancel()
        self.assertEqual(self.start().status_code, 201)

    def test_lan_session_also_delays_update(self):
        self.client.put('/api/lan/settings', json={'enabled': True, 'password': 'test-password'})
        options = dict(base_url='http://192.168.1.10:5180',
                       environ_overrides={'REMOTE_ADDR': '192.168.1.20'}, headers={'X-Chronoloft': '1'})
        remote = self.app.test_client()
        remote.post('/api/auth/login', json={'password': 'test-password'}, **options)
        device_id = str(uuid.uuid4())
        remote.put('/api/stopwatch-devices/' + device_id, json={'name': 'スマートフォン'}, **options)
        result = remote.post('/api/stopwatches', json={
            'id': str(uuid.uuid4()), 'device_id': device_id,
            'activity_id': self.activity_id, 'discord_enabled': False}, **options)
        self.assertEqual(result.status_code, 201)
        self.assertFalse(self.gate.prepare())

    def test_update_waits_for_inflight_start_to_finish(self):
        started, finished = threading.Event(), threading.Event()
        results = []

        def prepare():
            started.set()
            results.append(self.gate.prepare())
            finished.set()

        with self.gate.lock:
            thread = threading.Thread(target=prepare)
            thread.start()
            self.assertTrue(started.wait(2))
            self.assertFalse(finished.wait(0.05))
            self.assertEqual(self.start().status_code, 201)
        self.assertTrue(finished.wait(2))
        thread.join()
        self.assertEqual(results, [False])


class DesktopTerminationTests(unittest.TestCase):
    def test_menubar_update_uses_the_installed_controller(self):
        controller = Mock()
        window = SimpleNamespace(_sparkle=(controller, None))
        check_for_updates(window)
        controller.checkForUpdates_.assert_called_once_with(None)
        check_for_updates(SimpleNamespace())

    def test_canceled_update_checks_again_on_retry(self):
        state = Mock()
        state.prepare.side_effect = [False, False, True]
        app = SimpleNamespace(extensions={'desktop_update_gate': state})
        delegate = SimpleNamespace(installing=True)
        window = SimpleNamespace(_sparkle=(None, delegate))
        self.assertFalse(allow_update_termination(window, lambda: app))
        cancel_update_termination(window, lambda: app)
        self.assertTrue(delegate.installing)
        self.assertFalse(allow_update_termination(window, lambda: app))
        self.assertTrue(allow_update_termination(window, lambda: app))
        self.assertEqual(state.prepare.call_count, 3)
        state.cancel.assert_called_once_with()

    def test_normal_quit_does_not_prepare_an_update(self):
        provider = Mock()
        for window in (SimpleNamespace(), SimpleNamespace(_sparkle=(None, SimpleNamespace(installing=False)))):
            self.assertTrue(allow_update_termination(window, provider))
        provider.assert_not_called()

    def test_update_cannot_terminate_before_backend_is_ready(self):
        window = SimpleNamespace(_sparkle=(None, SimpleNamespace(installing=True)))
        self.assertFalse(allow_update_termination(window, lambda: None))


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.config = release.load_config()

    def test_dry_run_does_not_access_github_or_publish(self):
        with patch.object(sys, 'argv', ['release_macos.py', '--dry-run']), \
                patch.object(release, 'preflight') as preflight, \
                patch.object(release, 'build_release', return_value=Path('/tmp/test-release')), \
                patch.object(release, 'load_release', return_value={}), \
                patch.object(release, 'github') as github, patch.object(release, 'publish') as publish, \
                patch('builtins.print'):
            release.main()
            preflight.assert_called_once_with(self.config, publishing=False, resume=False)
            github.assert_not_called()
            publish.assert_not_called()

    def test_dry_preflight_needs_no_git_credentials(self):
        with patch.object(release.sys, 'platform', 'darwin'), \
                patch.object(release.platform, 'machine', return_value='arm64'), \
                patch.object(release, 'run') as run:
            release.preflight(self.config, publishing=False)
            run.assert_not_called()

    def test_github_api_does_not_use_unsupported_repo_flag(self):
        with patch.object(release, 'run') as run:
            release.github(self.config, 'api', 'repos/nozma/chronoloft/releases')
            run.assert_called_once_with(['gh', 'api', 'repos/nozma/chronoloft/releases'], capture=True)

    def appcast(self, directory):
        archive = directory / 'Chronoloft-1.2.0-macos-arm64.zip'
        archive.write_bytes(b'zip-test')
        ns = '{' + release.SPARKLE_NS + '}'
        root = ET.Element('rss')
        item = ET.SubElement(ET.SubElement(root, 'channel'), 'item')
        ET.SubElement(item, ns + 'version').text = '1.2.0'
        ET.SubElement(item, ns + 'minimumSystemVersion').text = self.config['minimum_macos']
        ET.SubElement(item, ns + 'hardwareRequirements').text = 'arm64'
        ET.SubElement(item, 'enclosure', {
            'url': 'https://github.com/nozma/chronoloft/releases/download/v1.2.0/' + archive.name,
            'length': str(archive.stat().st_size), ns + 'edSignature': 'AA=='})
        path = directory / 'appcast.xml'
        return path, archive, root

    def test_rejects_wrong_cpu_and_download_url(self):
        with tempfile.TemporaryDirectory() as directory:
            path, archive, root = self.appcast(Path(directory))
            enclosure = root.find('./channel/item/enclosure')
            enclosure.set('url', 'https://example.com/wrong.zip')
            ET.ElementTree(root).write(path)
            with self.assertRaisesRegex(ValueError, 'URL'):
                release.validate_appcast(path, archive, self.config, '1.2.0')
            enclosure.set('url', 'https://github.com/nozma/chronoloft/releases/download/v1.2.0/' + archive.name)
            root.find('./channel/item/{' + release.SPARKLE_NS + '}hardwareRequirements').text = 'x86_64'
            ET.ElementTree(root).write(path)
            with self.assertRaisesRegex(ValueError, 'Apple Silicon'):
                release.validate_appcast(path, archive, self.config, '1.2.0')

    def test_changed_artifact_cannot_be_resumed(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            names = ['Chronoloft-1.2.0-macos-arm64.zip', 'appcast.xml']
            for name in names:
                (output / name).write_bytes(b'original')
            manifest = {'version': '1.2.0', 'config_sha256': release.digest(release.CONFIG_PATH),
                        'commit': 'abc', 'files': {name: release.digest(output / name) for name in names}}
            (output / 'manifest.json').write_text(json.dumps(manifest))
            (output / names[0]).write_bytes(b'changed')
            with patch.object(release, 'version', return_value='1.2.0'), \
                    patch.object(release, 'run', return_value='abc'), self.assertRaisesRegex(ValueError, '配布物が変更'):
                release.load_release(output, self.config)

    def test_build_keeps_starting_commit_and_preserves_previous_output_on_change(self):
        for change_during in (None, 'tests', 'build', 'signing'):
            with self.subTest(change_during=change_during), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                output = root / 'dist/releases/1.2.0'
                output.mkdir(parents=True)
                (output / 'previous.zip').write_bytes(b'previous release')
                current = 'commit-A'

                def run(args, **kwargs):
                    nonlocal current
                    if args == ['git', 'rev-parse', 'HEAD']:
                        return current
                    if (args == ['npm', 'test'] and change_during == 'tests'
                            or args == ['npm', 'run', 'build'] and change_during == 'build'):
                        current = 'commit-B'
                    if args[0] == '/usr/bin/ditto':
                        Path(args[-1]).write_bytes(b'binary built from commit-A')
                    if Path(args[0]).name == 'generate_appcast':
                        (Path(args[-1]) / 'appcast.xml').write_text('<rss/>')
                        if change_during == 'signing':
                            current = 'commit-B'

                with patch.object(release, 'ROOT', root), patch.object(release, 'version', return_value='1.2.0'), \
                        patch.object(release, 'run', side_effect=run), patch.object(release, 'ensure_sparkle'), \
                        patch.object(release, 'check_key'), patch.object(release, 'validate_bundle'), \
                        patch.object(release, 'validate_appcast'):
                    if change_during:
                        with self.assertRaisesRegex(ValueError, 'コミット'):
                            release.build_release(self.config, commit='commit-A')
                        self.assertEqual((output / 'previous.zip').read_bytes(), b'previous release')
                    else:
                        release.build_release(self.config)
                        manifest = json.loads((output / 'manifest.json').read_text())
                        self.assertEqual(manifest['commit'], 'commit-A')

    def test_commit_change_after_preflight_stops_before_build(self):
        with patch.object(release, 'run', return_value='commit-B') as run, \
                self.assertRaisesRegex(ValueError, 'コミット'):
            release.build_release(self.config, commit='commit-A')
        run.assert_called_once_with(['git', 'rev-parse', 'HEAD'], capture=True)

    def test_main_retains_commit_from_first_preflight(self):
        with patch.object(sys, 'argv', ['release_macos.py']), \
                patch.object(release, 'preflight', side_effect=['commit-A', 'commit-B']), \
                patch.object(release, 'check_build_dependencies'), \
                patch.object(release, 'build_release', return_value=Path('/tmp/test-release')) as build, \
                patch.object(release, 'load_release', return_value={'commit': 'commit-A'}), \
                patch.object(release, 'run', return_value='commit-B'), patch.object(release, 'github') as github, \
                self.assertRaisesRegex(ValueError, 'コミット'):
            release.main()
        build.assert_called_once_with(self.config, commit='commit-A')
        github.assert_not_called()

    def test_upload_failure_never_publishes(self):
        calls = []

        def github(config, *args):
            calls.append(args)
            if 'matching-refs' in args[1]:
                return json.dumps([{'ref': 'refs/tags/v1.2.0'}])
            if '/commits/' in args[1]:
                return json.dumps({'sha': 'abc'})
            if args[:2] == ('release', 'upload'):
                raise OSError('通信失敗')
            return ''

        with patch.object(release, 'github', side_effect=github), patch.object(release, 'verify_source_commit'), \
                patch.object(release, 'remote_release', return_value={'draft': True, 'target_commitish': 'abc'}), \
                self.assertRaises(OSError):
            release.publish(Path('/tmp/test-release'), self.config,
                            {'version': '1.2.0', 'commit': 'abc', 'files': {'appcast.xml': 'hash'}})
        self.assertFalse(any(args[:2] == ('release', 'edit') for args in calls))

    def test_tag_for_another_commit_is_never_published(self):
        def github(config, *args):
            if 'matching-refs' in args[1]:
                return json.dumps([{'ref': 'refs/tags/v1.2.0'}])
            return json.dumps({'sha': 'different'})

        with patch.object(release, 'github', side_effect=github), patch.object(release, 'verify_source_commit'), \
                patch.object(release, 'remote_release') as remote, self.assertRaisesRegex(ValueError, 'タグ'):
            release.publish(Path('/tmp/test-release'), self.config,
                            {'version': '1.2.0', 'commit': 'abc', 'files': {}})
        remote.assert_not_called()

    def test_publishes_only_after_uploaded_bytes_match(self):
        for corrupt in (False, True):
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                names = ['Chronoloft-1.2.0-macos-arm64.zip', 'appcast.xml']
                for name in names:
                    (output / name).write_bytes(b'correct')
                manifest = {'version': '1.2.0', 'commit': 'abc',
                            'files': {name: release.digest(output / name) for name in names}}
                calls = []

                def github(config, *args):
                    calls.append(args)
                    if args[0] == 'api':
                        return '[]' if 'matching-refs' in args[1] else json.dumps({'sha': 'abc'})
                    if args[:2] == ('release', 'download'):
                        target = Path(args[args.index('--dir') + 1])
                        for name in names:
                            (target / name).write_bytes(b'wrong' if corrupt else (output / name).read_bytes())
                    return ''

                with patch.object(release, 'github', side_effect=github), patch.object(release, 'verify_source_commit'), \
                        patch.object(release, 'remote_release', side_effect=[
                            None, {'draft': True, 'target_commitish': 'abc'}]), patch('builtins.print'):
                    if corrupt:
                        with self.assertRaisesRegex(ValueError, 'アップロード後'):
                            release.publish(output, self.config, manifest)
                    else:
                        release.publish(output, self.config, manifest)
                edits = [args for args in calls if args[:2] == ('release', 'edit')]
                self.assertEqual(len(edits), 0 if corrupt else 1)
                if not corrupt:
                    self.assertEqual(calls[-1], ('release', 'edit', 'v1.2.0', '--draft=false', '--latest'))

    def test_source_change_during_upload_leaves_release_as_draft(self):
        for change in ('commit', 'uncommitted'):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as directory:
                output = Path(directory)
                (output / 'appcast.xml').write_bytes(b'correct')
                manifest = {'version': '1.2.0', 'commit': 'commit-A',
                            'files': {'appcast.xml': release.digest(output / 'appcast.xml')}}
                uploaded = False
                calls = []

                def run(args, **kwargs):
                    if args == ['git', 'rev-parse', 'HEAD']:
                        return 'commit-B' if uploaded and change == 'commit' else 'commit-A'
                    return ' M main.py' if uploaded and change == 'uncommitted' else ''

                def github(config, *args):
                    nonlocal uploaded
                    calls.append(args)
                    if args[0] == 'api':
                        return json.dumps([{'ref': 'refs/tags/v1.2.0'}]) if 'matching-refs' in args[1] else json.dumps({'sha': 'commit-A'})
                    if args[:2] == ('release', 'upload'):
                        uploaded = True
                    if args[:2] == ('release', 'download'):
                        target = Path(args[args.index('--dir') + 1])
                        (target / 'appcast.xml').write_bytes(b'correct')
                    return ''

                with patch.object(release, 'run', side_effect=run), patch.object(release, 'github', side_effect=github), \
                        patch.object(release, 'remote_release', return_value={'draft': True, 'target_commitish': 'commit-A'}), \
                        self.assertRaisesRegex(ValueError, '変'):
                    release.publish(output, self.config, manifest)
                self.assertFalse(any(args[:2] == ('release', 'edit') for args in calls))

    def test_rejects_test_bundle_during_release_build(self):
        with patch.dict(release.os.environ, {'CHRONOLOFT_UPDATER_TEST_ROOT': '/tmp/example'}), \
                patch.object(release, 'run') as run, self.assertRaisesRegex(ValueError, 'テスト用'):
            release.build_release(self.config)
        run.assert_not_called()

    def test_rejects_dependencies_requiring_newer_macos(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory)
            (bundle / 'Python').write_bytes(b'\xcf\xfa\xed\xfe')
            with patch.object(release, 'run', return_value='cmd LC_BUILD_VERSION\n minos 26.0\n sdk 26.5'):
                with self.assertRaisesRegex(ValueError, '必要OS'):
                    release.validate_minimum_macos(bundle, '12.0')
                release.validate_minimum_macos(bundle, '26.0')
