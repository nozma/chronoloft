import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// DOMやDiscordを使わず、実際のフックを状態・副作用・通信の模擬環境で動かす。
const source = readFileSync(new URL('../useStopwatch.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default useStopwatch;', 'globalThis.useStopwatch = useStopwatch;');
const data = { group: 'study', activity_name: 'Reading', details: 'Book' };

function setup({ saved, enabled = true, start = async () => {}, stop = async () => {}, cryptoApi } = {}) {
    const slots = [];
    const effects = [];
    const intervals = new Map();
    const storage = new Map(saved ? [['stopwatchState', JSON.stringify(saved)]] : []);
    let index = 0;
    let dirty = false;
    let nextId = 0;
    const context = vm.createContext({
        useState(initial) {
            const key = index++;
            if (!(key in slots)) slots[key] = initial;
            return [slots[key], value => {
                const next = typeof value === 'function' ? value(slots[key]) : value;
                if (!Object.is(next, slots[key])) { slots[key] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const key = index++;
            return slots[key] ??= { current: initial };
        },
        useEffect(callback, deps) {
            const key = index++;
            const previous = slots[key];
            if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
                effects.push(() => {
                    previous?.cleanup?.();
                    slots[key] = { deps, cleanup: callback() };
                });
            }
        },
        useI18n: () => ({ t: value => value }),
        normalizeDetails: value => value || '',
        startDiscordPresence: start,
        stopDiscordPresence: stop,
        STOPWATCH_DETAILS_EVENT: 'details', STOPWATCH_SYNC_EVENT: 'sync',
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        window: { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
        CustomEvent: class {},
        crypto: cryptoApi ?? { randomUUID: () => `session-${++nextId}` },
        setInterval: (callback, ms) => { const id = ++nextId; intervals.set(id, { callback, ms }); return id; },
        clearInterval: id => intervals.delete(id),
        console: { log() {}, error() {} },
        Date,
    });
    vm.runInContext(source, context);
    let hook;
    function render() {
        do {
            dirty = false;
            index = 0;
            hook = context.useStopwatch('stopwatchState', data, { discordEnabled: enabled });
            while (effects.length) effects.shift()();
        } while (dirty);
    }
    render();
    return {
        get hook() { return hook; },
        setEnabled(value) { enabled = value; render(); },
        async flush() {
            for (let i = 0; i < 20; i++) { await Promise.resolve(); if (dirty) render(); }
        },
        tick() { for (const entry of intervals.values()) if (entry.ms === 15000) entry.callback(); },
        unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
}

test('LANのHTTP接続相当でrandomUUIDがなくても開始・切替・復元できる', async () => {
    const calls = [];
    const cryptoApi = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
    const app = setup({ cryptoApi, start: async value => calls.push(value) });
    await app.flush();
    assert.equal(app.hook.isRunning, true);
    const first = calls[0].session_id;
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await app.hook.finishAndReset({ ...data, group: 'exercise' });
    await app.flush();
    const second = calls.at(-1).session_id;
    assert.notEqual(second, first);
    assert.equal(app.hook.isRunning, true);
    app.unmount();

    const restored = setup({
        cryptoApi,
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: second },
        start: async value => calls.push(value),
    });
    await restored.flush();
    assert.equal(calls.at(-1).session_id, second);
    assert.equal(restored.hook.isRunning, true);
    restored.unmount();
});

test('稼働中の計測を復元し、同じセッションと開始時刻で連携を再開する', async () => {
    const calls = [];
    const app = setup({ saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved' }, start: async value => calls.push(value) });
    await app.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].session_id, 'saved');
    assert.equal(calls[0].start_time, 1234567890);
    assert.equal(app.hook.discordConnected, true);
    app.unmount();
});

test('接続失敗後も計測を継続し、定期更新で再接続する', async () => {
    let attempts = 0;
    const app = setup({ start: async () => { if (++attempts <= 1) throw Error('offline'); } });
    await app.flush();
    assert.equal(app.hook.isRunning, true);
    assert.equal(app.hook.discordConnected, false);
    app.tick();
    await app.flush();
    assert.equal(app.hook.discordConnected, true);
    app.unmount();
});

test('開始要求中に一時停止しても、開始完了後に必ず停止する', async () => {
    let release;
    const events = [];
    const app = setup({
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved' },
        start: async () => { events.push('start'); await new Promise(resolve => { release = resolve; }); },
        stop: async value => { events.push(`stop:${value.session_id}`); },
    });
    await app.flush();
    const paused = app.hook.pause();
    await app.flush();
    assert.deepEqual(events, ['start']);
    release();
    await paused;
    await app.flush();
    assert.deepEqual(events, ['start', 'stop:saved']);
    app.tick();
    await app.flush();
    assert.equal(events.length, 2);
    assert.equal(app.hook.isRunning, false);
    app.unmount();
});

test('停止中の計測を復元しても連携せず、再開時に接続する', async () => {
    const calls = [];
    const app = setup({ saved: { startTime: null, pausedStartTime: 1234567890000, displayTime: 1000, sessionId: 'saved' }, start: async value => calls.push(value) });
    await app.flush();
    assert.equal(calls.length, 0);
    await app.hook.resume();
    await app.flush();
    assert.ok(calls.length > 0);
    assert.equal(calls[0].session_id, 'saved');
    assert.equal(calls[0].start_time, 1234567890);
    app.unmount();
});

test('アクティビティ切替では旧連携を停止してから新セッションを開始する', async () => {
    const events = [];
    const app = setup({
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved' },
        start: async value => events.push({ type: 'start', ...value }),
        stop: async value => events.push({ type: 'stop', ...value }),
    });
    await app.flush();
    const switching = app.hook.finishAndReset({ ...data, group: 'exercise' });
    await app.flush();
    await switching;
    await app.flush();
    assert.equal(events[1].type, 'stop');
    assert.equal(events[1].group, 'study');
    assert.equal(events[1].session_id, 'saved');
    assert.equal(events[2].type, 'start');
    assert.equal(events[2].group, 'exercise');
    assert.notEqual(events[2].session_id, 'saved');
    app.unmount();
});

test('復元・再接続・定期更新で旧データや入力欄の詳細をDiscordへ送らない', async () => {
    const calls = [];
    const app = setup({ saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved', memo: 'Updated' }, start: async value => calls.push(value) });
    await app.flush();
    app.hook.setMemo('Private edit');
    await app.flush();
    await app.hook.refreshDiscord();
    await app.flush();
    app.tick();
    await app.flush();
    assert.equal(app.hook.memo, 'Private edit');
    assert.ok(calls.length >= 3);
    for (const call of calls) {
        assert.equal(Object.hasOwn(call, 'details'), false);
        assert.equal(Object.hasOwn(call, 'memo'), false);
        assert.equal(call.activity_name, 'Reading');
    }
    app.unmount();
});

test('設定OFFで連携と定期更新を停止し、ONで同じ計測の連携を再開する', async () => {
    const events = [];
    const app = setup({
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved', memo: 'Keep' },
        start: async value => events.push({ type: 'start', ...value }),
        stop: async value => events.push({ type: 'stop', ...value }),
    });
    await app.flush();
    app.setEnabled(false);
    await app.flush();
    assert.equal(events.at(-1).type, 'stop');
    assert.equal(events.at(-1).session_id, 'saved');
    assert.equal(app.hook.isRunning, true);
    assert.equal(app.hook.currentStartTime, 1234567890000);
    assert.equal(app.hook.memo, 'Keep');
    assert.equal(app.hook.discordConnected, false);
    const count = events.length;
    app.tick();
    await app.hook.refreshDiscord();
    await app.flush();
    assert.equal(events.length, count);
    app.setEnabled(true);
    await app.flush();
    assert.equal(events.at(-1).type, 'start');
    assert.equal(events.at(-1).session_id, 'saved');
    assert.equal(events.at(-1).start_time, 1234567890);
    assert.equal(app.hook.discordConnected, true);
    app.unmount();
});

test('設定OFFで開始した計測も、ONに切り替えると連携する', async () => {
    const calls = [];
    const app = setup({ enabled: false, start: async value => calls.push(value) });
    await app.flush();
    assert.equal(calls.length, 0);
    assert.equal(app.hook.isRunning, true);
    const startTime = app.hook.currentStartTime;
    app.setEnabled(true);
    await app.flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].start_time, startTime / 1000);
    app.unmount();
});

test('通信中にOFF・ONを切り替えても、開始・停止・再接続の順で実行する', async () => {
    const events = [];
    let release;
    let first = true;
    const app = setup({
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved' },
        start: async () => {
            events.push('start');
            if (first) { first = false; await new Promise(resolve => { release = resolve; }); }
        },
        stop: async () => events.push('stop'),
    });
    await app.flush();
    app.setEnabled(false);
    app.setEnabled(true);
    await app.flush();
    release();
    await app.flush();
    assert.deepEqual(events, ['start', 'stop', 'start']);
    assert.equal(app.hook.discordConnected, true);
    app.unmount();
});

test('一時停止中に設定ONにしても連携せず、計測再開時に接続する', async () => {
    const calls = [];
    const app = setup({ enabled: false, saved: { startTime: null, pausedStartTime: 1234567890000, displayTime: 1000, sessionId: 'saved' }, start: async value => calls.push(value) });
    await app.flush();
    app.setEnabled(true);
    await app.flush();
    assert.equal(calls.length, 0);
    await app.hook.resume();
    await app.flush();
    assert.ok(calls.length > 0);
    app.unmount();
});

test('開始通信中に設定OFFにすると、通信完了後に解除して再接続しない', async () => {
    let release;
    const events = [];
    const app = setup({
        saved: { startTime: 1234567890000, displayTime: 0, sessionId: 'saved' },
        start: async () => { events.push('start'); await new Promise(resolve => { release = resolve; }); },
        stop: async () => events.push('stop'),
    });
    await app.flush();
    app.setEnabled(false);
    await app.flush();
    release();
    await app.flush();
    app.tick();
    await app.flush();
    assert.deepEqual(events, ['start', 'stop']);
    assert.equal(app.hook.discordConnected, false);
    assert.equal(app.hook.isRunning, true);
    app.unmount();
});
