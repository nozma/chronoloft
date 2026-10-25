import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../services/settings.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export /g, '');

function client(server = {}, { saved = {}, local = true } = {}) {
    const storage = new Map(Object.entries(saved));
    const calls = [];
    const events = new Map();
    let intercept;
    let fail = false;
    let poll;
    const context = vm.createContext({
        detectLanguage: () => 'ja', Set, Promise, AbortController,
        console: { error() {} }, setTimeout, clearTimeout,
        setInterval: callback => { poll = callback; return 1; }, clearInterval: () => { poll = null; },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
        },
        window: {
            addEventListener: (name, callback) => events.set(name, callback),
            removeEventListener: name => events.delete(name),
        },
        fetch: async (path, options) => {
            calls.push([path, options]);
            if (fail) throw new Error('通信に失敗しました。');
            if (intercept) {
                const result = intercept(path, options);
                if (result) return result;
            }
            if (path === '/api/auth/status') return response({ local });
            assert.equal(path, '/api/settings/local');
            const data = options.body && JSON.parse(options.body);
            for (const [key, value] of Object.entries(data || {})) {
                if (options.method === 'PATCH' || !(key in server)) server[key] = value;
            }
            return response({ settings: { ...server } });
        },
    });
    vm.runInContext(source + '\nthis.api = { loadSettings, refreshSettings, saveSettings, subscribeSettings, getSettingsSnapshot };', context);
    return {
        ...context.api, storage, calls, events,
        get settings() { return context.api.getSettingsSnapshot().settings; },
        fail: value => { fail = value; }, intercept: value => { intercept = value; },
        poll: () => poll(),
    };
}

const response = data => ({ ok: true, json: async () => data });
const copy = value => JSON.parse(JSON.stringify(value));

test('既存設定を初回だけ取り込み、別ブラウザーの既定値で上書きしない', async () => {
    const server = {};
    const app = client(server, { saved: { 'settings.themeMode': '"dark"', 'settings.discordEnabled': 'false', 'chronoloft-device-name': '作業PC' } });
    await app.loadSettings();
    const browser = client(server);
    await browser.loadSettings();
    assert.equal(browser.settings.themeMode, 'dark');
    assert.equal(browser.settings.discordEnabled, false);
    assert.equal(browser.settings.deviceName, '作業PC');
    assert.equal(browser.storage.get('settings.themeMode'), '"dark"');
});

test('双方の変更を定期取得で反映し、変更していない項目は保持する', async () => {
    const server = {};
    const app = client(server);
    const browser = client(server);
    await Promise.all([app.loadSettings(), browser.loadSettings()]);
    await app.saveSettings({ themeMode: 'dark', discordEnabled: false });
    await browser.refreshSettings();
    assert.equal(browser.settings.themeMode, 'dark');
    assert.equal(browser.settings.discordEnabled, false);
    await browser.saveSettings({ language: 'en' });
    await app.refreshSettings();
    assert.equal(app.settings.language, 'en');
    assert.equal(app.settings.themeMode, 'dark');
    const writes = browser.calls.filter(([, options]) => options.method === 'PATCH');
    assert.deepEqual(JSON.parse(writes[0][1].body), { language: 'en' });
});

test('保存後の新しいプロセス相当でも共通保存先から全設定を復元する', async () => {
    const server = {};
    const app = client(server);
    await app.loadSettings();
    await app.saveSettings({ language: 'en', themeMode: 'dark', recordSaveMode: 'confirm', discordEnabled: false });
    const restarted = client(server);
    await restarted.loadSettings();
    assert.deepEqual(copy(restarted.settings), copy(app.settings));
});

test('LAN端末の変更はブラウザー内だけに保存し、起動PCに送らない', async () => {
    const server = { language: 'ja', themeMode: 'light' };
    const remote = client(server, { local: false, saved: { 'settings.language': '"en"' } });
    await remote.loadSettings();
    await remote.saveSettings({ themeMode: 'dark' });
    await remote.refreshSettings();
    assert.equal(remote.settings.language, 'en');
    assert.equal(remote.storage.get('settings.themeMode'), '"dark"');
    assert.deepEqual(server, { language: 'ja', themeMode: 'light' });
    assert.equal(remote.calls.some(([path]) => path === '/api/settings/local'), false);
});

test('遅い取得の応答で、後から保存した設定を巻き戻さない', async () => {
    const app = client();
    await app.loadSettings();
    let release;
    app.intercept((path, options) => {
        if (path === '/api/settings/local' && options.method === 'GET') {
            const old = copy(app.settings);
            return new Promise(resolve => { release = () => resolve(response({ settings: old })); });
        }
    });
    const pending = app.refreshSettings();
    await Promise.resolve();
    await app.saveSettings({ themeMode: 'dark' });
    release();
    await pending;
    assert.equal(app.settings.themeMode, 'dark');
});

test('保存に失敗したら成功扱いせず、値を保持して次の保存を受け付ける', async () => {
    const app = client();
    await app.loadSettings();
    app.fail(true);
    await assert.rejects(app.saveSettings({ themeMode: 'dark' }), /通信に失敗/);
    assert.equal(app.settings.themeMode, 'system');
    app.fail(false);
    await app.saveSettings({ themeMode: 'dark' });
    assert.equal(app.settings.themeMode, 'dark');
});

test('起動時の取得に失敗してもキャッシュを使え、接続回復後に共通設定を読み込む', async () => {
    const app = client({ themeMode: 'light' }, { saved: { 'settings.themeMode': '"dark"' } });
    app.fail(true);
    await assert.rejects(app.loadSettings());
    assert.equal(app.getSettingsSnapshot().ready, true);
    assert.equal(app.settings.themeMode, 'dark');
    app.fail(false);
    await app.loadSettings();
    assert.equal(app.settings.themeMode, 'light');
    assert.equal(app.getSettingsSnapshot().error, '');
});

test('キャッシュの1項目が壊れていても、残りの設定を引き継ぐ', async () => {
    const app = client({}, { saved: { 'settings.language': 'broken', 'settings.themeMode': '"dark"' } });
    await app.loadSettings();
    assert.equal(app.settings.language, 'ja');
    assert.equal(app.settings.themeMode, 'dark');
});

test('複数の購読でも初期化を共有し、最後の解除で定期取得を停止する', async () => {
    const app = client();
    const first = app.subscribeSettings(() => {});
    const second = app.subscribeSettings(() => {});
    await app.loadSettings();
    assert.equal(app.calls.filter(([path]) => path === '/api/auth/status').length, 1);
    assert.ok(app.events.has('focus'));
    first();
    assert.ok(app.events.has('focus'));
    second();
    assert.equal(app.events.size, 0);
});

test('LAN端末の別タブからの変更も反映する', async () => {
    const remote = client({}, { local: false });
    const unsubscribe = remote.subscribeSettings(() => {});
    await remote.loadSettings();
    remote.storage.set('settings.language', '"en"');
    remote.events.get('storage')({ key: 'settings.language' });
    assert.equal(remote.settings.language, 'en');
    unsubscribe();
});

test('Dock表示は再起動後も復元され、真偽値以外は保存しない', async () => {
    const server = {};
    const app = client(server);
    await app.loadSettings();
    assert.equal(app.settings.showDockIcon, false);
    await app.saveSettings({ showDockIcon: true });
    const restarted = client(server);
    await restarted.loadSettings();
    assert.equal(restarted.settings.showDockIcon, true);
    await assert.rejects(restarted.saveSettings({ showDockIcon: 'false' }));
});
