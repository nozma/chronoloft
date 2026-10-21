import unittest
import tempfile

from flask import Flask
from unittest.mock import patch

from app import create_app
from app.lan_auth import IDLE_SECONDS, install_lan_auth


class LanAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'})
        self.addCleanup(self.app.extensions['lan_auth_db'].close)
        self.local = self.app.test_client()
        self.remote = self.app.test_client()
        self.options = {'base_url': 'http://192.168.1.10:5180', 'environ_overrides': {'REMOTE_ADDR': '192.168.1.20'}, 'headers': {'X-Chronoloft': '1'}}

    def enable(self, password='test-password'):
        return self.local.put('/api/lan/settings', json={'enabled': True, 'password': password})

    def login(self):
        return self.remote.post('/api/auth/login', json={'password': 'test-password'}, **self.options)

    def test_disabled_and_local_settings_only(self):
        self.assertEqual(self.remote.get('/', **self.options).status_code, 403)
        self.assertEqual(self.enable().status_code, 200)
        self.assertEqual(self.remote.get('/api/lan/settings', **self.options).status_code, 403)
        self.assertEqual(self.remote.get('/api/records', **self.options).status_code, 401)
        self.assertEqual(self.local.get('/api/auth/status').status_code, 200)

    def test_password_and_cookie(self):
        self.enable()
        self.assertEqual(self.remote.post('/api/auth/login', json={'password': 'wrong'}, **self.options).status_code, 401)
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertIn('HttpOnly', result.headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', result.headers['Set-Cookie'])
        self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 200)

    def test_idle_expiry_and_only_explicit_activity_renews(self):
        self.enable()
        with patch('app.lan_auth.time.time', return_value=1000000):
            self.login()
        with patch('app.lan_auth.time.time', return_value=1000000 + IDLE_SECONDS - 1):
            self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 200)
        with patch('app.lan_auth.time.time', return_value=1000000 + IDLE_SECONDS):
            self.assertEqual(self.remote.post('/api/auth/activity', **self.options).status_code, 401)
        with patch('app.lan_auth.time.time', return_value=2000000):
            self.login()
        with patch('app.lan_auth.time.time', return_value=2000000 + IDLE_SECONDS - 1):
            self.assertEqual(self.remote.post('/api/auth/activity', **self.options).status_code, 200)
        with patch('app.lan_auth.time.time', return_value=2000000 + IDLE_SECONDS + 1):
            self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 200)

    def test_password_change_and_disable_revoke_sessions(self):
        self.enable()
        self.login()
        self.enable('new-password')
        self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 401)
        self.local.put('/api/lan/settings', json={'enabled': False})
        self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 403)

    def test_csrf_and_rebinding(self):
        self.enable()
        self.assertEqual(self.local.put('/api/lan/settings', json={'enabled': False}, headers={'Origin': 'http://evil.example'}).status_code, 403)
        self.assertEqual(self.local.get('/api/lan/settings', base_url='http://evil.example').status_code, 403)
        options = {**self.options, 'headers': {}}
        self.assertEqual(self.remote.post('/api/auth/login', json={'password': 'test-password'}, **options).status_code, 403)

    def test_requires_password_and_limits_login_attempts(self):
        self.assertEqual(self.enable('').status_code, 400)
        self.enable()
        for _ in range(10):
            self.remote.post('/api/auth/login', json={'password': 'wrong'}, **self.options)
        self.assertEqual(self.login().status_code, 429)

    def test_proxy_does_not_bypass_auth(self):
        self.enable()
        headers = {'X-Chronoloft-Remote': '192.168.1.20'}
        self.assertEqual(self.local.get('/api/auth/status', headers=headers).status_code, 401)
        self.assertEqual(self.local.get('/api/lan/settings', headers=headers).status_code, 403)
        headers.update({'X-Chronoloft': '1', 'Origin': 'http://192.168.1.10:5173', 'X-Chronoloft-Host': '192.168.1.10:5173'})
        self.assertEqual(self.local.post('/api/auth/login', json={'password': 'test-password'}, headers=headers).status_code, 200)

    def test_logout_revokes_cookie(self):
        self.enable()
        self.login()
        self.assertEqual(self.remote.post('/api/auth/logout', **self.options).status_code, 200)
        self.assertEqual(self.remote.get('/api/auth/status', **self.options).status_code, 401)

    def test_sessions_survive_restart_without_plaintext_passwords(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Flask('first')
            install_lan_auth(first, directory)
            local = first.test_client()
            local.put('/api/lan/settings', json={'enabled': True, 'password': 'test-password'})
            remote = first.test_client()
            response = remote.post('/api/auth/login', json={'password': 'test-password'}, **self.options)
            cookie = remote.get_cookie('chronoloft_lan_session', domain='192.168.1.10')
            self.assertEqual(response.status_code, 200)
            connection = first.extensions['lan_auth_db']
            stored = connection.execute('SELECT password FROM settings').fetchone()[0]
            self.assertNotEqual(stored, 'test-password')
            self.assertNotEqual(connection.execute('SELECT token FROM sessions').fetchone()[0], cookie.value)
            connection.close()
            second = Flask('second')
            install_lan_auth(second, directory)
            try:
                client = second.test_client()
                client.set_cookie('chronoloft_lan_session', cookie.value, domain='192.168.1.10')
                self.assertEqual(client.get('/api/auth/status', **self.options).status_code, 200)
            finally:
                second.extensions['lan_auth_db'].close()
