import React from 'react';
import { Box, Typography, Link, IconButton } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';

/**
 * 画面下部に配置するフッター。
 * - コピーライト表記
 * - GitHub リポジトリへの外部リンク
 *
 * Strict Mode でも問題ない純粋関数コンポーネント。
 */
function AppFooter() {
    const year = new Date().getFullYear();

    return (
        <Box
            component="footer"
            sx={{
                mt: 4,                 // 本文と分けるマージン
                py: 2,
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                fontSize: '0.8rem',
                color: 'text.secondary',
            }}
        >
            <Typography variant="body2" component="span">
                © {year} nozma
            </Typography>

            {/* GitHub へのリンク。新しいタブで開く */}
            <Link
                href="https://github.com/nozma/actyloft"
                target="_blank"
                rel="noopener"
                underline="hover"
                sx={{ display: 'flex', alignItems: 'center' }}
            >
                <IconButton size="small" sx={{ p: 0.5 }}>
                    <GitHubIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="body2" component="span">
                    GitHub
                </Typography>
            </Link>
            <Typography variant="caption" component="span" sx={{ ml: 1 }}>
                v{__APP_VERSION__}
            </Typography>
        </Box>
    );
}

export default AppFooter;