import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createActivitySearchPredicate, isValidReading } from '../../utils/activitySearch.js';

const source = transformSync(readFileSync(new URL('../../components/ActivityManagementDialog.jsx', import.meta.url), 'utf8'), {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;

function grid(activityOverrides = {}, runningActivityIds = [], apiOverrides = {}, tagOptions = [], editApi = {}) {
    const jsx = (type, props) => ({ type, props });
    const modules = {
        react: { useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => [value, () => {}] },
        'react/jsx-runtime': { jsx, jsxs: jsx },
        '@mui/material': new Proxy({}, { get: (_, name) => name }),
        '@mui/material/styles': { useTheme: () => ({ palette: { text: { primary: '#000' } } }) },
        '@mui/x-data-grid': { DataGrid: 'DataGrid', useGridApiContext: () => ({ current: editApi }), getGridStringOperators: () => [
            { value: 'contains' }, { value: 'doesNotContain' }, { value: 'equals', getApplyFilterFn: () => 'original' },
        ] },
        '../utils/activitySearch': { createActivitySearchPredicate, isValidReading },
        '../i18n/I18nContext': { useI18n: () => ({ t: key => key }) },
        '../contexts/GroupContext': { useGroups: () => ({ groups: [] }) },
        '../contexts/TagContext': { useTags: () => ({ tags: tagOptions }) },
        '../contexts/ActivityContext': { useActivities: () => ({ activities: [{ id: 1, name: '読書', reading: 'どくしょ' }], ...activityOverrides }) },
        '../contexts/FilterContext': { useFilter: () => ({ filterState: {} }) },
        '../contexts/UIContext': { useUI: () => ({ state: {} }) },
        '../hooks/useLocalStorageState': { __esModule: true, default: () => [null, () => {}] },
        '../services/api': apiOverrides,
    };
    const context = vm.createContext({ module: { exports: {} }, require: name => modules[name] ?? { default: name } });
    vm.runInContext(source, context);
    let closes = 0;
    const tree = context.module.exports.default({ open: true, runningActivityIds, onClose: () => { closes++; } });
    let dialogProps;
    const find = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.map(find).find(Boolean);
        if (node.props?.onKeyDownCapture) dialogProps = node.props;
        return node.type === 'DataGrid' ? node.props : find(node.props?.children);
    };
    const table = find(tree);
    table.dialogProps = dialogProps;
    table.closeCount = () => closes;
    return table;
}

test('一覧に読み列を表示し、名前と読みの部分一致フィルターでかな・ローマ字を扱う', () => {
    const table = grid();
    const row = table.rows[0];
    for (const field of ['name', 'reading']) {
        const column = table.columns.find(c => c.field === field);
        assert.ok(column);
        for (const query of ['ドク', 'doku', 'dokusyo']) {
            assert.equal(column.filterOperators.find(o => o.value === 'contains').getApplyFilterFn({ value: query })(row[field], row), true);
            assert.equal(column.filterOperators.find(o => o.value === 'doesNotContain').getApplyFilterFn({ value: query })(row[field], row), false);
        }
        assert.equal(column.filterOperators.find(o => o.value === 'contains').getApplyFilterFn({ value: '' }), null);
        assert.equal(column.filterOperators.find(o => o.value === 'equals').getApplyFilterFn(), 'original');
    }
});


test('全データ列の編集・入力制限と計測中の編集禁止を設定する', () => {
    const table = grid();
    for (const field of ['name', 'reading', 'group_id', 'unit', 'asset_key', 'tags']) {
        assert.equal(table.columns.find(c => c.field === field).editable, true);
    }
    const reading = table.columns.find(c => c.field === 'reading');
    assert.equal(reading.preProcessEditCellProps({ props: { value: 'カナ' } }).error, true);
    assert.equal(reading.preProcessEditCellProps({ props: { value: 'かな' } }).error, false);
    assert.equal(reading.preProcessEditCellProps({ props: { value: '' } }).error, false);
    const name = table.columns.find(c => c.field === 'name');
    assert.equal(name.preProcessEditCellProps({ props: { value: ' ' } }).error, true);
    assert.equal(grid({}, [1]).isCellEditable({ id: 1 }), false);
    assert.equal(grid({}, [1]).isCellEditable({ id: 2 }), true);
});

test('セル保存は変更した項目だけを送り、失敗は編集状態を維持するため呼び出し元へ返す', async () => {
    const writes = [];
    const table = grid({ modifyActivity: async (id, changes) => writes.push([id, changes]) });
    const old = { id: 1, name: '読書', reading: '', asset_key: 'book' };
    await table.processRowUpdate({ ...old, reading: 'どくしょ' }, old);
    assert.deepEqual(JSON.parse(JSON.stringify(writes)), [[1, { reading: 'どくしょ' }]]);
    const failed = grid({ modifyActivity: async () => { throw new Error('offline'); } });
    await assert.rejects(failed.processRowUpdate({ ...old, name: '変更' }, old), /offline/);
    await assert.rejects(grid({}, [1]).processRowUpdate({ ...old, reading: 'どくしょ' }, old));
});


test('タグの複数選択と全解除を保存し、失敗時は完了扱いにしない', async () => {
    const tags = [{ id: 1, name: '本' }, { id: 2, name: '学習' }];
    const writes = [];
    let refreshes = 0;
    let edit;
    const table = grid({ refreshActivities: async () => { refreshes++; } }, [], {
        setActivityTags: async (id, ids) => writes.push([id, [...ids]]),
    }, tags, { setEditCellValue: value => { edit = value; } });
    const row = { id: 1, name: '読書', tags: [tags[0]] };
    const editorElement = table.columns.find(c => c.field === 'tags').renderEditCell({ id: 1, field: 'tags', value: row.tags });
    const editor = editorElement.type(editorElement.props);
    editor.props.onChange({ target: { value: [1, 2] } });
    assert.deepEqual(JSON.parse(JSON.stringify(edit.value)), tags);
    await table.processRowUpdate({ ...row, tags: edit.value }, row);
    editor.props.onChange({ target: { value: [] } });
    await table.processRowUpdate({ ...row, tags: edit.value }, row);
    assert.deepEqual(writes, [[1, [1, 2]], [1, []]]);
    assert.equal(refreshes, 2);
    const failed = grid({}, [], { setActivityTags: async () => { throw new Error('offline'); } });
    await assert.rejects(failed.processRowUpdate({ ...row, tags: [] }, row), /offline/);
});


test('セル内のEscは編集だけ取り消し、一覧ダイアログを閉じない', () => {
    const table = grid();
    table.dialogProps.onKeyDownCapture({ key: 'Escape', target: { closest: () => ({}) } });
    table.dialogProps.onClose({}, 'escapeKeyDown');
    assert.equal(table.closeCount(), 0);
    table.dialogProps.onKeyDownCapture({ key: 'Escape', target: { closest: () => null } });
    table.dialogProps.onClose({}, 'escapeKeyDown');
    assert.equal(table.closeCount(), 1);
});
