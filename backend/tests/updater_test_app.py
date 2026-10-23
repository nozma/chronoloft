"""テスト専用.appの起動処理。通常の.appにはこのエントリポイントを含めない。"""
import json
import os
from pathlib import Path
import threading
from unittest.mock import patch

from AppKit import NSApplication, NSButton
from Foundation import NSBundle, NSError
from PyObjCTools import AppHelper
import webview

import main
from backend.app import create_app, db
from backend.desktop_updater import allow_update_termination


def run():
    bundle = NSBundle.mainBundle()
    root = Path(str(bundle.objectForInfoDictionaryKey_('ChronoloftUpdaterTestRoot')))
    settings = json.loads((root / 'settings.json').read_text())
    # 通常のDBパスを呼び出さず、更新をまたいで同じテスト用DBだけを使う。
    with patch('backend.app.get_os_db_path', return_value=str(root / 'app.db')):
        app = create_app()
    with app.app_context():
        db.create_all()
        with db.engine.begin() as connection:
            connection.exec_driver_sql('CREATE TABLE IF NOT EXISTS update_test (value TEXT)')
            if not connection.exec_driver_sql('SELECT value FROM update_test').first():
                connection.exec_driver_sql("INSERT INTO update_test VALUES ('更新前の記録')")
    main.desktop_state['app'] = app
    port = main.find_free_port(0)
    url = f'http://127.0.0.1:{port}'
    secret = settings['secret']
    captured = {}

    @app.get('/' + secret + '/status', endpoint='update_test_status')
    def status():
        with db.engine.connect() as connection:
            value = connection.exec_driver_sql('SELECT value FROM update_test').scalar()
        sparkle = getattr(captured.get('window'), '_sparkle', None)
        error = sparkle[1].last_error if sparkle else None
        return {'version': str(bundle.objectForInfoDictionaryKey_('CFBundleVersion')),
                'sparkle': sparkle is not None, 'value': value,
                'termination_guard': captured.get('termination_guard'),
                'error': str(error) if error else None, 'error_code': error.code() if error else None}

    @app.post('/' + secret + '/<command>')
    def command(command):
        window = captured['window']
        if command == 'check':
            AppHelper.callAfter(lambda: window._sparkle[0].checkForUpdates_(None))
        elif command == 'quit':
            AppHelper.callAfter(NSApplication.sharedApplication().terminate_, None)
        elif command == 'close':
            AppHelper.callAfter(window.native.performClose_, None)
        elif command == 'reopen':
            AppHelper.callAfter(lambda: NSApplication.sharedApplication().delegate()
                                .applicationShouldHandleReopen_hasVisibleWindows_(NSApplication.sharedApplication(), False))
        elif command == 'install':
            AppHelper.callAfter(click_install)
        elif command == 'test-termination-guard':
            AppHelper.callAfter(test_termination_guard)
        else:
            return {'error': '不明な操作です'}, 400
        return {'ok': True}

    def test_termination_guard():
        window = captured['window']
        delegate = window._sparkle[1]
        gate = app.extensions['desktop_update_gate']
        native = NSApplication.sharedApplication()
        result = {}
        try:
            # 再起動保留コールバックを呼ばず、再開時のインストール通知から確認する。
            delegate.updater_willInstallUpdate_(None, None)
            result['installing'] = delegate.installing
            with patch.object(gate, 'has_active_sessions', return_value=True):
                result['blocked'] = native.delegate().applicationShouldTerminate_(native) == 0
                result['intent_retained'] = delegate.installing
                result['retry_blocked'] = native.delegate().applicationShouldTerminate_(native) == 0
                result['requests_reopened'] = not gate.pending
            with patch.object(gate, 'has_active_sessions', return_value=False):
                result['idle_allowed'] = allow_update_termination(window, lambda: app)
                result['new_requests_blocked'] = gate.pending
            error = NSError.errorWithDomain_code_userInfo_('ChronoloftUpdateTest', 1, None)
            delegate.updater_didAbortWithError_(None, error)
            result['abort_cleared'] = not delegate.installing and not gate.pending
            with patch.object(gate, 'has_active_sessions', return_value=True):
                result['normal_quit_allowed'] = allow_update_termination(window, lambda: app)
        except Exception as error:
            result['error'] = repr(error)
        finally:
            gate.cancel()
            delegate.installing = False
            delegate.last_error = None
            captured['termination_guard'] = result

    def click_install():
        titles = []

        def visit(view):
            if isinstance(view, NSButton):
                title = str(view.title())
                titles.append(title)
                if view.isEnabled() and not view.isHiddenOrHasHiddenAncestor() and 'automatically' not in title.lower() and '自動' not in title and any(text in title.lower() for text in (
                        'install update', 'install and relaunch', '再起動', 'インストール')):
                    view.performClick_(None)
                    return True
            return any(visit(child) for child in view.subviews())

        clicked = any(visit(native.contentView()) for native in NSApplication.sharedApplication().windows()
                      if native.isVisible() and native.contentView() is not None)
        (root / 'buttons.json').write_text(json.dumps({'clicked': clicked, 'titles': titles}, ensure_ascii=False))

    threading.Thread(target=app.run, kwargs={'host': '127.0.0.1', 'port': port}, daemon=True).start()
    window = webview.create_window(title='Chronoloft Update Test', url=url, width=700, height=500)
    captured['window'] = window
    window.events.before_show += main.configure_macos_window
    (root / 'process.json').write_text(json.dumps({'url': url + '/' + secret, 'pid': os.getpid()}))
    webview.start()


if __name__ == '__main__':
    run()
