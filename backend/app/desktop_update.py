"""更新直前の計測確認と、新しい計測要求の受付停止を同じロックで行う。"""
from flask import g, jsonify, request


class DesktopUpdateGate:
    def __init__(self, app, lock, has_active_sessions):
        self.app = app
        self.lock = lock
        self.has_active_sessions = has_active_sessions
        self.pending = False

    def busy(self):
        with self.lock, self.app.app_context():
            return self.has_active_sessions()

    def prepare(self):
        with self.lock, self.app.app_context():
            if self.has_active_sessions():
                return False
            self.pending = True
            return True

    def cancel(self):
        with self.lock:
            self.pending = False

    def install(self):
        @self.app.before_request
        def protect_stopwatch_changes():
            if request.path.startswith(('/api/stopwatches', '/api/stopwatch-devices')) and request.method not in ('GET', 'HEAD', 'OPTIONS'):
                # 判定からDBへの保存完了まで保持し、更新の準備との競合を防ぐ。
                self.lock.acquire()
                g.desktop_update_lock = True
                if self.pending:
                    return jsonify(error='アプリを更新しています。再起動後に操作してください。'), 503

        @self.app.teardown_request
        def release_stopwatch_lock(error):
            if g.pop('desktop_update_lock', False):
                self.lock.release()
