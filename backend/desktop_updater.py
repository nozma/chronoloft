"""配布版のMacアプリからSparkle標準の更新画面を呼び出す。"""
import logging
from pathlib import Path
import sys

logger = logging.getLogger(__name__)


def check_for_updates(window):
    """Dock非表示時も、既存の手動更新処理と計測確認を利用する。"""
    sparkle = getattr(window, '_sparkle', None)
    if sparkle:
        sparkle[0].checkForUpdates_(None)


def install_updater(window, app_provider):
    if sys.platform != 'darwin' or not getattr(sys, 'frozen', False):
        return

    import objc
    from AppKit import NSAlert, NSApplication, NSMenuItem, NSObject
    from Foundation import NSBundle, NSError, NSLocalizedDescriptionKey
    from PyObjCTools import AppHelper

    bundle = NSBundle.mainBundle()
    framework = Path(str(bundle.bundlePath())) / 'Contents/Frameworks/Sparkle.framework'
    namespace = {}
    try:
        objc.loadBundle('Sparkle', namespace, bundle_path=str(framework))
        controller_class = objc.lookUpClass('SPUStandardUpdaterController')
    except Exception:
        logger.exception('更新機能を読み込めませんでした')
        return

    def gate():
        app = app_provider()
        return app.extensions.get('desktop_update_gate') if app else None

    def show_message(message):
        alert = NSAlert.alloc().init()
        alert.setMessageText_('Chronoloftのアップデート')
        alert.setInformativeText_(message)
        alert.addButtonWithTitle_('OK')
        alert.runModal()

    def allowed():
        state = gate()
        if state is None:
            message = 'アプリの起動処理が完了していません。少し待ってから試してください。'
        elif state.busy():
            message = '計測中、または保存確認中のストップウォッチがあります。他端末の計測も終了してから更新してください。'
        else:
            return True, None
        return False, NSError.errorWithDomain_code_userInfo_(
            'ChronoloftUpdate', 1, {NSLocalizedDescriptionKey: message})

    # 動的に読み込むframeworkのブロック引数をPyObjCへ伝える。
    objc.registerMetaDataForSelector(
        b'ChronoloftSparkleDelegate', b'updater:shouldPostponeRelaunchForUpdate:untilInvokingBlock:',
        {'arguments': {4: {'type': b'@?', 'callable': {
            'retval': {'type': b'v'}, 'arguments': {0: {'type': b'^v'}}}}}})

    class ChronoloftSparkleDelegate(NSObject):
        @objc.signature(objc._C_NSBOOL + b'@:@qo^@')
        def updater_mayPerformUpdateCheck_error_(self, updater, check, error):
            self.last_error = None
            return allowed()

        @objc.signature(objc._C_NSBOOL + b'@:@@qo^@')
        def updater_shouldProceedWithUpdate_updateCheck_error_(self, updater, item, check, error):
            return allowed()

        @objc.signature(b'v@:@@')
        def updater_willInstallUpdate_(self, updater, item):
            # 前回保留した更新の再開では、再起動保留のコールバックを経由しない場合がある。
            self.installing = True

        @objc.signature(objc._C_NSBOOL + b'@:@@@?')
        def updater_shouldPostponeRelaunchForUpdate_untilInvokingBlock_(self, updater, item, handler):
            self.install_handler = handler
            state = gate()
            if state is not None and state.prepare():
                self.installing = True
                AppHelper.callAfter(handler)
            else:
                show_message('更新の再起動を保留しています。すべての端末で計測と保存確認を終えると再起動します。')
                AppHelper.callLater(1, self.resume_when_ready)
            return True

        @objc.python_method
        def resume_when_ready(self):
            if self.install_handler is None:
                return
            state = gate()
            if state is not None and state.prepare():
                self.installing = True
                self.install_handler()
            else:
                AppHelper.callLater(1, self.resume_when_ready)

        @objc.signature(b'v@:@@')
        def updater_didAbortWithError_(self, updater, error):
            self.last_error = error
            self.install_handler = None
            self.installing = False
            state = gate()
            if state is not None:
                state.cancel()
            logger.warning('更新処理を終了しました: %s', error)

    delegate = ChronoloftSparkleDelegate.alloc().init()
    delegate.install_handler = None
    delegate.installing = False
    delegate.last_error = None
    controller = controller_class.alloc().initWithStartingUpdater_updaterDelegate_userDriverDelegate_(
        False, delegate, None)
    controller.startUpdater()
    application = NSApplication.sharedApplication()
    menu = application.mainMenu().itemAtIndex_(0).submenu()
    item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(
        'アップデートを確認…', 'checkForUpdates:', '')
    item.setTarget_(controller)
    menu.insertItem_atIndex_(item, 1)
    window._sparkle = (controller, delegate, item)


def allow_update_termination(window, app_provider):
    """再起動直前にも確認し、終了を取り消す場合は受付停止を解除する。"""
    sparkle = getattr(window, '_sparkle', None)
    if not sparkle or not sparkle[1].installing:
        return True
    app = app_provider()
    state = app.extensions.get('desktop_update_gate') if app else None
    return state is not None and state.prepare()


def cancel_update_termination(window, app_provider):
    # 終了の再試行にも計測確認が必要なため、更新中の印は中止通知まで保持する。
    app = app_provider()
    if app and (state := app.extensions.get('desktop_update_gate')):
        state.cancel()
