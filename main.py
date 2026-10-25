# main.py
import errno
import socket
import sys
import threading
import time
import webbrowser
import uuid
from flask_migrate import upgrade
from backend.app import create_app, db
import os

desktop_state = {}

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
    優先ポートを再利用し、直前のプロセスの終了を最大2秒待つ。
    使用中のままなら、OSに空きポートを割り当ててもらう。
    """
    deadline = time.monotonic() + 2.0
    while True:
        try:
            port = preferred_port
            # Macでは全アドレスへのbindだけだとlocalhost限定の待ち受けと競合しない。
            # 画面の接続先も確認し、別のサービスを開いてしまうことを防ぐ。
            for host in ('0.0.0.0', '127.0.0.1'):
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                    if os.name == 'posix':
                        # 実際のサーバーと同じ条件で、通信終了後のアドレスを再利用する。
                        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    probe.bind((host, port))
                    port = probe.getsockname()[1]
            return port
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                raise
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(0.1, remaining))

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(('0.0.0.0', 0))
        return probe.getsockname()[1]

def run_flask(port):
    app = create_app()
    apply_all_migrations(app)
    desktop_state['app'] = app
    print(app.instance_path)
    # LAN設定がオフの場合、認証処理が外部端末からの全アクセスを拒否する。
    app.config['LAN_PORT'] = port
    app.run(host='0.0.0.0', port=port)
    
class ApiBridge:
    def __init__(self, app_url):
        self.app_url = app_url

    def open_in_browser(self, device_id):
        """アプリの端末IDを引き継いで外部ブラウザを開く。"""
        device_id = str(uuid.UUID(device_id))
        webbrowser.open(f'{self.app_url}#chronoloft-device-id={device_id}')

    def desktop_ready(self, device_id):
        """通常画面とメニューバーが操作する端末を一致させる。"""
        if sys.platform == 'darwin':
            from PyObjCTools import AppHelper
            desktop_state['device_id'] = device_id
            if controller := desktop_state.get('menubar'):
                AppHelper.callAfter(controller.bind_device, device_id)

    def desktop_command(self, command):
        if sys.platform == 'darwin':
            from PyObjCTools import AppHelper
            if controller := desktop_state.get('menubar'):
                AppHelper.callAfter(controller.command, command)


def configure_macos_window(window):
    """Macでは画面を閉じても常駐し、Dockから同じ画面を再表示する。"""
    if sys.platform != 'darwin':
        return

    from AppKit import NSApplication

    app = NSApplication.sharedApplication()
    native = window.native

    # 元のデリゲートを継承し、終了メニューや他のウィンドウイベントを維持する。
    class ChronoloftWindowDelegate(type(native.delegate())):
        def windowShouldClose_(self, sender):
            sender.orderOut_(None)
            return False

    class ChronoloftAppDelegate(type(app.delegate())):
        def applicationShouldTerminate_(self, sender):
            from backend.desktop_updater import allow_update_termination, cancel_update_termination
            provider = lambda: desktop_state.get('app')
            if not allow_update_termination(window, provider):
                cancel_update_termination(window, provider)
                return 0
            if (controller := getattr(window, '_menubar', None)) and not controller.allow_termination():
                cancel_update_termination(window, provider)
                return 0
            result = super().applicationShouldTerminate_(sender)
            if result == 0:
                cancel_update_termination(window, provider)
            return result

        def applicationShouldHandleReopen_hasVisibleWindows_(self, sender, has_visible_windows):
            if native.isMiniaturized():
                native.deminiaturize_(None)
            native.makeKeyAndOrderFront_(None)
            sender.activateIgnoringOtherApps_(True)
            return False

    # Cocoaのデリゲート参照は弱参照のため、画面と同じ寿命で保持する。
    window._macos_delegates = (
        ChronoloftWindowDelegate.alloc().init(),
        ChronoloftAppDelegate.alloc().init(),
    )
    native.setDelegate_(window._macos_delegates[0])
    app.setDelegate_(window._macos_delegates[1])
    from backend.desktop_updater import install_updater
    from PyObjCTools import AppHelper
    # メニュー作成とウィンドウ初期化の完了後、Cocoaのメインスレッドで組み込む。
    AppHelper.callAfter(install_updater, window, lambda: desktop_state.get('app'))
    from backend.desktop_menubar import install_menubar
    def install_desktop_controls():
        import logging
        try:
            if not install_menubar(window, lambda: desktop_state.get('app')):
                AppHelper.callLater(0.1, install_desktop_controls)
                return
            desktop_state['menubar'] = window._menubar
            if device_id := desktop_state.get('device_id'):
                window._menubar.bind_device(device_id)
        except Exception:
            logging.getLogger(__name__).exception('メニューバーを初期化できませんでした')
    AppHelper.callAfter(install_desktop_controls)


if __name__ == '__main__':
    import webview

    # 5180を優先し、使用中の場合だけ別の空きポートを設定する。
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
    window = webview.create_window(
        title="Chronoloft",
        url=app_url,
        js_api=api,   # フロントエンドから呼び出すAPIを登録
        width=900,
        height=600,
    )
    window.events.before_show += configure_macos_window
    # 画面設定や端末IDを、アプリを完全終了した後も保持する。
    webview.start(private_mode=False)
