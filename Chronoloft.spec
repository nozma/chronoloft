# -*- mode: python ; coding: utf-8 -*-

import json
import os
from pathlib import Path
import sys

sys.path.insert(0, SPECPATH)
from scripts.release_macos import load_config, bundle_settings, embed_sparkle

release_config = load_config()
test_root = os.environ.get('CHRONOLOFT_UPDATER_TEST_ROOT')
bundle_info = bundle_settings(release_config)
if test_root:
    test_settings = json.loads((Path(test_root) / 'settings.json').read_text())
    bundle_info.update({
        'SUFeedURL': test_settings['feed_url'],
        'ChronoloftUpdaterTestRoot': test_root,
        'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
    })

# Finderと画面内のバージョンを、ルートのpackage.jsonに揃える。
app_version = json.loads((Path(SPECPATH) / 'package.json').read_text(encoding='utf-8'))['version']


a = Analysis(
    ['backend/tests/updater_test_app.py' if test_root else 'main.py'],
    pathex=[SPECPATH],
    binaries=[],
    datas=[('frontend/dist', 'frontend/dist'), ('backend/migrations', 'backend/migrations'), ('LICENSE', '.')],
    hiddenimports=['logging.config'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Chronoloft',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=release_config['architecture'],
    codesign_identity=None,
    entitlements_file=None,
    icon=['frontend/Chronoloft.icns'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Chronoloft',
)
app = BUNDLE(
    coll,
    name='Chronoloft Update Test.app' if test_root else 'Chronoloft.app',
    icon='frontend/Chronoloft.icns',
    bundle_identifier=release_config['bundle_id'] + '.update-test' if test_root else release_config['bundle_id'],
    version=app_version,
    info_plist=bundle_info,
)
embed_sparkle(app.name, release_config)
