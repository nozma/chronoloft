// frontend/src/components/AppHeader.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import OpenBrowserButton from './OpenBrowserButton';

/**
 * アプリのヘッダー部分。
 *  - アプリタイトル
 *  - 「Open in Browser」ボタン
 * などを配置するレイアウト用コンポーネント
 */
function AppHeader() {
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
    </Box>
  );
}

export default AppHeader;