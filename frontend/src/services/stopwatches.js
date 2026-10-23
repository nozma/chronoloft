import { useSyncExternalStore } from 'react';
import { getSettingsSnapshot, loadSettings, saveSettings } from './settings';

export function newStopwatchId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let snapshot = { items: [], device: null, offset: 0, error: '', warning: '', migrationWarning: '', busy: false, ready: false };
const listeners = new Set();
let timer;
let loading = null;
let generation = 0;
let refreshSequence = 0;
let polling = false;
const publish = patch => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
};

async function request(path, body, method = 'POST') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const response = await fetch(path, {
            method,
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'X-Chronoloft': '1' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '通信に失敗しました。');
        return data;
    } catch (error) {
        if (controller.signal.aborted) throw new Error('通信の応答がありません。最新の計測状態を確認してから再試行してください。');
        throw error;
    } finally { clearTimeout(timeout); }

}

export async function refreshStopwatches() {
    const version = generation;
    const sequence = ++refreshSequence;
    const before = Date.now();
    const data = await request('/api/stopwatches', undefined, 'GET');
    if (version !== generation || sequence !== refreshSequence) return;
    const name = getSettingsSnapshot().settings.deviceName;
    const device = snapshot.device?.is_local && name ? { ...snapshot.device, name } : snapshot.device;
    publish({ items: data.items, device, offset: data.server_now - (before + Date.now()) / 2, error: '',
        warning: Object.values(data.discord_errors || {}).join(' ') });
}

async function initialize() {
    if (loading) return loading;
    loading = (async () => {
        const status = await request('/api/auth/status', undefined, 'GET');
        const settings = await loadSettings();
        let id = localStorage.getItem('chronoloft-device-id');
        if (!id) {
            id = newStopwatchId();
            localStorage.setItem('chronoloft-device-id', id);
        }
        const name = (status.local && settings.settings.deviceName)
            || localStorage.getItem('chronoloft-device-name') || (status.local ? '起動PC' : 'LAN端末');
        const device = await request(`/api/stopwatch-devices/${id}`, { name }, 'PUT');
        publish({ device });
        const migrationErrors = [];
        // 取り込みに同じIDを使い、通信失敗や複数タブによる重複を防ぐ。
        for (const [key, activityKey, slot] of [['stopwatchState', 'selectedActivity', 'main'], ['subStopwatchState', 'subSelectedActivity', 'sub']]) {
            let saved;
            let activity;
            try {
                saved = JSON.parse(localStorage.getItem(key) || 'null');
                activity = JSON.parse(localStorage.getItem(activityKey) || 'null');
            } catch { continue; }
            if (!saved || !activity || !(saved.startTime || saved.pausedStartTime)) continue;
            if (!saved.sessionId) {
                saved.sessionId = newStopwatchId();
                localStorage.setItem(key, JSON.stringify(saved));
            }
            try {
                await request('/api/stopwatches', {
                    id: saved.sessionId, device_id: id, slot, activity_id: activity.id,
                    started_at: saved.startTime || saved.pausedStartTime,
                    paused_at: saved.startTime ? null : saved.pausedStartTime + saved.displayTime,
                    memo: saved.memo || '', discord_enabled: device.is_local && slot === 'main' && localStorage.getItem('settings.discordEnabled') !== 'false',
                });
                localStorage.removeItem(key);
                localStorage.setItem(slot === 'main' ? 'stopwatchVisible' : 'subStopwatchVisible', 'false');
            } catch (error) {
                migrationErrors.push(`以前の${slot === 'main' ? 'メイン' : 'サブ'}計測を取り込めませんでした。元のデータはこのブラウザーに保持しています。${error.message}`);
            }
        }
        await refreshStopwatches();
        publish({ ready: true, error: '', migrationWarning: migrationErrors.join(' ') });
    })().catch(error => { publish({ error: error.message }); }).finally(() => { loading = null; });
    return loading;
}

const subscribe = listener => {
    listeners.add(listener);
    if (!timer) {
        initialize();
        timer = setInterval(() => {
            if (snapshot.busy || polling) return;
            polling = true;
            const task = snapshot.ready ? refreshStopwatches() : initialize();
            task.catch(error => publish({ error: error.message })).finally(() => { polling = false; });
        }, 3000);
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size) {
            clearInterval(timer);
            timer = null;
        }
    };
};

export function useSharedStopwatches() {
    const state = useSyncExternalStore(subscribe, () => snapshot);
    return state;
}

