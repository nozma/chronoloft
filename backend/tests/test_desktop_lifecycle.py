"""実際のMacウィンドウとサーバーを使う任意実行の結合テスト。"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


@unittest.skipUnless(
    sys.platform == 'darwin' and os.environ.get('CHRONOLOFT_TEST_NATIVE') == '1',
    'MacのGUI環境で CHRONOLOFT_TEST_NATIVE=1 を指定した場合だけ実行',
)
class DesktopLifecycleTests(unittest.TestCase):
    def test_close_reopen_and_quit_keep_expected_server_lifetime(self):
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            result_path = Path(directory) / 'result.json'
            process = subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), '--native-app', str(result_path)],
                cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            try:
                stdout, stderr = process.communicate(timeout=40)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                self.fail(f'終了操作後もアプリが終了しませんでした。\n{stdout}\n{stderr}')
            self.assertEqual(process.returncode, 0, f'{stdout}\n{stderr}')
            self.assertTrue(result_path.exists(), f'{stdout}\n{stderr}')
            result = json.loads(result_path.read_text())
            self.assertEqual(result['checks'], ['close', 'reopen', 'restore', 'quit'])
            # アプリ終了後には同じサーバーへの接続も終了している必要がある。
            from urllib.error import URLError
            from urllib.request import urlopen
            with self.assertRaises((URLError, TimeoutError, ConnectionError)):
                urlopen(result['url'], timeout=2)


def run_native_app(result_path):
    import runpy
    import threading
    import time
    from unittest.mock import patch
    from urllib.request import urlopen

    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root))
    import backend.app as backend_app
    import webview
    from AppKit import NSApplication
    from PyObjCTools import AppHelper

    # 通常のDBには触れず、本番と同じ起動処理をメモリ内DBで実行する。
    app = backend_app.create_app({
        'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
    })
    app.add_url_rule('/health', view_func=lambda: 'ok')
    ready = threading.Event()
    captured = {}
    original_create_window = webview.create_window

    def create_window(*args, **kwargs):
        window = original_create_window(*args, **kwargs)
        window.events.shown += ready.set
        captured.update(window=window, url=kwargs['url'] + '/health')
        return window

    def on_main_thread(action):
        finished = threading.Event()
        errors = []
        results = []

        def invoke():
            try:
                results.append(action())
            except BaseException as error:
                errors.append(error)
            finally:
                finished.set()

        AppHelper.callAfter(invoke)
        assert finished.wait(5), 'Macのイベント処理が応答しませんでした'
        if errors:
            raise errors[0]
        return results[0]

    def wait_for_native(predicate):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if on_main_thread(predicate):
                return
            time.sleep(0.05)
        raise AssertionError('ウィンドウ状態の変更が完了しませんでした')

    def exercise_lifecycle():
        try:
            assert ready.wait(10), 'ウィンドウが表示されませんでした'
            window = captured['window']
            native = window.native
            cocoa_app = NSApplication.sharedApplication()
            checks = []

            def close():
                assert native.isVisible()
                native.performClose_(None)
                assert not native.isVisible()
                assert window in webview.windows

            on_main_thread(close)
            with urlopen(captured['url'], timeout=3) as response:
                assert response.read() == b'ok'
            checks.append('close')

            def reopen():
                cocoa_app.delegate().applicationShouldHandleReopen_hasVisibleWindows_(cocoa_app, False)
                assert native.isVisible()

            on_main_thread(reopen)
            checks.append('reopen')

            # 最小化と復元のアニメーションが完了してから状態を確認する。
            on_main_thread(lambda: native.miniaturize_(None))
            wait_for_native(native.isMiniaturized)
            on_main_thread(reopen)
            wait_for_native(lambda: not native.isMiniaturized())
            checks.extend(['restore', 'quit'])
            Path(result_path).write_text(json.dumps({'checks': checks, 'url': captured['url']}))
            # ⌘Qと終了メニューが送るCocoaの終了アクションを実行する。
            AppHelper.callAfter(cocoa_app.terminate_, None)
        except BaseException:
            import traceback
            traceback.print_exc()
            os._exit(1)

    threading.Thread(target=exercise_lifecycle, daemon=True).start()
    with patch.object(backend_app, 'create_app', return_value=app), \
            patch('flask_migrate.upgrade'), \
            patch.object(webview, 'create_window', side_effect=create_window):
        runpy.run_path(str(root / 'main.py'), run_name='__main__')


if __name__ == '__main__':
    if '--native-app' in sys.argv:
        run_native_app(sys.argv[-1])
    else:
        unittest.main()
