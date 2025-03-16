import React from 'react';
import { Button } from '@mui/material';

/**
 * 「Open in Browser」ボタンを表示し、
 * PyWebView API経由でブラウザを開くためのコンポーネント
 */
function OpenBrowserButton() {
    // pywebview上でのみ描画する
    if (
        typeof window === 'undefined' ||
        !window.pywebview ||
        !window.pywebview.api ||
        !window.pywebview.api.open_in_browser
    ) {
        return null;
    }

    const handleOpenBrowser = () => {
        if (window.pywebview?.api?.open_in_browser) {
            window.pywebview.api.open_in_browser();
        } else {
            console.warn("PyWebView API is not available.");
        }
    };

    return (
        <Button variant="contained" onClick={handleOpenBrowser}>
            Open in Browser
        </Button>
    );
}

export default OpenBrowserButton;