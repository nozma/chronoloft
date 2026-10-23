"""起動PC内の共有、再起動時の復元、別端末からの分離を検証する。"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from app import create_app, db
from app.models import LocalSetting


class LocalSettingsTests(unittest.TestCase):
    def setUp(self):
        self.path_guard = patch('app.get_os_db_path', side_effect=AssertionError('通常DBへのアクセスは禁止'))
        self.path_guard.start()
        self.addCleanup(self.path_guard.stop)
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'})
        self.addCleanup(self.app.extensions['lan_auth_db'].close)
        self.addCleanup(self.cleanup_database)
        self.app_client = self.app.test_client()
        self.browser = self.app.test_client()

    def cleanup_database(self):
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

    def test_app_and_browser_share_only_changed_settings(self):
        self.assertEqual(self.app_client.post('/api/settings/local', json={
            'language': 'ja', 'themeMode': 'dark', 'discordEnabled': False}).status_code, 200)
        self.browser.patch('/api/settings/local', json={'language': 'en'})
        self.app_client.patch('/api/settings/local', json={'recordSaveMode': 'confirm'})
        self.assertEqual(self.browser.get('/api/settings/local').json['settings'], {
            'language': 'en', 'themeMode': 'dark', 'discordEnabled': False, 'recordSaveMode': 'confirm'})

    def test_legacy_import_does_not_overwrite_saved_values(self):
        self.app_client.post('/api/settings/local', json={'themeMode': 'dark'})
        response = self.browser.post('/api/settings/local', json={'themeMode': 'light', 'language': 'en'})
        self.assertEqual(response.json['settings'], {'themeMode': 'dark', 'language': 'en'})

    def test_invalid_batch_does_not_partially_save(self):
        self.app_client.patch('/api/settings/local', json={'themeMode': 'dark'})
        for data in [[], None, {'themeMode': 'light', 'discordEnabled': 'false'},
                     {'unknown': True}, {'deviceName': ' '}, {'recentDays': 'yesterday'}]:
            with self.subTest(data=data):
                response = self.browser.patch('/api/settings/local', data=json.dumps(data), content_type='application/json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(self.browser.get('/api/settings/local').json['settings'], {'themeMode': 'dark'})

    def test_authenticated_lan_client_cannot_read_or_modify_host_settings(self):
        self.app_client.put('/api/lan/settings', json={'enabled': True, 'password': 'test-password'})
        options = {'base_url': 'http://192.168.1.10:5180',
                   'environ_overrides': {'REMOTE_ADDR': '192.168.1.20'}, 'headers': {'X-Chronoloft': '1'}}
        self.assertEqual(self.browser.post('/api/auth/login', json={'password': 'test-password'}, **options).status_code, 200)
        for method in ('GET', 'POST', 'PATCH'):
            self.assertEqual(self.browser.open('/api/settings/local', method=method, json={'language': 'en'}, **options).status_code, 403)
        self.assertEqual(self.app_client.get('/api/settings/local').json['settings'], {})

    def test_local_proxy_cannot_impersonate_host(self):
        self.app_client.put('/api/lan/settings', json={'enabled': True, 'password': 'test-password'})
        self.assertEqual(self.browser.get('/api/settings/local', headers={
            'X-Chronoloft-Remote': '192.168.1.20'}).status_code, 401)

    def test_shared_name_updates_local_devices_but_preserves_other_devices_and_ids(self):
        first = '00000000-0000-4000-8000-000000000001'
        second = '00000000-0000-4000-8000-000000000002'
        self.app_client.put(f'/api/stopwatch-devices/{first}', json={'name': '以前の名前'})
        self.browser.put(f'/api/stopwatch-devices/{second}', json={'name': 'ブラウザー'})
        self.app_client.put('/api/lan/settings', json={'enabled': True, 'password': 'test-password'})
        remote = self.app.test_client()
        options = {'base_url': 'http://192.168.1.10:5180',
                   'environ_overrides': {'REMOTE_ADDR': '192.168.1.20'}, 'headers': {'X-Chronoloft': '1'}}
        remote.post('/api/auth/login', json={'password': 'test-password'}, **options)
        third = '00000000-0000-4000-8000-000000000003'
        self.assertEqual(remote.put(f'/api/stopwatch-devices/{third}', json={'name': 'スマートフォン'}, **options).status_code, 200)
        self.app_client.patch('/api/settings/local', json={'deviceName': '作業PC'})
        # 再接続時に古いキャッシュの名前を送っても、共通設定を優先する。
        result = self.browser.put(f'/api/stopwatch-devices/{second}', json={'name': '古いキャッシュ'})
        self.assertEqual((result.json['id'], result.json['name']), (second, '作業PC'))
        from app.models import StopwatchDevice
        with self.app.app_context():
            self.assertEqual(db.session.get(StopwatchDevice, first).name, '作業PC')
            self.assertEqual(db.session.get(StopwatchDevice, third).name, 'スマートフォン')

    def test_failed_save_rolls_back_and_can_retry(self):
        from sqlalchemy.exc import SQLAlchemyError
        with patch.object(db.session, 'commit', side_effect=SQLAlchemyError('テスト用障害')):
            with self.assertLogs(self.app.logger, level='ERROR'):
                self.assertEqual(self.app_client.patch('/api/settings/local', json={'language': 'en'}).status_code, 500)
        with self.app.app_context():
            self.assertEqual(LocalSetting.query.count(), 0)
        self.assertEqual(self.app_client.patch('/api/settings/local', json={'language': 'en'}).status_code, 200)

    def test_settings_survive_a_process_restart(self):
        # 本物の利用者DBへ接近せず、一時DBで本番と同じ初期化を2回実行する。
        source = '''
import json, sys
from unittest.mock import patch
from app import create_app, db
with patch('app.get_os_db_path', return_value=sys.argv[1]):
    app = create_app()
client = app.test_client()
if sys.argv[2] == 'write':
    assert client.patch('/api/settings/local', json={'language': 'en', 'themeMode': 'dark', 'discordEnabled': False}).status_code == 200
print(json.dumps(client.get('/api/settings/local').json['settings']))
app.extensions['lan_auth_db'].close()
with app.app_context():
    db.session.remove()
    db.engine.dispose()
'''
        with tempfile.TemporaryDirectory() as directory:
            results = []
            for mode in ('write', 'read'):
                result = subprocess.run([sys.executable, '-c', source, str(Path(directory) / 'app.db'), mode],
                                        cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                results.append(json.loads(result.stdout.strip().splitlines()[-1]))
            self.assertEqual(results[0], results[1])
            self.assertEqual(results[1], {'language': 'en', 'themeMode': 'dark', 'discordEnabled': False})


if __name__ == '__main__':
    unittest.main()
