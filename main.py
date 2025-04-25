# main.py
import socket
import threading
import time
import webview
import webbrowser
from flask_migrate import upgrade
from backend.app import create_app, db
import os

def apply_all_migrations(app):
    """
    Alembicのマイグレーションを常に実行し、
    既存DBがあればアップグレードし、空DBならテーブルを作成する。
    """
    migrations_dir = os.path.join(os.path.dirname(__file__), "backend", "migrations")
    with app.app_context():
        try:
            upgrade(directory=migrations_dir)
            print("[apply_all_migrations] DB is now up-to-date.")
        except Exception as e:
            print(f"[apply_all_migrations] Migration failed: {e}")


def find_free_port(preferred_port=5180):
    """
    1. preferred_port を試みて、空いていればそこを返す
    2. 空いていなければ、OSにランダムな空きポートを割り当ててもらう
    """
    # まず preferred_port で bind してみる
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(('127.0.0.1', preferred_port))
        # もし bind に成功すれば、ここで使うポートが確定
        port = s.getsockname()[1]
        s.close()
        return port
    except OSError:
        # bind 失敗 → 既に使われているなどの理由でbindできない
        # 次は 0 を指定して OSにランダムポートを割り当ててもらう
        s.close()

        s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s2.bind(('127.0.0.1', 0))
        port = s2.getsockname()[1]
        s2.close()
        return port

def run_flask(port):
    app = create_app()
    apply_all_migrations(app)
    print(app.instance_path)
    app.run(host='127.0.0.1', port=port)
    
class ApiBridge:
    def __init__(self, app_url):
        self.app_url = app_url

    def open_in_browser(self):
        """外部ブラウザでself.app_urlを開く"""
        webbrowser.open(self.app_url)

if __name__ == '__main__':
    # ランダムに空きポートを設定
    port = find_free_port()
    app_url = f"http://127.0.0.1:{port}"

    # Flask サーバーを別スレッドで起動
    flask_thread = threading.Thread(target=run_flask, args=(port,))
    flask_thread.daemon = True  # メインスレッド終了時に自動終了
    flask_thread.start()

    # Flask サーバーが起動するまで少し待つ（必要に応じて調整）
    time.sleep(2)

    # PyWebViewでローカルのFlaskアプリを表示
    api = ApiBridge(app_url)
    webview.create_window(
        title="Actyloft",
        url=app_url,
        js_api=api,   # フロントエンドから呼び出すAPIを登録
        width=900,
        height=600,
    )
    webview.start()