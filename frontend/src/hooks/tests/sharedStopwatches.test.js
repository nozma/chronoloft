import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync(new URL('../../services/stopwatches.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/export /g, '');

function harness(saved = {}, local = true) {
    const storage = new Map(Object.entries(saved));
    const calls = [];
    const items = [];
    let subscriber;
    let interval;
    let fail = false;
    let intercept = null;
    let timeoutCallback;
    const sharedSettings = { settings: {} };
    const context = vm.createContext({
        crypto: webcrypto, Date, Set, Promise, Event, AbortController,
        setTimeout: callback => { timeoutCallback = callback; return 1; }, clearTimeout() {},
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        window: { dispatchEvent() {} },
        useSyncExternalStore: (subscribe, get) => { subscriber ||= subscribe(() => {}); return get(); },
        loadSettings: async () => sharedSettings,
        getSettingsSnapshot: () => sharedSettings,
        saveSettings: async changes => {
            Object.assign(sharedSettings.settings, changes);
            calls.push(['/api/settings/local', { method: 'PATCH', body: JSON.stringify(changes) }]);
        },
        setInterval: callback => { interval = callback; return 1; }, clearInterval() {},
        fetch: async (path, options) => {
            calls.push([path, options]);
            if (intercept) {
                const response = intercept(path, options);
                if (response) return response;
            }
            if (fail === true || (typeof fail === 'function' && fail(path, options))) throw new Error('接続できません');
            const body = options.body && JSON.parse(options.body);
            let data;
            if (path === '/api/auth/status') data = { local, authenticated: true };
            else if (path.startsWith('/api/stopwatch-devices/')) data = { id: path.split('/').at(-1), name: body.name, is_local: local };
            else if (path === '/api/stopwatches' && options.method === 'GET') data = { items, server_now: Date.now() + 5000 };
            else if (path === '/api/stopwatches') {
                const item = { ...body, status: 'running', revision: 1 };
                items.push(item);
                data = { item };
            } else data = { item: { id: 'session' } };
            return { ok: true, json: async () => data };
        },
    });
    vm.runInContext(source + '\nthis.api = { logoutDevice, useSharedStopwatches, initialize, newStopwatchId, sharedLiveRecords, elapsedMilliseconds, operateStopwatch, operateStopwatchWithDraft, saveDeviceAndLanSettings, stopwatchRequest, refreshStopwatches, currentStopwatch, get: () => snapshot };', context);
    return { api: context.api, storage, calls, items, poll: () => interval(), fail: value => { fail = value; }, intercept: value => { intercept = value; }, timeout: () => timeoutCallback() };
}

test('端末IDはHTTP接続でも生成でき、同じブラウザーの再接続で保持する', async () => {
    const h = harness();
    await h.api.initialize();
    const id = h.api.get().device.id;
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await h.api.initialize();
    assert.equal(h.api.get().device.id, id);
    assert.ok(Math.abs(h.api.get().offset - 5000) < 100);
});

test('既存の確認中計測は同じID・開始時刻・メモで取り込む', async () => {
    const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const h = harness({ stopwatchState: JSON.stringify({ sessionId: id, startTime: null, pausedStartTime: 1000000, displayTime: 60000, memo: 'メモ' }), selectedActivity: JSON.stringify({ id: 2 }), 'settings.discordEnabled': 'false' });
    await h.api.initialize();
    assert.equal(h.items[0].id, id);
    assert.equal(h.items[0].started_at, 1000000);
    assert.equal(h.items[0].paused_at, 1060000);
    assert.equal(h.items[0].memo, 'メモ');
    assert.equal(h.items[0].discord_enabled, false);
    assert.equal(h.storage.has('stopwatchState'), false);
    await h.api.initialize();
    assert.equal(h.items.length, 1);
});

test('通信失敗では既存計測を消さず、取得の再試行で回復する', async () => {
    const h = harness({ stopwatchState: JSON.stringify({ startTime: 1000, memo: '' }), selectedActivity: JSON.stringify({ id: 2 }) });
    h.fail(true);
    await h.api.initialize();
    assert.equal(h.api.get().ready, false);
    assert.ok(h.storage.has('stopwatchState'));
    h.fail(false);
    await h.api.initialize();
    assert.equal(h.api.get().ready, true);
    assert.equal(h.items.length, 1);
});

test('LAN端末の既存計測ではDiscord連携を有効にしない', async () => {
    const h = harness({ stopwatchState: JSON.stringify({ startTime: 1000, memo: '' }), selectedActivity: JSON.stringify({ id: 2 }) }, false);
    await h.api.initialize();
    assert.equal(h.items[0].discord_enabled, false);
    assert.equal(h.api.get().device.is_local, false);
});

test('別端末への操作は対象の計測IDと取得時の更新番号を送る', async () => {
    const h = harness();
    await h.api.initialize();
    await h.api.operateStopwatch({ id: 'other-session', revision: 7 }, 'edit', { memo: '変更' });
    const [path, options] = h.calls.find(([path]) => path.endsWith('/other-session/edit'));
    assert.equal(path, '/api/stopwatches/other-session/edit');
    assert.deepEqual(JSON.parse(options.body), { revision: 7, memo: '変更' });
    assert.equal(options.headers['X-Chronoloft'], '1');
});

test('計測中グラフは端末別IDとサーバー状態を保持し、確認中の時間を固定する', () => {
    const h = harness();
    const items = [{ id: 'a', slot: 'main', started_at: 1000, paused_at: null, activity_id: 2, memo: 'A', status: 'running', revision: 3 },
        { id: 'b', slot: 'main', started_at: 1000, paused_at: 61000, activity_id: 2, memo: 'B', status: 'confirming', revision: 5 }];
    const records = h.api.sharedLiveRecords(items, 121000);
    assert.equal(records[0].value, 2);
    assert.equal(records[1].value, 1);
    assert.notEqual(records[0].id, records[1].id);
    assert.equal(records[1].is_paused, true);
    assert.equal(records[1].server_session.revision, 5);
});


test('旧計測の取り込み失敗でも元データを残し、サーバー側の計測を利用できる', async () => {
    const h = harness({ stopwatchState: JSON.stringify({ startTime: 1000, memo: '保持する' }), selectedActivity: JSON.stringify({ id: 2 }) });
    h.fail((path, options) => path === '/api/stopwatches' && options.method === 'POST');
    await h.api.initialize();
    assert.equal(h.api.get().ready, true);
    assert.match(h.api.get().migrationWarning, /元のデータ/);
    assert.ok(h.storage.has('stopwatchState'));
});


test('保存後の一覧取得に失敗しても保存成功を返し、操作中のままにならない', async () => {
    const h = harness();
    await h.api.initialize();
    h.fail((path, options) => path === '/api/stopwatches' && options.method === 'GET');
    const result = await h.api.stopwatchRequest('/api/stopwatches', { id: 'saved', activity_id: 2 });
    assert.equal(result.item.id, 'saved');
    assert.equal(h.api.get().busy, false);
    assert.equal(h.api.currentStopwatch('saved').revision, 1);
    assert.match(h.api.get().error, /操作は保存されました/);
});

test('古い一覧取得が後から完了しても最新状態を巻き戻さない', async () => {
    const h = harness();
    await h.api.initialize();
    let release;
    let reads = 0;
    h.intercept((path, options) => {
        if (path !== '/api/stopwatches' || options.method !== 'GET') return;
        reads += 1;
        if (reads === 1) return new Promise(resolve => { release = resolve; });
        return { ok: true, json: async () => ({ items: [{ id: 'new', revision: 2 }], server_now: Date.now() }) };
    });
    const slow = h.api.refreshStopwatches();
    await h.api.refreshStopwatches();
    release({ ok: true, json: async () => ({ items: [{ id: 'old', revision: 1 }], server_now: Date.now() }) });
    await slow;
    assert.equal(h.api.get().items[0].id, 'new');
});


test('未保存メモと開始時刻を続けて変更する場合は保存後の更新番号を使う', async () => {
    const h = harness();
    await h.api.initialize();
    const first = { id: 'draft-session', revision: 1, status: 'running' };
    h.intercept((path, options) => {
        if (path.endsWith('/draft-session/edit')) {
            const data = JSON.parse(options.body);
            return { ok: true, json: async () => ({ item: { ...first, revision: data.revision + 1 } }) };
        }
    });
    await h.api.operateStopwatchWithDraft(() => h.api.operateStopwatch(first, 'edit', { memo: '未保存メモ' }).then(result => result.item), 'edit', { started_at: 1234 });
    const operations = h.calls.filter(([path]) => path.endsWith('/draft-session/edit')).map(([, options]) => JSON.parse(options.body));
    assert.deepEqual(operations, [{ revision: 1, memo: '未保存メモ' }, { revision: 2, started_at: 1234 }]);
});


test('応答しない操作は打ち切り、操作中の状態を解除する', async () => {
    const h = harness();
    await h.api.initialize();
    h.intercept((path, options) => {
        if (path.endsWith('/hung/edit')) return new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
    });
    const pending = h.api.operateStopwatch({ id: 'hung', revision: 1 }, 'edit');
    h.timeout();
    await assert.rejects(pending, /通信の応答がありません/);
    assert.equal(h.api.get().busy, false);
});


test('定期取得が遅くても同じ取得を重ねて送信しない', async () => {
    const h = harness();
    await h.api.initialize();
    h.api.useSharedStopwatches();
    // 再購読時の初期化を完了させてから定期取得を調べる。
    await h.api.initialize();
    let release;
    let reads = 0;
    h.intercept((path, options) => {
        if (path === '/api/stopwatches' && options.method === 'GET') {
            reads += 1;
            return new Promise(resolve => { release = resolve; });
        }
    });
    h.poll();
    h.poll();
    assert.equal(reads, 1);
    release({ ok: true, json: async () => ({ items: [], server_now: Date.now() }) });
    await Promise.resolve();
});


test('設定変更がなければ適用時にも端末名やLAN設定を書き込まない', async () => {
    const h = harness();
    await h.api.initialize();
    h.calls.length = 0;
    await h.api.saveDeviceAndLanSettings({ name: h.api.get().device.name, settings: { enabled: false, password_set: false }, enabled: false, password: '' });
    assert.equal(h.calls.length, 0);
});

test('適用前の入力検証で失敗したら端末名とLAN設定の両方を書き込まない', async () => {
    const h = harness();
    await h.api.initialize();
    for (const data of [{ name: '', enabled: true, password: 'valid-password' }, { name: '新しい端末名', enabled: true, password: 'short' }, { name: '新しい端末名', enabled: true, password: '' }]) {
        h.calls.length = 0;
        await assert.rejects(h.api.saveDeviceAndLanSettings({ ...data, settings: { enabled: false, password_set: false } }));
        assert.equal(h.calls.length, 0);
    }
});

test('適用で変更されたLAN設定と端末名を保存する', async () => {
    const h = harness();
    await h.api.initialize();
    h.calls.length = 0;
    h.intercept((path) => {
        if (path === '/api/lan/settings') return { ok: true, json: async () => ({ enabled: true, password_set: true, urls: [] }) };
    });
    await h.api.saveDeviceAndLanSettings({ name: '作業PC', settings: { enabled: false, password_set: false }, enabled: true, password: 'valid-password' });
    const writes = h.calls.filter(([, options]) => options.method === 'PUT');
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0][1].body), { enabled: true, password: 'valid-password' });
    const settingsWrite = h.calls.find(([path]) => path === '/api/settings/local');
    assert.deepEqual(JSON.parse(settingsWrite[1].body), { deviceName: '作業PC' });
    assert.equal(h.api.get().device.name, '作業PC');
});


