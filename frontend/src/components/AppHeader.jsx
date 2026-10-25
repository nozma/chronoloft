import { useI18n } from '../i18n/I18nContext';
// frontend/src/components/AppHeader.jsx
import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { LogoutButton } from './LanAccess';
import OpenBrowserButton from './OpenBrowserButton';
import AppIcon from '../../favicon.svg?react'
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsDialog from './SettingsDialog';

/**
 * アプリのヘッダー部分。
 *  - アプリタイトル
 *  - 「Open in Browser」ボタン
 * などを配置するレイアウト用コンポーネント
 */
function AppHeader() {
    const { t } = useI18n();
    const [settingsOpen, setSettingsOpen] = useState(false);
    useEffect(() => {
        const openSettings = () => setSettingsOpen(true);
        window.addEventListener('chronoloft:open-settings', openSettings);
        return () => window.removeEventListener('chronoloft:open-settings', openSettings);
    }, []);

    return (
        <Box
            component="header"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                p: { xs: 1, sm: 2 },
                flexWrap: 'wrap',
                gap: 1,
                borderColor: 'divider',
                // ダークモードかライトモードかで背景色を切り替え
                backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.15)' // ダーク時背景
                        : 'rgba(0,0,0,0.04)',      // ライト時背景
            }}
        >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
            <AppIcon style={{ width:32, height:32 }}/>
            <Typography variant="h5">Chronoloft</Typography>
            <Typography variant="caption" color="text.secondary">
                v{__APP_VERSION__}
            </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                <OpenBrowserButton />
                <LogoutButton />
                <Tooltip title={t("App Settings")}>
                    <IconButton aria-label={t("App Settings")} onClick={() => setSettingsOpen(true)}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <SettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </Box>
    );
}

export default AppHeader;
