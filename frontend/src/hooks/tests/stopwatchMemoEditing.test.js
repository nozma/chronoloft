import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createStopwatchDraft } from '../../utils/stopwatchDraft.js';

const source = transformSync(readFileSync(new URL('../../components/SharedStopwatches.jsx', import.meta.url), 'utf8') + '\nexport { SessionCard };', {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;

function harness() {
    const slots = [];
    let index = 0;
    let effects = [];
    let cleanups = [];
    const timers = new Map();
    let nextTimer = 0;
    const calls = [];
    const hook = initial => {
        const key = index++;
        if (!(key in slots)) slots[key] = initial;
        return key;
    };
    const jsx = (type, props) => ({ type, props });
    const modules = {
        react: {
            forwardRef: fn => fn,
            useState: initial => {
                const key = hook(initial);
                return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }];
            },
            useRef: initial => slots[hook({ current: initial })],
            useMemo: fn => fn(),
            useEffect: fn => effects.push(fn),
        },
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        '@mui/material': new Proxy({}, { get: (_, key) => key }),
        luxon: {},
        '../i18n/I18nContext': { useI18n: () => ({ t: value => value }) },
        '../contexts/RecordContext': { useRecords: () => ({ records: [] }) },
        '../contexts/SettingsContext': { useSettings: () => ({ recordSaveMode: 'auto' }) },
        '../contexts/GroupContext': { useGroups: () => ({ groups: [] }) },
        '../utils/recentMemoOptions': { getRecentMemoOptions: () => [] },
        '../utils/stopwatchDraft': { createStopwatchDraft },
        './Stopwatch': { StopwatchView: 'StopwatchView' },
        '../services/stopwatches': {
            elapsedMilliseconds: () => 0,
            operateStopwatch: async (base, action, data) => {
                calls.push({ action, data });
                return { item: { ...base, ...data, revision: base.revision + 1 } };
            },
        },
    };
    const context = vm.createContext({
        module: { exports: {} }, Date,
        require: name => modules[name] ?? {},
        setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
        clearTimeout: id => timers.delete(id),
    });
    vm.runInContext(source, context);
    const props = { item: { id: 'main', memo: '', revision: 1, started_at: 1 }, own: true,
        now: 1, busy: false, drafts: { current: {} }, run: fn => fn() };
    const findView = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'StopwatchView') return node.props;
        for (const child of [node.props?.children].flat()) {
            const found = findView(child);
            if (found) return found;
        }
    };
    return {
        calls,
        render() {
            cleanups.forEach(fn => fn?.());
            index = 0;
            effects = [];
            const tree = context.module.exports.SessionCard(props);
            cleanups = effects.map(fn => fn());
            return findView(tree);
        },
        async tick() {
            const pending = [...timers.values()];
            timers.clear();
            for (const fn of pending) await fn();
        },
    };
}

test('詳細欄にフォーカスがある間は待っても保存せず、離れた後に最新の入力を保存する', async () => {
    const h = harness();
    let view = h.render();
    view.onMemoFocus();
    view.controller.setMemo('入力途中');
    view = h.render();
    await h.tick();
    assert.equal(h.calls.length, 0);
    view.controller.setMemo('入力完了');
    view = h.render();
    await h.tick();
    assert.equal(h.calls.length, 0);
    view.onMemoBlur();
    h.render();
    await h.tick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].data.memo, '入力完了');
});

test('変換中にフォーカスが外れても、変換終了までは保存しない', async () => {
    const h = harness();
    let view = h.render();
    view.onMemoFocus();
    view.onMemoCompositionStart();
    view.controller.setMemo('へんかん');
    view.onMemoBlur();
    view = h.render();
    await h.tick();
    assert.equal(h.calls.length, 0);
    view.controller.setMemo('変換');
    view.onMemoCompositionEnd();
    h.render();
    await h.tick();
    assert.equal(h.calls[0].data.memo, '変換');
});

test('保存待ちの間に詳細欄へ戻ると、再描画前でも保存を止める', async () => {
    const h = harness();
    let view = h.render();
    view.controller.setMemo('下書き');
    view = h.render();
    view.onMemoFocus();
    await h.tick();
    assert.equal(h.calls.length, 0);
});
