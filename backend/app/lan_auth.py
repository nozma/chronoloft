"""LAN共有の設定と、最終利用から7日で失効する認証。"""
import hashlib
import ipaddress
import os
import secrets
import socket
import sqlite3
import threading
import time
from urllib.parse import urlsplit

from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

IDLE_SECONDS = 7 * 24 * 60 * 60
COOKIE = 'chronoloft_lan_session'


def install_lan_auth(app, data_dir):
    path = ':memory:' if app.testing else os.path.join(data_dir, 'lan_auth.db')
    connection = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
    lock = threading.RLock()
    with lock:
        connection.executescript('''
            CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, enabled INTEGER, password TEXT);
            INSERT OR IGNORE INTO settings VALUES (1, 0, '');
            CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, last_used REAL);
        ''')
    app.extensions['lan_auth_db'] = connection
    attempts = {}

    def settings():
        with lock:
            return connection.execute('SELECT enabled, password FROM settings WHERE id=1').fetchone()

    def local():
        try:
            address = request.remote_addr or ''
            if ipaddress.ip_address(address).is_loopback:
                address = request.headers.get('X-Chronoloft-Remote', address)
            return ipaddress.ip_address(address).is_loopback and urlsplit('//' + request.host).hostname in ('localhost', '127.0.0.1', '::1')
        except ValueError:
            return False

    def token_hash():
        return hashlib.sha256(request.cookies.get(COOKIE, '').encode()).hexdigest()

    def authenticated():
        with lock:
            row = connection.execute('SELECT last_used FROM sessions WHERE token=?', (token_hash(),)).fetchone()
        return bool(row and row[0] > time.time() - IDLE_SECONDS)

    @app.before_request
    def protect():
        is_local = local()
        g.chronoloft_local = is_local
        if request.path.startswith('/api/discord_presence/') and not is_local:
            return jsonify(error='Discord連携は起動PC自身の計測だけが対象です。'), 403
        if not is_local and not settings()[0]:
            return jsonify(error='LANアクセスは無効です。'), 403
        if request.path.startswith('/api/'):
            origin = request.headers.get('Origin')
            expected_origin = request.host_url.rstrip('/')
            if ipaddress.ip_address(request.remote_addr or '0.0.0.0').is_loopback and request.headers.get('X-Chronoloft-Remote'):
                expected_origin = request.scheme + '://' + request.headers.get('X-Chronoloft-Host', request.host)
            if origin and origin != expected_origin:
                # 開発サーバーのプロキシ経由ではOriginと転送先のポートが異なる。
                parsed = urlsplit(origin)
                if not (is_local and parsed.hostname in ('localhost', '127.0.0.1') and parsed.port == 5173):
                    return jsonify(error='別のサイトからの操作は許可されていません。'), 403
            if request.method not in ('GET', 'HEAD', 'OPTIONS') and not is_local and request.headers.get('X-Chronoloft') != '1':
                return jsonify(error='不正なリクエストです。'), 403
            if request.path.startswith('/api/lan/'):
                if not is_local:
                    return jsonify(error='LAN設定は起動したPCから変更してください。'), 403
            elif request.path != '/api/auth/login' and not is_local and not authenticated():
                return jsonify(error='ログインしてください。'), 401

    @app.after_request
    def no_cache(response):
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/auth/status')
    def status():
        return jsonify(local=local(), authenticated=local() or authenticated())

    @app.post('/api/auth/login')
    def login():
        now = time.time()
        address = request.remote_addr
        with lock:
            recent = [t for t in attempts.get(address, []) if t > now - 60]
            if len(recent) >= 10:
                return jsonify(error='少し待ってから再試行してください。'), 429
            attempts[address] = recent + [now]
        password = (request.get_json(silent=True) or {}).get('password', '')
        stored = settings()[1]
        if not isinstance(password, str) or len(password) > 256 or not stored or not check_password_hash(stored, password):
            return jsonify(error='パスワードが違います。'), 401
        token = secrets.token_urlsafe(32)
        with lock:
            connection.execute('DELETE FROM sessions WHERE last_used <= ?', (now - IDLE_SECONDS,))
            connection.execute('INSERT INTO sessions VALUES (?, ?)', (hashlib.sha256(token.encode()).hexdigest(), now))
        response = jsonify(authenticated=True)
        response.set_cookie(COOKIE, token, max_age=IDLE_SECONDS, httponly=True, samesite='Strict', secure=request.is_secure)
        return response

    @app.post('/api/auth/activity')
    def activity():
        response = jsonify(ok=True)
        if not local():
            with lock:
                connection.execute('UPDATE sessions SET last_used=? WHERE token=?', (time.time(), token_hash()))
            response.set_cookie(COOKIE, request.cookies[COOKIE], max_age=IDLE_SECONDS, httponly=True, samesite='Strict', secure=request.is_secure)
        return response

    @app.post('/api/auth/logout')
    def logout():
        with lock:
            connection.execute('DELETE FROM sessions WHERE token=?', (token_hash(),))
        response = jsonify(ok=True)
        response.delete_cookie(COOKIE)
        return response

    @app.get('/api/lan/settings')
    def get_settings():
        enabled, password = settings()
        addresses = set()
        try:
            for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                address = item[4][0]
                if not ipaddress.ip_address(address).is_loopback:
                    addresses.add(address)
        except OSError:
            pass
        # ホスト名でLANアドレスが得られない環境では経路から調べる。
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                probe.connect(('192.0.2.1', 80))
                address = probe.getsockname()[0]
                if not ipaddress.ip_address(address).is_loopback:
                    addresses.add(address)
        except OSError:
            pass
        port = app.config.get('LAN_PORT', 5180)
        return jsonify(enabled=bool(enabled), password_set=bool(password), urls=[f'http://{address}:{port}' for address in sorted(addresses)])

    @app.put('/api/lan/settings')
    def save_settings():
        data = request.get_json(silent=True) or {}
        enabled = data.get('enabled')
        password = data.get('password', '')
        if not isinstance(enabled, bool) or not isinstance(password, str) or (password and not 8 <= len(password) <= 256):
            return jsonify(error='パスワードは8〜256文字で指定してください。'), 400
        with lock:
            stored = settings()[1]
            if enabled and not password and not stored:
                return jsonify(error='LANアクセス用パスワードを設定してください。'), 400
            connection.execute('UPDATE settings SET enabled=?, password=? WHERE id=1', (int(enabled), generate_password_hash(password) if password else stored))
            if password or not enabled:
                connection.execute('DELETE FROM sessions')
        return get_settings()
