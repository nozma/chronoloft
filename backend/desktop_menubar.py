"""メニューバーの表示、共有Webパネル、Dockと終了操作を管理する。"""
import json
import logging
from pathlib import Path
import sys
import threading
import time
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)


def read_desktop_state(app, device_id):
    """表示用の取得では、Discord再同期などの副作用を起こさない。"""
    from backend.app import db
    from backend.app.models import Activity, LocalSetting, StopwatchDevice, StopwatchSession
    from backend.app.routes.stopwatch_routes import _lock

    with _lock, app.app_context():
        setting = db.session.get(LocalSetting, 'showDockIcon')
        result = {'show_dock': setting.value is True if setting else False, 'session': None}
        device = db.session.get(StopwatchDevice, device_id) if device_id else None
        if not device or not device.is_local:
            return result
        session = StopwatchSession.query.filter_by(device_id=device_id, slot='main').filter(
            StopwatchSession.status.in_(['running', 'confirming'])).first()
        if session:
            activity = db.session.get(Activity, session.activity_id)
            result['session'] = {
                'id': session.id, 'started_at': session.started_at, 'paused_at': session.paused_at,
                'icon': activity.group.icon_name if activity and activity.group else None,
            }
        return result


def elapsed_title(session, now=None):
    if session is None:
        return ''
    end = session['paused_at'] if session['paused_at'] is not None else (time.time() * 1000 if now is None else now)
    minutes = max(0, int((end - session['started_at']) // 60000))
    return f'{minutes // 60:02}:{minutes % 60:02}'


def prepare_desktop_termination(app, device_id):
    """終了直前の再確認から受付停止までを、計測操作と同じロックで行う。"""
    from backend.app.routes.stopwatch_routes import _lock
    with _lock:
        if device_id is None:
            from backend.app.models import StopwatchDevice, StopwatchSession
            with app.app_context():
                # 端末IDの復元前は、既存の起動PC計測を無確認で残して終了しない。
                unknown = StopwatchSession.query.join(StopwatchDevice, StopwatchSession.device_id == StopwatchDevice.id).filter(
                    StopwatchDevice.is_local.is_(True), StopwatchSession.slot == 'main',
                    StopwatchSession.status.in_(['running', 'confirming'])).first()
                if unknown:
                    return False
        if read_desktop_state(app, device_id)['session']:
            return False
        app.extensions['desktop_update_gate'].pending = True
        return True


def install_menubar(window, app_provider):
    if sys.platform != 'darwin':
        return

    import objc
    from AppKit import (
        NSAlert, NSApplication, NSApplicationActivationPolicyAccessory,
        NSApplicationActivationPolicyRegular, NSFont, NSImage, NSImageLeft,
        NSMenu, NSMenuItem, NSEventMaskLeftMouseUp, NSEventMaskRightMouseUp,
        NSEventTypeRightMouseUp, NSObject, NSPopover, NSPopoverBehaviorTransient, NSStatusBar,
        NSVariableStatusItemLength, NSViewController,
    )
    from Foundation import NSMakePoint, NSMakeRect, NSMakeSize, NSTimer, NSURL, NSURLRequest
    from PyObjCTools import AppHelper
    from WebKit import WKUserContentController, WKUserScript, WKWebView

    # 同じWebサイトデータとプロセスプールを使い、通常画面と端末IDを共有する。
    main_webview = window.native.contentView()
    if not isinstance(main_webview, WKWebView):
        return False
    base_path = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1]))
    assets = base_path / 'frontend/dist/menubar'

    class ChronoloftMenuBarController(NSObject):
        @objc.python_method
        def setup(self):
            self.device_id = None
            self.polling = False
            self.state = None
            self.images = {}
            self.confirmation_views = set()
            self.termination_waiting = False
            self.status = NSStatusBar.systemStatusBar().statusItemWithLength_(NSVariableStatusItemLength)
            self.status.button().setTarget_(self)
            self.status.button().setAction_('toggle:')
            self.status.button().sendActionOn_(NSEventMaskLeftMouseUp | NSEventMaskRightMouseUp)
            self.status.button().setFont_(NSFont.monospacedDigitSystemFontOfSize_weight_(12, 0))
            self.status.button().setImagePosition_(NSImageLeft)
            self.status.button().setToolTip_('Chronoloft')
            self.status.button().setImage_(self.image('Chronoloft', False))
            self.popover = NSPopover.alloc().init()
            self.popover.setBehavior_(NSPopoverBehaviorTransient)
            self.popover.setContentSize_(NSMakeSize(390, 560))
            self.panel = None
            self.timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
                1, self, 'tick:', None, True)
            self.tick_(None)

        @objc.python_method
        def image(self, name, template=True):
            key = (name, template)
            if key not in self.images:
                extension = 'pdf' if template else 'icns'
                path = assets / f'{name}.{extension}'
                image = NSImage.alloc().initWithContentsOfFile_(str(path))
                if image is None:
                    image = NSApplication.sharedApplication().applicationIconImage().copy()
                image.setSize_(NSMakeSize(18, 18))
                image.setTemplate_(template)
                self.images[key] = image
            return self.images[key]

        def tick_(self, timer):
            if self.polling or app_provider() is None:
                return
            self.polling = True
            def fetch():
                try:
                    state = read_desktop_state(app_provider(), self.device_id)
                    AppHelper.callAfter(self.apply_state, state)
                except Exception:
                    logger.exception('メニューバーの状態を取得できませんでした')
                finally:
                    AppHelper.callAfter(self.finish_poll)
            threading.Thread(target=fetch, daemon=True).start()

        @objc.python_method
        def finish_poll(self):
            self.polling = False

        @objc.python_method
        def apply_state(self, state):
            self.state = state
            app = NSApplication.sharedApplication()
            policy = NSApplicationActivationPolicyRegular if state['show_dock'] else NSApplicationActivationPolicyAccessory
            if app.activationPolicy() != policy:
                app.setActivationPolicy_(policy)
            session = state['session']
            icon = session['icon'] if session else 'Chronoloft'
            if session and icon not in ('MenuBookIcon', 'SportsEsportsIcon', 'FitnessCenterIcon', 'HomeWorkIcon'):
                icon = 'HomeWorkIcon'
            self.status.button().setImage_(self.image(icon, bool(session)))
            self.status.button().setTitle_(elapsed_title(session))

        @objc.python_method
        def bind_device(self, device_id):
            from backend.app.models import StopwatchDevice
            from backend.app import db
            from backend.app.routes.stopwatch_routes import valid_id
            app = app_provider()
            if not app or not valid_id(device_id):
                return
            with app.app_context():
                device = db.session.get(StopwatchDevice, device_id)
                if not device or not device.is_local:
                    return
            if self.device_id != device_id:
                self.device_id = device_id
                if self.panel:
                    self.popover.performClose_(None)
                    self.panel = None
            self.tick_(None)
            if self.termination_waiting:
                self.termination_waiting = False
                NSApplication.sharedApplication().terminate_(None)

        @objc.python_method
        def emit(self, command, panel=False):
            script = f"window.dispatchEvent(new CustomEvent('chronoloft:desktop', {{detail: {json.dumps(command)}}}))"
            target = self.panel if panel and self.panel else main_webview
            target.evaluateJavaScript_completionHandler_(script, None)

        def toggle_(self, sender):
            self.handle_click(NSApplication.sharedApplication().currentEvent())

        @objc.python_method
        def handle_click(self, event):
            if event and event.type() == NSEventTypeRightMouseUp:
                self.show_context_menu()
                return
            if self.popover.isShown():
                self.popover.performClose_(None)
            elif self.device_id:
                self.emit('open-panel')
            else:
                self.show_main()

        @objc.python_method
        def show_context_menu(self):
            self.context_menu_from_panel = self.popover.isShown()
            self.popover.performClose_(None)
            menu = NSMenu.alloc().init()
            if getattr(window, '_sparkle', None):
                item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                    'アップデートを確認…', 'checkUpdates:', '')
                item.setTarget_(self)
                menu.addItem_(item)
                menu.addItem_(NSMenuItem.separatorItem())
            item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
                'Chronoloftを終了', 'quitApp:', '')
            item.setTarget_(self)
            menu.addItem_(item)
            self.context_menu = menu
            button = self.status.button()
            menu.popUpMenuPositioningItem_atLocation_inView_(
                None, NSMakePoint(0, button.bounds().size.height), button)

        def checkUpdates_(self, sender):
            self.command('updates')

        def quitApp_(self, sender):
            # 入力していたパネルで終了確認を行い、未保存の詳細も引き継ぐ。
            if self.context_menu_from_panel and self.panel:
                self.show_panel()
            self.command('quit')

        @objc.python_method
        def show_panel(self):
            if 'main' in self.confirmation_views:
                self.show_main(preserve_confirmation=False)
                return
            if not self.device_id:
                self.show_main()
                return
            if self.panel is None:
                config = main_webview.configuration()
                content = WKUserContentController.alloc().init()
                content.addScriptMessageHandler_name_(self, 'chronoloft')
                content.addUserScript_(WKUserScript.alloc().initWithSource_injectionTime_forMainFrameOnly_(
                    f'window.__chronoloftDesktopDeviceId = {json.dumps(self.device_id)};', 0, True))
                config.setUserContentController_(content)
                self.panel = WKWebView.alloc().initWithFrame_configuration_(NSMakeRect(0, 0, 390, 560), config)
                self.panel.setUIDelegate_(self)
                self.panel.setNavigationDelegate_(self)
                view = NSViewController.alloc().init()
                view.setView_(self.panel)
                self.popover.setContentViewController_(view)
                self.panel.loadRequest_(NSURLRequest.requestWithURL_(NSURL.URLWithString_(window.real_url.rstrip('/') + '/?menubar=1')))
            NSApplication.sharedApplication().activateIgnoringOtherApps_(True)
            self.popover.showRelativeToRect_ofView_preferredEdge_(self.status.button().bounds(), self.status.button(), 1)
            self.panel.window().makeKeyWindow()
            self.panel.evaluateJavaScript_completionHandler_(
                "window.dispatchEvent(new Event('chronoloft:panel-opened'))", None)

        @objc.python_method
        def show_main(self, settings=False, preserve_confirmation=True):
            if preserve_confirmation and 'panel' in self.confirmation_views and 'main' not in self.confirmation_views:
                self.show_panel()
                return
            self.popover.performClose_(None)
            if window.native.isMiniaturized():
                window.native.deminiaturize_(None)
            window.native.makeKeyAndOrderFront_(None)
            NSApplication.sharedApplication().activateIgnoringOtherApps_(True)
            if settings:
                main_webview.evaluateJavaScript_completionHandler_(
                    "window.dispatchEvent(new Event('chronoloft:open-settings'))", None)

        @objc.python_method
        def command(self, command, source='main'):
            if command == 'confirmation-open':
                self.confirmation_views.add(source)
            elif command == 'confirmation-closed':
                self.confirmation_views.discard(source)
            elif command == 'panel-ready':
                self.show_panel()
            elif command in ('open', 'settings'):
                self.show_main(command == 'settings')
            elif command == 'quit':
                NSApplication.sharedApplication().terminate_(None)
            elif command == 'quit-ready':
                NSApplication.sharedApplication().terminate_(None)
            elif command == 'updates':
                from backend.desktop_updater import check_for_updates
                self.popover.performClose_(None)
                NSApplication.sharedApplication().activateIgnoringOtherApps_(True)
                check_for_updates(window)

        @objc.python_method
        def allow_termination(self):
            app = app_provider()
            if app is None:
                return True
            if prepare_desktop_termination(app, self.device_id):
                return True
            if self.device_id is None:
                self.termination_waiting = True
                self.show_main()
                return False
            # 終了をいったん取り消し、保存・破棄・実行継続を選択してもらう。
            panel = 'main' not in self.confirmation_views and bool(
                'panel' in self.confirmation_views or self.popover.isShown() and self.panel)
            if panel:
                if not self.popover.isShown():
                    self.show_panel()
            else:
                self.show_main(preserve_confirmation=False)
            self.emit('quit', panel=panel)
            return False

        @objc.python_method
        def trusted(self, url):
            expected = urlsplit(window.real_url)
            actual = urlsplit(str(url))
            return (actual.scheme, actual.hostname, actual.port) == (expected.scheme, expected.hostname, expected.port)

        def userContentController_didReceiveScriptMessage_(self, controller, message):
            if not message.frameInfo().isMainFrame() or not self.trusted(message.frameInfo().request().URL().absoluteString()):
                return
            body = message.body()
            if hasattr(body, 'get'):
                if body.get('command') == 'resize':
                    height = body.get('height')
                    if isinstance(height, (int, float)) and 0 < height < 100000:
                        self.popover.setContentSize_(NSMakeSize(390, max(200, min(560, height))))
                else:
                    self.command(body.get('command'), source='panel')

        def webView_decidePolicyForNavigationAction_decisionHandler_(self, view, action, handler):
            handler(1 if self.trusted(action.request().URL().absoluteString()) else 0)

        def webView_runJavaScriptAlertPanelWithMessage_initiatedByFrame_completionHandler_(self, view, message, frame, handler):
            alert = NSAlert.alloc().init()
            alert.setMessageText_('Chronoloft')
            alert.setInformativeText_(message)
            alert.addButtonWithTitle_('OK')
            alert.runModal()
            handler()

        def webView_runJavaScriptConfirmPanelWithMessage_initiatedByFrame_completionHandler_(self, view, message, frame, handler):
            alert = NSAlert.alloc().init()
            alert.setMessageText_('Chronoloft')
            alert.setInformativeText_(message)
            alert.addButtonWithTitle_('OK')
            alert.addButtonWithTitle_('キャンセル')
            handler(alert.runModal() == 1000)

    controller = ChronoloftMenuBarController.alloc().init()
    window._menubar = controller
    controller.setup()
    return True
