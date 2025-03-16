# main.py
import socket
import threading
import time
import webview
import webbrowser
from backend.app import create_app  # Flaskアプリ生成のファクトリ関数

def find_free_port():
    """空いているポートをOSに割り当ててもらい取得する。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))  # ポートに 0 を指定 → OSがランダム割当
    port = s.getsockname()[1]
    s.close()
    return port

def run_flask(port):
    app = create_app()
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