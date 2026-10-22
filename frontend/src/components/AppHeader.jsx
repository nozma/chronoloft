import { useI18n } from '../i18n/I18nContext';
// frontend/src/components/AppHeader.jsx
import { useState } from 'react';
import { Box, Typography, Menu, MenuItem, IconButton } from '@mui/material';
import { LogoutButton } from './LanAccess';
import OpenBrowserButton from './OpenBrowserButton';
import AppIcon from '../../favicon.svg?react'
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsDialog from './SettingsDialog';
import { clearUiSettings } from '../utils/storageReset';

/**
 * アプリのヘッダー部分。
 *  - アプリタイトル
 *  - 「Open in Browser」ボタン
 * などを配置するレイアウト用コンポーネント
 */
function AppHeader() {
    const { t } = useI18n();
    const [anchorEl, setAnchorEl] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const menuOpen = Boolean(anchorEl);

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
                <IconButton aria-label={t("Settings")} onClick={(e) => setAnchorEl(e.currentTarget)}>
                    <MoreVertIcon />
                </IconButton>
            </Box>
            <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                transformOrigin={{ horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        setSettingsOpen(true);
                        setAnchorEl(null);
                    }}
                >
                    {t("Settings")}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (confirm(t("All UI settings will be cleared. Continue?"))) {
                            clearUiSettings();
                            location.reload();
                        }
                    }}
                >
                    {t("Reset UI Settings")}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        location.reload();
                    }}
                >
                    {t("Reload")}
                </MenuItem>
            </Menu>
            <SettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </Box>
    );
}

export default AppHeader;