export async function stopwatchRequest(path, data, method) {
    if (snapshot.busy) throw new Error('操作の完了をお待ちください。');
    generation += 1;
    publish({ busy: true, error: '', warning: '' });
    try {
        const result = await request(path, data, method);
        // 保存の成功と、その後の一覧取得の失敗は分けて扱う。
        if (result.item) {
            const item = result.item;
            const items = snapshot.items.filter(previous => previous.id !== item.id);
            if (['running', 'confirming'].includes(item.status)) items.push(item);
            publish({ items });
        }
        await refreshStopwatches().catch(error => publish({ error: `操作は保存されましたが、最新状態の取得に失敗しました。${error.message}` }));
        if (result.discord_error) publish({ warning: result.discord_error });
        window.dispatchEvent(new Event('chronoloft:records-changed'));
        return result;
    } catch (error) {
        await refreshStopwatches().catch(() => {});
        publish({ error: error.message });
        throw error;
    } finally { publish({ busy: false }); }
}

export async function logoutDevice() {
    if (snapshot.busy) throw new Error('操作の完了をお待ちください。');
    if (!snapshot.ready || !snapshot.device) throw new Error('端末情報の取得をお待ちください。');
    generation += 1;
    publish({ busy: true });
    try {
        // 共有一覧を取り直し、この端末の計測だけを保存せず破棄する。
        const data = await request('/api/stopwatches', undefined, 'GET');
        for (const item of data.items.filter(item => item.device_id === snapshot.device.id)) {
            await request(`/api/stopwatches/${item.id}/cancel`, { revision: item.revision });
        }
        await request('/api/auth/logout');
        for (const key of ['stopwatchState', 'subStopwatchState', 'selectedActivity', 'subSelectedActivity', 'stopwatchVisible', 'subStopwatchVisible']) {
            localStorage.removeItem(key);
        }
        // 再ログイン時に以前の共有状態を表示しない。
        generation += 1;
        publish({ items: [], device: null, ready: false, error: '', warning: '', migrationWarning: '' });
    } catch (error) {
        await refreshStopwatches().catch(() => {});
        throw error;
    } finally { publish({ busy: false }); }
}

export const currentStopwatch = id => snapshot.items.find(item => item.id === id);

export const operateStopwatch = (item, action, data = {}) => stopwatchRequest(
    `/api/stopwatches/${item.id}/${action}`, { ...data, revision: item.revision });

export async function operateStopwatchWithDraft(saveDraft, action, data = {}) {
    return operateStopwatch(await saveDraft(), action, data);
}

export async function renameDevice(name) {
    let device;
    if (snapshot.device.is_local) {
        await saveSettings({ deviceName: name });
        device = { ...snapshot.device, name };
    } else {
        device = await stopwatchRequest(`/api/stopwatch-devices/${snapshot.device.id}`, { name }, 'PUT');
    }
    localStorage.setItem('chronoloft-device-name', device.name);
    publish({ device });
}

export async function saveDeviceAndLanSettings({ name, settings, enabled, password }) {
    const trimmedName = name.trim();
    if (!snapshot.ready || !snapshot.device) throw new Error('端末情報の取得をお待ちください。');
    if (!trimmedName || trimmedName.length > 80) throw new Error('端末名は1〜80文字で入力してください。');
    if (settings && password && (password.length < 8 || password.length > 256)) throw new Error('パスワードは8〜256文字で入力してください。');
    if (settings && enabled && !settings.password_set && !password) throw new Error('LANアクセス用パスワードを設定してください。');
    let savedSettings = settings;
    // 変更がある場合だけ保存し、通常設定の適用でLANログインを失効させない。
    if (settings && (enabled !== settings.enabled || password)) {
        savedSettings = await stopwatchRequest('/api/lan/settings', { enabled, password }, 'PUT');
    }
    if (trimmedName !== snapshot.device.name) await renameDevice(trimmedName);
    return savedSettings;
}

export function elapsedMilliseconds(item, now) {
    return Math.max(0, (item.paused_at ?? now) - item.started_at);
}

export function sharedLiveRecords(items, now) {
    return items.filter(item => item.slot === 'main').map(item => ({
        id: `live-${item.id}`, activity_id: item.activity_id, value: elapsedMilliseconds(item, now) / 60000,
        created_at: new Date(item.paused_at ?? now).toISOString().replace('Z', ''),
        unit: 'minutes', activity_name: item.activity_name, activity_group: item.activity_group,
        activity_group_id: item.activity_group_id, tags: item.tags, memo: item.memo,
        is_live: true, stopwatch_key: 'stopwatchState', session_id: item.id,
        server_session: item, is_paused: item.status === 'confirming',
    }));
}
