# main.py
import threading
import time
import webview
from backend.app import create_app  # Flaskアプリ生成のファクトリ関数

def run_flask():
    app = create_app()
    print(app.instance_path)
    # 本番環境で使う場合は、debug=False にするなど必要に応じた設定を行う
    app.run(host='127.0.0.1', port=5000)

if __name__ == '__main__':
    # Flask サーバーを別スレッドで起動
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True  # メインスレッド終了時に自動終了
    flask_thread.start()

    # Flask サーバーが起動するまで少し待つ（必要に応じて調整）
    time.sleep(2)

    # Pywebview で Flask サーバーのURLをウィンドウに表示する
    window = webview.create_window("Activity Tracker", "http://127.0.0.1:5000")
    webview.start()