import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createStopwatchDraft } from '../../utils/stopwatchDraft.js';

const source = transformSync(readFileSync(new URL('../../components/SharedStopwatches.jsx', import.meta.url), 'utf8') + '\nexport { SessionCard };', {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;

function harness({ deferSave = false } = {}) {
    const slots = [];
    let index = 0;
    let effects = [];
    let cleanups = [];
    const timers = new Map();
    let nextTimer = 0;
    const calls = [];
    let tree;
    let finishSave;
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
        './ConfirmDialog': { default: 'ConfirmDialog', __esModule: true },
        '../services/stopwatches': {
            elapsedMilliseconds: () => 0,
            operateStopwatch: async (base, action, data) => {
                calls.push({ action, data, revision: base.revision });
                if (action === 'edit' && deferSave) await new Promise(resolve => { finishSave = resolve; });
                assert.equal(base.revision, props.item.revision, '古い更新番号で操作しない');
                props.item = { ...base, ...data, revision: base.revision + 1 };
                return { item: props.item };
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
    const find = (node, type) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === type) return node.props;
        for (const child of [node.props?.children].flat()) {
            const found = find(child, type);
            if (found) return found;
        }
    };
    return {
        calls,
        dialog: () => find(tree, 'ConfirmDialog'),
        finishSave: () => finishSave(),
        render() {
            cleanups.forEach(fn => fn?.());
            index = 0;
            effects = [];
            tree = context.module.exports.SessionCard(props);
            cleanups = effects.map(fn => fn());
            return find(tree, 'StopwatchView');
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

test('詳細編集直後のキャンセル確認中は自動保存せず、OKで未保存の内容ごと計測を破棄する', async () => {
    const h = harness();
    let view = h.render();
    view.onMemoFocus();
    view.controller.setMemo('破棄する下書き');
    view = h.render();
    view.onMemoBlur();
    view = h.render();
    view.controller.cancel();
    await h.tick();
    h.render();
    assert.equal(h.calls.length, 0);
    assert.equal(h.dialog().open, true);
    await h.dialog().onConfirm();
    h.render();
    assert.equal(h.dialog().open, false);
    assert.deepEqual(h.calls, [{ action: 'cancel', data: undefined, revision: 1 }]);
});

test('キャンセル確認を取り消すと、保持した下書きの自動保存を再開する', async () => {
    const h = harness();
    let view = h.render();
    view.controller.setMemo('保持する下書き');
    view = h.render();
    view.controller.cancel();
    h.render();
    await h.tick();
    assert.equal(h.calls.length, 0);
    h.dialog().onCancel();
    h.render();
    await h.tick();
    assert.equal(h.dialog().open, false);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].action, 'edit');
    assert.equal(h.calls[0].data.memo, '保持する下書き');
});

test('既に自動保存の通信が始まっていたら、完了を待ち更新後の番号でキャンセルする', async () => {
    const h = harness({ deferSave: true });
    let view = h.render();
    view.controller.setMemo('保存中の下書き');
    view = h.render();
    const saving = h.tick();
    const opening = view.controller.cancel();
    h.render();
    assert.equal(h.dialog().open, false);
    h.finishSave();
    await saving;
    await opening;
    h.render();
    assert.equal(h.dialog().open, true);
    await h.dialog().onConfirm();
    assert.deepEqual(h.calls.map(({ action, revision }) => ({ action, revision })), [
        { action: 'edit', revision: 1 },
        { action: 'cancel', revision: 2 },
    ]);
});
