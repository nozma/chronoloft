import { useI18n } from '../i18n/I18nContext';
import { IconButton, Tooltip } from '@mui/material';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';

/**
 * 「Open in Browser」ボタンを表示し、
 * PyWebView API経由でブラウザを開くためのコンポーネント
 */
function OpenBrowserButton() {
    const { t } = useI18n();
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
        <Tooltip title={t("Open in Browser")}>
            <IconButton aria-label={t("Open in Browser")} onClick={handleOpenBrowser}>
                <OpenInBrowserIcon />
            </IconButton>
        </Tooltip>
    );
}

export default OpenBrowserButton;