test('ログアウトでは自端末の稼働中・確認中計測だけを破棄して認証を終了する', async () => {
    const h = harness({}, false);
    await h.api.initialize();
    const device = h.api.get().device.id;
    h.storage.set('stopwatchState', '以前の計測');
    h.items.push({ id: 'main', device_id: device, revision: 2, status: 'running' },
        { id: 'sub', device_id: device, revision: 3, status: 'confirming' },
        { id: 'other', device_id: '別端末', revision: 1, status: 'running' });
    await h.api.logoutDevice();
    const operations = h.calls.filter(([path]) => path.endsWith('/cancel') || path === '/api/auth/logout');
    assert.deepEqual(operations.map(([path]) => path), ['/api/stopwatches/main/cancel', '/api/stopwatches/sub/cancel', '/api/auth/logout']);
    assert.equal(JSON.parse(operations[0][1].body).revision, 2);
    assert.equal(h.storage.has('stopwatchState'), false);
    assert.equal(h.api.get().ready, false);
    assert.equal(h.api.get().items.length, 0);
    assert.equal(h.storage.get('chronoloft-device-id'), device);
});

test('計測の破棄に失敗したらログアウトせず再試行できる', async () => {
    const h = harness({}, false);
    await h.api.initialize();
    h.items.push({ id: 'main', device_id: h.api.get().device.id, revision: 1 });
    h.fail(path => path.endsWith('/cancel'));
    await assert.rejects(h.api.logoutDevice(), /接続できません/);
    assert.equal(h.calls.some(([path]) => path === '/api/auth/logout'), false);
    assert.equal(h.api.get().busy, false);
    assert.equal(h.api.get().ready, true);
});
