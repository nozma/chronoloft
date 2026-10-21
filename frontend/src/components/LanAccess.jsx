import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, Box, Button, Collapse, FormControl, FormControlLabel, FormLabel, Stack, Switch, TextField, Typography } from '@mui/material';

import { saveDeviceAndLanSettings, useSharedStopwatches } from '../services/stopwatches';

async function authRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Chronoloft': '1', ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '通信に失敗しました。');
    return data;
}

export const LanSettings = forwardRef(function LanSettings({ disabled, onReadyChange }, ref) {
    const shared = useSharedStopwatches();
    const [settings, setSettings] = useState(null);
    const [enabled, setEnabled] = useState(false);
    const [password, setPassword] = useState('');
    const [name, setName] = useState(shared.device?.name || '');
    const [message, setMessage] = useState('');
    const [loaded, setLoaded] = useState(false);
    useEffect(() => { setName(shared.device?.name || ''); }, [shared.device?.name]);
    useEffect(() => {
        let cancelled = false;
        authRequest('/api/auth/status').then(async status => {
            const data = status.local ? await authRequest('/api/lan/settings') : null;
            if (cancelled) return;
            setSettings(data);
            setEnabled(data?.enabled || false);
            setLoaded(true);
        }).catch(error => { if (!cancelled) setMessage(error.message); });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        onReadyChange(loaded && shared.ready && !shared.busy);
        return () => onReadyChange(false);
    }, [loaded, shared.ready, shared.busy, onReadyChange]);
    useImperativeHandle(ref, () => ({
        save: async () => {
            if (!loaded) throw new Error('LAN設定の取得をお待ちください。');
            const result = await saveDeviceAndLanSettings({ name, settings, enabled, password });
            setSettings(result);
            setPassword('');
        },
    }));
    return <FormControl component="fieldset" fullWidth sx={{ minWidth: 0 }}>
        <FormLabel component="legend">LANアクセス</FormLabel>
        <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">端末名は、ほかの端末からストップウォッチを見分けるために使います。</Typography>
                <TextField label="この端末の名前" size="small" fullWidth value={name} disabled={disabled || !shared.device} inputProps={{ maxLength: 80 }} onChange={e => setName(e.target.value)} />
            </Stack>
            {settings && <Box>
                <FormControlLabel label="同じLAN内からのアクセスを許可" control={<Switch checked={enabled} disabled={disabled} onChange={e => { setEnabled(e.target.checked); setMessage(''); }} />} />
                <Collapse in={enabled}>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                        <TextField size="small" fullWidth label={settings.password_set ? '新しいパスワード（変更する場合のみ）' : 'LANアクセス用パスワード'} type="password" autoComplete="new-password" disabled={disabled} value={password} onChange={e => setPassword(e.target.value)} helperText="8〜256文字。他のサービスとは異なるパスワードを設定してください。" />
                        <Typography variant="body2" color="text.secondary">ログインは最後の利用から7日間保持されます。パスワード変更・LANアクセス無効化で全端末がログアウトします。HTTP通信は暗号化されません。</Typography>
                    </Stack>
                </Collapse>
                {settings.enabled && <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>別端末のブラウザーで開くURL</Typography>
                    {settings.urls.length ? settings.urls.map(url => <Typography variant="body2" key={url} sx={{ overflowWrap: 'anywhere' }}>{url}</Typography>) : <Typography variant="body2" color="text.secondary">起動PCのLAN内IPアドレスとポート番号でアクセスしてください。</Typography>}
                </Box>}
            </Box>}
            {message && <Alert severity="error">{message}</Alert>}
        </Stack>
    </FormControl>;
});

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
