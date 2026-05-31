# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

block_cipher = None

PROJECT_ROOT = Path(SPECPATH)
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

a = Analysis(
    [str(PROJECT_ROOT / "backend" / "main.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=[
        (str(FRONTEND_DIST), "frontend/dist"),
    ],
    hiddenimports=[
        "webview",
        "webview.platforms",
        "webview.platforms.cocoa",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "tkinter",
        "matplotlib",
        "numpy",
        "PIL",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AirCode",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AirCode",
)

app = BUNDLE(
    coll,
    name="AirCode.app",
    icon=str(PROJECT_ROOT / "release" / "icon.icns"),
    bundle_identifier="com.aircode.app",
    version="0.1.0",
    info_plist={
        "CFBundleName": "AirCode",
        "CFBundleDisplayName": "AirCode",
        "CFBundleVersion": "0.1.0",
        "CFBundleShortVersionString": "0.1.0",
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
