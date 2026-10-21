import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';

async function authRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Chronoloft': '1', ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '通信に失敗しました。');
    return data;
}

export function LanSettings() {
    const [settings, setSettings] = useState(null);
    const [enabled, setEnabled] = useState(false);
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        authRequest('/api/auth/status').then(status => {
            if (status.local) return authRequest('/api/lan/settings').then(data => {
                setSettings(data);
                setEnabled(data.enabled);
            });
        }).catch(error => setMessage(error.message));
    }, []);
    if (!settings) return message ? <Alert severity="error">{message}</Alert> : null;
    return <Stack spacing={2}>
        <Typography variant="h6">LANアクセス</Typography>
        <FormControlLabel label="同じLAN内からのアクセスを許可" control={<Switch checked={enabled} onChange={e => setEnabled(e.target.checked)} />} />
        <TextField label={settings.password_set ? '新しいパスワード（変更する場合のみ）' : 'LANアクセス用パスワード'} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} helperText="8〜256文字。他のサービスとは異なるパスワードを設定してください。" />
        <Typography variant="body2">最後の利用から7日間ログインを保持します。パスワード変更・LANアクセス無効化で全端末がログアウトします。HTTP通信は暗号化されません。</Typography>
        <Button disabled={busy} variant="outlined" onClick={async () => {
            setBusy(true);
            try {
                const data = await authRequest('/api/lan/settings', { method: 'PUT', body: JSON.stringify({ enabled, password }) });
                setSettings(data);
                setPassword('');
                setMessage('LAN設定を保存しました。');
            } catch (error) { setMessage(error.message); }
            finally { setBusy(false); }
        }}>LAN設定を保存</Button>
        {message && <Alert severity={message === 'LAN設定を保存しました。' ? 'success' : 'error'}>{message}</Alert>}
        {settings.enabled && <Box>
            <Typography variant="body2">別端末のブラウザで開くURL：</Typography>
            {settings.urls.length ? settings.urls.map(url => <Typography key={url} sx={{ overflowWrap: 'anywhere' }}>{url}</Typography>) : <Typography variant="body2">起動PCのLAN内IPアドレスとポート番号でアクセスしてください。</Typography>}
        </Box>}
    </Stack>;
}

export default function LanAccess({ children }) {
    const [status, setStatus] = useState(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const check = useCallback(() => authRequest('/api/auth/status').then(data => {
        setStatus(data);
        setError('');
    }).catch(err => {
        setStatus({ authenticated: false });
        setError(err.message);
    }), []);
    useEffect(() => {
        check();
        const expired = () => setStatus({ authenticated: false });
        window.addEventListener('chronoloft-auth-required', expired);
        return () => window.removeEventListener('chronoloft-auth-required', expired);
    }, [check]);
    useEffect(() => {
        if (!status?.authenticated || status.local) return;
        let lastSent = 0;
        const renew = event => {
            if (event && !event.isTrusted) return;
            if (document.visibilityState !== 'visible' || Date.now() - lastSent < 60_000) return;
            lastSent = Date.now();
            authRequest('/api/auth/activity', { method: 'POST' }).catch(() => check());
        };
        renew();
        const events = ['pointerdown', 'keydown', 'scroll'];
        events.forEach(name => window.addEventListener(name, renew, { passive: true, capture: true }));
        return () => events.forEach(name => window.removeEventListener(name, renew, true));
    }, [status, check]);
    if (!status) return <Box sx={{ p: 4 }}>接続しています…</Box>;
    if (status.authenticated) return <>
        {!status.local && <Box sx={{ textAlign: 'right', p: 1 }}><Button onClick={async () => {
            await authRequest('/api/auth/logout', { method: 'POST' });
            setStatus({ authenticated: false });
        }}>ログアウト</Button></Box>}
        {children}
    </>;
    return <Box component="form" sx={{ maxWidth: 400, mx: 'auto', p: 4 }} onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
            await authRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
            setPassword('');
            await check();
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }}><Stack spacing={2}>
        <Typography variant="h5">Chronoloft</Typography>
        <Typography>LANアクセス用パスワードを入力してください。</Typography>
        <TextField label="パスワード" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" disabled={busy}>ログイン</Button>
    </Stack></Box>;
}
