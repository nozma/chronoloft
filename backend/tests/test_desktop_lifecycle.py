"""実際のMacウィンドウとサーバーを使う任意実行の結合テスト。"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

if '--native-tests' in sys.argv:
    os.environ['CHRONOLOFT_TEST_NATIVE'] = '1'
    sys.argv.remove('--native-tests')


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

    def test_menubar_panel_and_quit_save(self):
        self.run_menubar_case('complete')

    def test_menubar_panel_and_quit_discard(self):
        self.run_menubar_case('cancel')

    def test_quit_preserves_main_window_confirmation(self):
        self.run_menubar_case('main-complete')

    def run_menubar_case(self, action):
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            result_path = Path(directory) / 'result.json'
            process = subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), '--menubar-app', str(result_path), action],
                cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            try:
                stdout, stderr = process.communicate(timeout=60)
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                self.fail(f'メニューバーの操作が完了しませんでした。\n{stdout}\n{stderr}')
            self.assertEqual(process.returncode, 0, f'{stdout}\n{stderr}')
            result = json.loads(result_path.read_text())
            self.assertEqual(result['status'], 'completed' if action.endswith('complete') else 'cancelled')
            self.assertEqual(result['saved'], action.endswith('complete'))
            self.assertEqual(result['memo'], '保存確認で入力' if action.endswith('complete') else 'メニューバーで入力')


def run_native_app(result_path, quit_action=None):
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
    import WebKit

    # テスト用画面の端末IDやUI設定を通常のWebサイトデータに残さない。
    original_store = WebKit.WKWebsiteDataStore
    isolated_store = original_store.nonPersistentDataStore()
    class IsolatedStore:
        @staticmethod
        def defaultDataStore():
            return isolated_store

    # 通常のDBには触れず、本番と同じ起動処理をメモリ内DBで実行する。
    app = backend_app.create_app({
        'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
    })
    app.add_url_rule('/health', view_func=lambda: 'ok')
    if quit_action:
        import datetime
        from backend.app.routes.stopwatch_routes import _lock
        # メモリ内SQLiteは同じ接続を共有するため、並行HTTP要求も直列化する。
        @app.before_request
        def serialize_test_requests():
            from flask import g
            _lock.acquire()
            g.native_test_lock = True

        @app.teardown_request
        def release_test_request(error):
            from flask import g
            if g.pop('native_test_lock', False):
                _lock.release()

        from backend.app.models import Activity, ActivityGroup, ActivityUnitType, LocalSetting, Record
        with app.app_context():
            backend_app.db.create_all()
            group = ActivityGroup(name='テストグループ', icon_name='MenuBookIcon')
            activity = Activity(name='メニューバーテスト', unit=ActivityUnitType.MINUTES, group=group)
            backend_app.db.session.add(activity)
            backend_app.db.session.flush()
            backend_app.db.session.add(Record(activity_id=activity.id, value=10,
                created_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=1)))
            backend_app.db.session.add_all([LocalSetting(key='language', value='ja'), LocalSetting(key='discordEnabled', value=False)])
            if quit_action.endswith('complete'):
                backend_app.db.session.add(LocalSetting(key='recordSaveMode', value='confirm'))
            backend_app.db.session.commit()
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

            if quit_action:
                exercise_menubar(window, cocoa_app)
                return

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

    def evaluate(view, script):
        finished = threading.Event()
        result = []
        def complete(value, error):
            result.extend([value, error])
            finished.set()
        AppHelper.callAfter(view.evaluateJavaScript_completionHandler_, script, complete)
        assert finished.wait(5), 'パネルの応答がありません'
        assert not result[1], str(result[1])
        return result[0]

    def wait_for(predicate):
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.05)
        raise AssertionError('メニューバーの状態が更新されませんでした')

    def snapshot(view, name):
        from AppKit import NSBitmapImageRep, NSPNGFileType
        finished = threading.Event()
        errors = []
        def complete(image, error):
            if error:
                errors.append(str(error))
            else:
                bitmap = NSBitmapImageRep.imageRepWithData_(image.TIFFRepresentation())
                bitmap.representationUsingType_properties_(NSPNGFileType, {}).writeToFile_atomically_(
                    str(Path(tempfile.gettempdir()) / f'chronoloft-menubar-{name}.png'), True)
            finished.set()
        AppHelper.callAfter(view.takeSnapshotWithConfiguration_completionHandler_, None, complete)
        assert finished.wait(5) and not errors, str(errors)

    def exercise_menubar(window, cocoa_app):
        from AppKit import NSApplicationActivationPolicyAccessory, NSApplicationActivationPolicyRegular
        from backend.desktop_menubar import read_desktop_state
        from backend.app.models import LocalSetting, StopwatchSession, Record

        wait_for(lambda: on_main_thread(lambda: bool(getattr(window, '_menubar', None) and window._menubar.device_id)))
        controller = window._menubar
        # 配布版の既存更新操作を代役に置き換え、ネットワーク送信せず入口を検証する。
        from types import SimpleNamespace
        update_checks = []
        window._sparkle = (SimpleNamespace(checkForUpdates_=lambda sender: update_checks.append(True)),
                           SimpleNamespace(installing=False), None)
        wait_for(lambda: on_main_thread(cocoa_app.activationPolicy) == NSApplicationActivationPolicyAccessory)
        # 同じ設定保存先の変更で、再起動なしにDock表示が往復する。
        for enabled, policy in [(True, NSApplicationActivationPolicyRegular), (False, NSApplicationActivationPolicyAccessory)]:
            with app.app_context():
                backend_app.db.session.merge(LocalSetting(key='showDockIcon', value=enabled))
                backend_app.db.session.commit()
            wait_for(lambda: on_main_thread(cocoa_app.activationPolicy) == policy)
        on_main_thread(lambda: controller.toggle_(None))
        wait_for(lambda: on_main_thread(lambda: controller.panel is not None and controller.popover.isShown()))
        panel = controller.panel
        wait_for(lambda: evaluate(panel, "document.body.innerText.includes('最近のアクティビティ')"))
        assert evaluate(panel, 'window.__chronoloftDesktopDeviceId') == controller.device_id
        wait_for(lambda: evaluate(panel, "Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'メニューバーテスト' && !b.disabled)"))
        evaluate(panel, "Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'アップデートを確認…').click()")
        wait_for(lambda: update_checks == [True])
        wait_for(lambda: not on_main_thread(controller.popover.isShown))
        on_main_thread(lambda: controller.toggle_(None))
        wait_for(lambda: on_main_thread(controller.popover.isShown))
        snapshot(panel, 'idle')
        evaluate(panel, "Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'メニューバーテスト').click()")
        wait_for(lambda: read_desktop_state(app, controller.device_id)['session'] is not None)
        wait_for(lambda: on_main_thread(lambda: str(controller.status.button().title())) == '00:00')
        wait_for(lambda: evaluate(panel, "Boolean(document.querySelector('input[role=combobox]'))"))
        evaluate(panel, """(() => {
            const input = document.querySelector('input[role=combobox]');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'メニューバーで入力');
            input.dispatchEvent(new Event('input', {bubbles:true}));
        })()""")
        def memo_saved():
            with app.app_context():
                item = StopwatchSession.query.filter_by(device_id=controller.device_id, slot='main').first()
                return item.memo == 'メニューバーで入力'
        wait_for(memo_saved)
        wait_for(lambda: evaluate(panel, "Boolean(document.querySelector('input[role=combobox]:not(:disabled)'))"))
        snapshot(panel, 'running')
        # 既存画面にも同じ端末の計測と詳細が反映される。
        wait_for(lambda: evaluate(window.native.contentView(), "Boolean(document.querySelector('input[role=combobox][value=\"メニューバーで入力\"]'))"))
        if quit_action == 'cancel':
            # 起動直後に端末IDがまだ復元されていない場合も、確認を飛ばさない。
            device_id = controller.device_id
            def unbind_and_quit():
                controller.device_id = None
                assert not controller.allow_termination()
                assert controller.termination_waiting
                assert not app.extensions['desktop_update_gate'].pending
            on_main_thread(unbind_and_quit)
            wait_for(lambda: not on_main_thread(controller.popover.isShown))
            on_main_thread(lambda: controller.bind_device(device_id))
            main_view = window.native.contentView()
            wait_for(lambda: evaluate(main_view, "document.body.innerText.includes('Chronoloftを終了しますか？')"))
            evaluate(main_view, "Array.from(document.querySelectorAll('button')).find(b => b.textContent === '実行を続ける').click()")
            wait_for(lambda: evaluate(main_view, "!document.body.innerText.includes('Chronoloftを終了しますか？')"))
            on_main_thread(lambda: controller.toggle_(None))
            wait_for(lambda: on_main_thread(controller.popover.isShown))
            panel = controller.panel
            wait_for(lambda: evaluate(panel, "Boolean(document.querySelector('input[role=combobox]:not(:disabled)'))"))
        quit_view = panel
        if quit_action.endswith('complete'):
            # 保存確認画面で入力中の内容も、終了時の保存へ引き継ぐ。
            if quit_action == 'main-complete':
                on_main_thread(controller.show_main)
                quit_view = window.native.contentView()
            evaluate(quit_view, "document.querySelector('button[aria-label=\"終了・保存\"]').click()")
            wait_for(lambda: evaluate(quit_view, "Boolean(document.querySelector('[role=dialog] input[role=combobox]'))"))
            evaluate(quit_view, """(() => {
                const input = document.querySelector('[role=dialog] input[role=combobox]');
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '保存確認で入力');
                input.dispatchEvent(new Event('input', {bubbles:true}));
            })()""")
            owner = 'main' if quit_action == 'main-complete' else 'panel'
            wait_for(lambda: on_main_thread(lambda: owner in controller.confirmation_views))
            if owner == 'main':
                on_main_thread(lambda: controller.command('panel-ready'))
                wait_for(lambda: not on_main_thread(controller.popover.isShown))
            else:
                # パネルが閉じていても、その保存確認を優先して終了確認を開く。
                on_main_thread(lambda: controller.popover.performClose_(None))
                wait_for(lambda: not on_main_thread(controller.popover.isShown))
        original_command = controller.command
        def command(value, source='main'):
            if value == 'quit-ready':
                with app.app_context():
                    item = StopwatchSession.query.filter_by(device_id=controller.device_id, slot='main').one()
                    Path(result_path).write_text(json.dumps({
                        'status': item.status, 'saved': item.record_id is not None,
                        'memo': backend_app.db.session.get(Record, item.record_id).memo if item.record_id else item.memo,
                    }))
            original_command(value, source=source)
        controller.command = command
        on_main_thread(lambda: cocoa_app.terminate_(None))
        wait_for(lambda: evaluate(quit_view, "document.body.innerText.includes('Chronoloftを終了しますか？')"))
        # 継続を選ぶと、計測とサーバーを保持して終了を取り消す。
        evaluate(quit_view, "Array.from(document.querySelectorAll('button')).find(b => b.textContent === '実行を続ける').click()")
        wait_for(lambda: evaluate(quit_view, "!document.body.innerText.includes('Chronoloftを終了しますか？')"))
        assert read_desktop_state(app, controller.device_id)['session'] is not None
        on_main_thread(lambda: cocoa_app.terminate_(None))
        wait_for(lambda: evaluate(quit_view, "document.body.innerText.includes('Chronoloftを終了しますか？')"))
        label = '保存して終了' if quit_action.endswith('complete') else '破棄して終了'
        wait_for(lambda: evaluate(quit_view, f"Array.from(document.querySelectorAll('button')).some(b => b.textContent === '{label}' && !b.disabled)"))
        evaluate(quit_view, f"Array.from(document.querySelectorAll('button')).find(b => b.textContent === '{label}').click()")
        wait_for(lambda: Path(result_path).exists())

    threading.Thread(target=exercise_lifecycle, daemon=True).start()
    with patch.object(backend_app, 'create_app', return_value=app), \
            patch('flask_migrate.upgrade'), \
            patch.object(WebKit, 'WKWebsiteDataStore', IsolatedStore), \
            patch.object(webview, 'create_window', side_effect=create_window):
        runpy.run_path(str(root / 'main.py'), run_name='__main__')


if __name__ == '__main__':
    if '--menubar-app' in sys.argv:
        run_native_app(sys.argv[-2], sys.argv[-1])
    elif '--native-app' in sys.argv:
        run_native_app(sys.argv[-1])
    else:
        unittest.main()
