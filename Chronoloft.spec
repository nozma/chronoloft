# -*- mode: python ; coding: utf-8 -*-

import json
from pathlib import Path

# Finderと画面内のバージョンを、ルートのpackage.jsonに揃える。
app_version = json.loads((Path(SPECPATH) / 'package.json').read_text(encoding='utf-8'))['version']


a = Analysis(
    ['main.py'],
    pathex=[],
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
    target_arch=None,
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
    name='Chronoloft.app',
    icon='frontend/Chronoloft.icns',
    bundle_identifier=None,
    version=app_version,
    info_plist={'CFBundleVersion': app_version},
)
