import { isValidReading } from '../../utils/activitySearch.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { DateTime } from 'luxon';
import { createStopwatchDraft } from '../../utils/stopwatchDraft.js';
import { normalizeDetails } from '../../utils/recordDetails.js';
import { getRecordStart, formatPreciseLocalTime } from '../../utils/recordTime.js';

function dialogHarness(file, props, { exportName = 'default', modules: overrides = {} } = {}) {
    const slots = [];
    const effects = [];
    let index = 0;
    let dirty = false;
    let tree;
    const hooks = {
        forwardRef: fn => fn,
        useState(initial) {
            const key = index++;
            if (!(key in slots)) slots[key] = initial;
            return [slots[key], value => {
                const next = typeof value === 'function' ? value(slots[key]) : value;
                if (!Object.is(slots[key], next)) { slots[key] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const key = index++;
            return slots[key] ??= { current: initial };
        },
        useMemo: fn => fn(),
        useImperativeHandle() {},
        useEffect(callback, deps) {
            const key = index++;
            if (!deps || !slots[key] || deps.some((value, i) => !Object.is(value, slots[key][i]))) {
                slots[key] = deps;
                effects.push(callback);
            }
        },
    };
    const jsx = (type, props) => ({ type, props });
    const modules = {
        react: hooks,
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        '@mui/material': new Proxy({}, { get: (_, name) => name }),
        luxon: { DateTime },
        '../i18n/I18nContext': { useI18n: () => ({ t: key => key }) },
        '../contexts/SettingsContext': { useSettings: () => ({ isMobile: false, recordSaveMode: 'auto' }) },
        '../contexts/ActivityContext': { useActivities: () => ({ activities: [props.activity] }) },
        '../contexts/RecordContext': { useRecords: () => ({ records: [] }) },
        '../contexts/GroupContext': { useGroups: () => ({ groups: [] }) },
        '../contexts/TagContext': { useTags: () => ({ tags: [] }) },
        '../utils/recentMemoOptions': { getRecentMemoOptions: () => [] },
        '../utils/getIconForGroup': { default: () => null, __esModule: true },
        '../utils/recordDetails': { normalizeDetails },
        '../utils/recordTime': { getRecordStart, formatPreciseLocalTime },
        '../utils/stopwatchDraft': { createStopwatchDraft },
        './Stopwatch': { StopwatchView: 'StopwatchView' },
        './ConfirmDialog': { default: 'ConfirmDialog', __esModule: true },
        ...overrides,
    };
    const context = vm.createContext({
        module: { exports: {} }, Date, setTimeout: () => 0, clearTimeout() {}, console,
        require: name => modules[name] ?? (name.startsWith('@mui/') ? name.split('/').at(-1) : {}),
    });
    const source = readFileSync(new URL(`../../components/${file}.jsx`, import.meta.url), 'utf8')
        + (exportName === 'SessionCard' ? '\nexport { SessionCard };' : '');
    vm.runInContext(transformSync(source, { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code, context);
    function render(changes = {}) {
        Object.assign(props, changes);
        do {
            dirty = false;
            index = 0;
            tree = context.module.exports[exportName](props);
            while (effects.length) effects.shift()();
        } while (dirty);
    }
    function findAll(type) {
        const found = [];
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) node.forEach(visit);
            else {
                if (node.type === type) found.push(node.props);
                visit(node.props?.children);
            }
        };
        visit(tree);
        return found;
    }
    function find(type, predicate = () => true) {
        const result = findAll(type).find(predicate);
        assert.ok(result, type);
        return result;
    }
    render();
    return { render, find, findAll, change(label, value) {
        find('TextField', field => field.label === label).onChange({ target: { value } });
        render();
    } };
}

test('FILLで保存した秒以下は再編集して詳細だけを変更しても維持する', async () => {
    const saved = [];
    const props = {
        open: true, activity: { id: 1, unit: 'minutes' }, initialValue: 10,
        initialDate: '2026-11-06T01:30:22.916Z', onClose() {},
        onSubmit: data => saved.push(data),
    };
    const previousEnd = '2026-11-06T01:00:58.027Z';
    const ui = dialogHarness('AddRecordDialog', props, { modules: {
        '../contexts/RecordContext': { useRecords: () => ({ records: [
            { id: 1, created_at: previousEnd, value: 10 },
        ] }) },
    } });
    ui.find('Button', button => button.children === 'FILL').onClick();
    ui.render();
    await ui.find('Button', button => button.children === 'Submit').onClick();
    const original = saved[0];
    const edit = dialogHarness('AddRecordDialog', { ...props, isEdit: true,
        initialDate: original.created_at, initialValue: original.value });
    assert.equal(DateTime.fromISO(edit.find('TextField', field => field.label === 'Start time').value).toUTC().toISO(), previousEnd);
    edit.find('Autocomplete').onInputChange(null, '詳細だけ変更');
    edit.render();
    await edit.find('Button', button => button.children === 'Submit').onClick();
    assert.equal(saved[1].created_at, original.created_at);
    assert.equal(saved[1].value, original.value);
    assert.equal(saved[1].memo, '詳細だけ変更');
});

test('マイクロ秒を含む記録も詳細だけの編集では保存済みの時刻と時間を維持する', async () => {
    const initialDate = '2026-11-06T03:01:11.994900Z';
    const initialValue = 121.199915;
    const saved = [];
    const ui = dialogHarness('AddRecordDialog', {
        open: true, isEdit: true, activity: { id: 1, unit: 'minutes' },
        initialDate, initialValue, onClose() {}, onSubmit: data => saved.push(data),
    });
    assert.equal(DateTime.fromISO(ui.find('TextField', field => field.label === 'Start time').value).toUTC().toISO(), '2026-11-06T01:00:00.000Z');
    ui.find('Autocomplete').onInputChange(null, '時刻は変更しない');
    ui.render();
    await ui.find('Button', button => button.children === 'Submit').onClick();
    assert.equal(saved[0].created_at, initialDate);
    assert.equal(saved[0].value, initialValue);
    ui.change('Start time', formatPreciseLocalTime(DateTime.fromISO('2026-11-06T01:01:00Z').toLocal()));
    await ui.find('Button', button => button.children === 'Submit').onClick();
    assert.equal(saved[1].created_at, '2026-11-06T03:01:11.994Z');
    assert.equal(saved[1].value, 120.1999);
});

test('終了FILLは次の記録のマイクロ秒を考慮して開始時刻を復元する', () => {
    const ui = dialogHarness('AddRecordDialog', {
        open: true, activity: { id: 1, unit: 'minutes' }, initialValue: 10,
        initialDate: '2026-11-06T00:45:00Z', onClose() {}, onSubmit() {},
    }, { modules: {
        '../contexts/RecordContext': { useRecords: () => ({ records: [
            { id: 1, created_at: '2026-11-06T03:01:11.994900Z', value: 121.199915 },
        ] }) },
    } });
    ui.findAll('Button').filter(button => button.children === 'FILL')[1].onClick();
    ui.render();
    assert.equal(DateTime.fromISO(ui.find('TextField', field => field.label === 'End time').value).toUTC().toISO(), '2026-11-06T01:00:00.000Z');
});

test('既存の削除確認はタイトル・確認・キャンセルを維持し、通知はOKだけで閉じる', () => {
    const calls = [];
    const ui = dialogHarness('ConfirmDialog', { open: true, title: '削除確認', content: '本文',
        onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
    assert.equal(ui.find('DialogTitle').children, '削除確認');
    assert.equal(ui.find('DialogContent').children, '本文');
    ui.find('Button', button => button.children === 'Cancel').onClick();
    ui.find('Button', button => button.children === 'Confirm').onClick();
    ui.find('Dialog').onClose();
    assert.deepEqual(calls, ['cancel', 'confirm', 'cancel']);
    ui.render({ title: undefined, onCancel: undefined, confirmLabel: 'OK' });
    assert.equal(ui.findAll('DialogTitle').length, 0);
    assert.equal(ui.findAll('Button').length, 1);
    assert.equal(ui.find('Button').children, 'OK');
    ui.find('Button').onClick();
    ui.find('Dialog').onClose();
    assert.deepEqual(calls.slice(3), ['confirm', 'confirm']);
});

for (const { unit, field, invalid, message } of [
    { unit: 'count', field: 'Count', invalid: '-1', message: 'Enter a valid count.' },
    { unit: 'count', field: 'Recorded at', invalid: '', message: 'Invalid date and time.' },
    { unit: 'minutes', field: 'Start time', invalid: '', message: 'Invalid start or end time.' },
    { unit: 'minutes', field: 'Start time', invalid: '2026-10-26T12:00', message: 'Start time must not be later than end time.' },
]) {
    test(`記録入力の「${message}」はOKまで待ち、保存せず入力を保持する`, async () => {
        const saves = [];
        let closes = 0;
        const ui = dialogHarness('AddRecordDialog', { open: true, activity: { id: 1, unit }, initialValue: 2,
            initialDate: '2026-10-26T01:00:00Z', initialMemo: '詳細',
            onSubmit: data => saves.push(data), onClose: () => closes++ });
        // 実行環境のタイムゾーンに依存しない入力値に揃える。
        ui.change(unit === 'count' ? 'Recorded at' : 'End time', '2026-10-26T10:00');
        if (unit === 'minutes') ui.change('Start time', '2026-10-26T09:00');
        ui.change(field, invalid);
        let settled = false;
        const result = ui.find('Button', button => button.children === 'Submit').onClick().then(value => {
            settled = true;
            return value;
        });
        ui.render();
        await Promise.resolve();
        assert.equal(settled, false);
        assert.equal(ui.find('ConfirmDialog').content, message);
        assert.equal(ui.find('ConfirmDialog').open, true);
        assert.equal(saves.length, 0);
        assert.equal(closes, 0);
        ui.find('ConfirmDialog').onConfirm();
        assert.equal(await result, false);
        ui.render();
        assert.equal(ui.find('ConfirmDialog').open, false);
        assert.equal(ui.find('TextField', input => input.label === field).value, invalid);
        assert.equal(ui.find('Button', button => button.children === 'Submit').disabled, false);
        ui.change(field, unit === 'count' && field === 'Count' ? '3' : '2026-10-26T09:00');
        assert.equal(await ui.find('Button', button => button.children === 'Submit').onClick(), true);
        assert.equal(saves.length, 1);
        assert.equal(saves[0].memo, '詳細');
        assert.equal(closes, 1);
    });
}

test('計測キャンセルは取り消しでは実行せず、OKで確認開始時の対象へ元の処理を実行する', async () => {
    const calls = [];
    const item = { id: 'main', device_name: 'Mac', activity_name: '読書', memo: '', revision: 7, started_at: 1 };
    const ui = dialogHarness('SharedStopwatches', { item, own: true, now: 1, drafts: { current: {} }, run: fn => fn() }, {
        exportName: 'SessionCard', modules: { '../services/stopwatches': {
            elapsedMilliseconds: () => 0,
            operateStopwatch: async (...args) => calls.push(args),
        } },
    });
    ui.find('StopwatchView').controller.cancel();
    ui.render();
    assert.equal(ui.find('ConfirmDialog').content, 'Mac の「読書」をキャンセルしますか？');
    assert.equal(calls.length, 0);
    ui.find('ConfirmDialog').onCancel();
    ui.render();
    assert.equal(ui.find('ConfirmDialog').open, false);
    assert.equal(calls.length, 0);
    ui.find('StopwatchView').controller.cancel();
    ui.render({ item: { ...item, revision: 8 } });
    await ui.find('ConfirmDialog').onConfirm();
    ui.render();
    assert.equal(ui.find('ConfirmDialog').open, false);
    assert.deepEqual(calls, [[item, 'cancel']]);
});

test('StopwatchViewの開始時刻エラーは元のメッセージを表示し、閉じても操作を再実行しない', () => {
    let updates = 0;
    const controller = { displayTime: 0, memo: '', updateStartTime: () => {
        updates++;
        throw new Error('元のエラーメッセージ');
    } };
    const ui = dialogHarness('Stopwatch', { inlineMode: true, controller }, {
        exportName: 'StopwatchView',
    });
    ui.find('TextField', input => input.type === 'datetime-local').onChange({ target: { value: '2026-10-26T10:00' } });
    ui.render();
    assert.equal(ui.find('ConfirmDialog').content, '元のエラーメッセージ');
    assert.equal(ui.find('ConfirmDialog').open, true);
    ui.find('ConfirmDialog').onConfirm();
    ui.render();
    assert.equal(ui.find('ConfirmDialog').open, false);
    assert.equal(updates, 1);
});


test('よみがなのIME変換中に閉じても、再表示後は保存できる', () => {
    const ui = dialogHarness('AddActivityDialog', { open: true, onClose() {}, onSubmit() {},
        initialData: { name: '読書', group_id: 1, reading: 'どくしょ', is_active: true } }, {
        modules: {
            '@mui/material/styles': { useTheme: () => ({ palette: { text: { primary: '#000' } } }) },
            '../utils/activitySearch': { isValidReading },
        },
    });
    ui.find('TextField', field => field.label === 'Reading (optional)').onCompositionStart();
    ui.render();
    assert.equal(ui.find('Button', button => button.children === 'Submit').disabled, true);
    ui.render({ open: false });
    ui.render({ open: true });
    assert.equal(ui.find('Button', button => button.children === 'Submit').disabled, false);
});
