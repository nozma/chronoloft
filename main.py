# main.py
import socket
import threading
import time
import webview
import webbrowser
from flask_migrate import upgrade
from backend.app import create_app, db
import os

def auto_migrate_if_needed(app):
    """
    DBファイルが存在しない場合、flask_migrate.upgrade() を呼んで
    Alembicのマイグレーションを自動適用し、テーブルを作成する。
    """
    db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    print(db_uri)
    if db_uri.startswith("sqlite:///"):
        # sqlite:///... → ファイルパスを取り出す
        db_path = db_uri.replace("sqlite:///", "")
        if not os.path.exists(db_path):
            print(f"[auto_migrate_if_needed] No DB found at {db_path}. Applying migrations...")

            # migrationsフォルダのパスを指定 (要: ご自身のフォルダ構成を確認)
            migrations_dir = os.path.join(os.path.dirname(__file__), "backend", "migrations")

            with app.app_context():
                try:
                    upgrade(directory=migrations_dir)
                    print("[auto_migrate_if_needed] Migrations applied successfully.")
                except Exception as e:
                    print(f"[auto_migrate_if_needed] Migration failed: {e}")


def find_free_port():
    """空いているポートをOSに割り当ててもらい取得する。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))  # ポートに 0 を指定 → OSがランダム割当
    port = s.getsockname()[1]
    s.close()
    return port

def run_flask(port):
    app = create_app()
    auto_migrate_if_needed(app)
    print(app.instance_path)
    # 本番環境で使う場合は、debug=False にするなど必要に応じた設定を行う
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
        title="Activity Tracker",
        url=app_url,
        js_api=api,   # フロントエンドから呼び出すAPIを登録
    )
    webview.start()