import { detectLanguage } from '../i18n/translate.js';

export const DEFAULT_SETTINGS = {
    language: detectLanguage(),
    autoFilterOnSelect: true,
    themeMode: 'system',
    layoutMode: 'one-column',
    recentDays: '14',
    recentLimit: '15',
    recentMinimum: '1',
    discordEnabled: true,
    recordSaveMode: 'auto',
};

const choices = {
    language: ['ja', 'en'], themeMode: ['system', 'light', 'dark'],
    layoutMode: ['one-column', 'two-column'], recentDays: ['7', '14', '30', 'all'],
    recentLimit: ['5', '15', '30', 'all'], recentMinimum: ['1', '5', '15', '30'],
    recordSaveMode: ['auto', 'confirm'],
};
const valid = (key, value) => key === 'deviceName'
    ? typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 80
    : key === 'autoFilterOnSelect' || key === 'discordEnabled'
        ? typeof value === 'boolean' : choices[key]?.includes(value);

function readCache() {
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        try {
            const value = JSON.parse(localStorage.getItem(`settings.${key}`));
            if (valid(key, value)) settings[key] = value;
        } catch (error) {
            console.error('保存済みの設定を読み込めませんでした。', error);
        }
    }
    try {
        const name = localStorage.getItem('chronoloft-device-name');
        if (valid('deviceName', name)) settings.deviceName = name;
    } catch (error) {
        console.error('保存済みの設定を読み込めませんでした。', error);
    }
    return settings;
}

let snapshot = { settings: readCache(), ready: false, local: null, error: '' };
let loading;
let timer;
let refreshing = false;
let writing = false;
let version = 0;
let saveQueue = Promise.resolve();
const listeners = new Set();

function publish(patch) {
    snapshot = { ...snapshot, ...patch };
    if (patch.settings) {
        try {
            for (const [key, value] of Object.entries(patch.settings)) {
                localStorage.setItem(key === 'deviceName' ? 'chronoloft-device-name' : `settings.${key}`,
                    key === 'deviceName' ? value : JSON.stringify(value));
            }
        } catch (error) {
            console.error('設定のキャッシュを保存できませんでした。', error);
        }
    }
    listeners.forEach(listener => listener());
}

async function request(path, method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(path, {
            method, signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'X-Chronoloft': '1' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '設定を読み込めませんでした。');
        return data;
    } catch (error) {
        if (controller.signal.aborted) throw new Error('設定の通信がタイムアウトしました。もう一度お試しください。');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export const getSettingsSnapshot = () => snapshot;

export async function loadSettings() {
    if (snapshot.ready && snapshot.local !== null) return snapshot;
    if (loading) return loading;
    loading = (async () => {
        const status = await request('/api/auth/status');
        if (status.local) {
            // 初回だけ既存値を取り込み、保存済みの共通設定を優先する。
            const data = await request('/api/settings/local', 'POST', {
                deviceName: '起動PC', ...readCache(),
            });
            publish({ settings: { ...DEFAULT_SETTINGS, ...data.settings }, ready: true, local: true, error: '' });
        } else {
            publish({ ready: true, local: false, error: '' });
        }
        return snapshot;
    })().catch(error => {
        publish({ ready: true, error: error.message });
        throw error;
    }).finally(() => { loading = null; });
    return loading;
}

export async function refreshSettings() {
    if (refreshing || writing) return;
    refreshing = true;
    const before = version;
    try {
        await loadSettings();
        if (!snapshot.local) return;
        const data = await request('/api/settings/local');
        // 保存開始より前の取得結果で、保存済みの値を巻き戻さない。
        if (before === version) publish({ settings: { ...DEFAULT_SETTINGS, ...data.settings }, error: '' });
    } catch (error) {
        publish({ error: error.message });
    } finally { refreshing = false; }
}

export function saveSettings(changes) {
    const operation = saveQueue.catch(() => {}).then(async () => {
        if (!Object.entries(changes).every(([key, value]) => valid(key, value))) {
            throw new Error('設定の項目または値が不正です。');
        }
        await loadSettings();
        if (!Object.keys(changes).length) return;
        version += 1;
        writing = true;
        try {
            const settings = snapshot.local
                ? (await request('/api/settings/local', 'PATCH', changes)).settings
                : { ...snapshot.settings, ...changes };
            publish({ settings: { ...DEFAULT_SETTINGS, ...settings }, error: '' });
        } finally { writing = false; }
    });
    saveQueue = operation;
    return operation;
}

function onStorage(event) {
    if (!snapshot.local && (event.key?.startsWith('settings.') || event.key === 'chronoloft-device-name' || event.key === null)) {
        publish({ settings: readCache() });
    }
}

export function subscribeSettings(listener) {
    listeners.add(listener);
    if (!timer) {
        loadSettings().catch(() => {});
        timer = setInterval(refreshSettings, 2000);
        window.addEventListener('focus', refreshSettings);
        window.addEventListener('storage', onStorage);
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size) {
            clearInterval(timer);
            timer = null;
            window.removeEventListener('focus', refreshSettings);
            window.removeEventListener('storage', onStorage);
        }
    };
}
