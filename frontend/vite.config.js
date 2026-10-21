/* eslint-env node */
/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from '../package.json'
import svgr from 'vite-plugin-svgr'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            jsxRuntime: 'automatic'
        }),
        svgr()
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5000',
                changeOrigin: true,
                secure: false,
                // LAN端末を起動元PCとして扱わないよう接続元を転送する。
                configure: proxy => {
                    proxy.on('proxyReq', (proxyReq, req) => {
                        const address = req.socket.remoteAddress || '';
                        proxyReq.setHeader('X-Chronoloft-Remote', address.replace(/^::ffff:/, ''));
                        proxyReq.setHeader('X-Chronoloft-Host', req.headers.host);
                    });
                },
            },
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(version),
        __COMMIT_HASH__: JSON.stringify(process.env.VITE_COMMIT_HASH || 'dev'),
    },
})

