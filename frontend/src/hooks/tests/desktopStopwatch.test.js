import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = transformSync(readFileSync(new URL('../../components/SharedStopwatches.jsx', import.meta.url), 'utf8'), {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;

function stopwatch({ panel = true, running = true, settingsError = false } = {}) {
    const writes = [];
    const starts = [];
    const errors = [];
    const effects = [];
    const ref = { current: null };
    const state = { ready: true, items: running ? [{ id: 'main', device_id: 'desktop', slot: 'main',
        activity_id: 1, discord_enabled: true, started_at: 1000 }] : [], device: { id: 'desktop', is_local: true } };
    const jsx = (type, props) => ({ type, props });
    const modules = {
        react: { forwardRef: fn => fn, useRef: value => ({ current: value }), useState: value => [value, next => errors.push(next)],
            useEffect: fn => effects.push(fn), useImperativeHandle: (target, fn) => { target.current = fn(); } },
        'react/jsx-runtime': { jsx, jsxs: jsx },
        '@mui/material': new Proxy({}, { get: (_, name) => name }),
        '@mui/material/styles': {},
        luxon: {},
        '../i18n/I18nContext': { useI18n: () => ({ t: value => value }) },
        '../hooks/useLocalStorageState': (key, value) => [value, () => {}],
        '../contexts/ActivityContext': { useActivities: () => ({ activities: [], refreshActivities() {} }) },
        '../contexts/ActiveActivityContext': { useActiveActivity: () => ({ setActiveActivity() {} }) },
        '../contexts/FilterContext': { useFilter: () => ({ setFilterState() {} }) },
        '../contexts/SettingsContext': { useSettings: () => ({ discordEnabled: false, recordSaveMode: 'auto' }) },
        '../services/stopwatches': {
            useSharedStopwatches: () => state, newStopwatchId: () => 'new-session',
            elapsedMilliseconds: () => 1000,
            operateStopwatch: async (...args) => writes.push(args),
            stopwatchRequest: async (...args) => starts.push(args),
        },
        '../utils/desktop': {
            desktopCommand: async () => {},
            desktopDiscordEnabled: async () => { if (settingsError) throw new Error('設定の取得失敗'); return false; },
        },
    };
    const context = vm.createContext({
        module: { exports: {} }, Date, setInterval() {}, clearInterval() {},
        document: {}, window: { addEventListener() {}, removeEventListener() {}, pywebview: { api: {} } },
        require: name => modules[name] ?? {},
    });
    vm.runInContext(source, context);
    context.module.exports.default({ desktopPanel: panel }, ref);
    effects.forEach(effect => effect());
    return { writes, starts, errors, start: () => ref.current.start({ id: 2, name: '読書' }) };
}

test('古い設定が残るパネルは、既存計測のDiscord設定を書き戻さない', () => {
    assert.equal(stopwatch().writes.length, 0);
    assert.equal(stopwatch({ panel: false }).writes.length, 1);
});

test('パネルからの新規開始は最新の公開設定を使用する', async () => {
    const panel = stopwatch({ running: false });
    await panel.start();
    assert.equal(panel.starts.length, 1);
    assert.equal(panel.starts[0][1].discord_enabled, false);
});

test('公開設定が取得できなければパネルから計測を開始しない', async () => {
    const panel = stopwatch({ running: false, settingsError: true });
    await panel.start();
    assert.equal(panel.starts.length, 0);
    assert.ok(panel.errors.includes('設定の取得失敗'));
});
