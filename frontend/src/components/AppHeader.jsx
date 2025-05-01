// frontend/src/components/AppHeader.jsx
import { useState } from 'react';
import { Box, Typography, Menu, MenuItem, IconButton } from '@mui/material';
import { clearUiSettings } from '../utils/storageReset';
import OpenBrowserButton from './OpenBrowserButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsDialog from './SettingsDialog';

/**
 * アプリのヘッダー部分。
 *  - アプリタイトル
 *  - 「Open in Browser」ボタン
 * などを配置するレイアウト用コンポーネント
 */
function AppHeader() {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <Box
            component="header"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                p: 2,
                borderColor: 'divider',
                // ダークモードかライトモードかで背景色を切り替え
                backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.15)' // ダーク時背景
                        : 'rgba(0,0,0,0.04)',      // ライト時背景
            }}
        >
            <Typography variant="h5">Actyloft</Typography>
            <OpenBrowserButton />
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MoreVertIcon />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem
                    onClick={() => {
                        setSettingsOpen(true);     // モーダルを開く
                        setAnchorEl(null);         // メニューは閉じる
                    }}
                >
                    Settings
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (confirm('All UI settings will be cleared. Continue?')) {
                            clearUiSettings();
                            location.reload();
                        }
                    }}
                >
                    Reset UI Settings
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