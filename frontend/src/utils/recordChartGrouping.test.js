import assert from 'node:assert/strict';
import test from 'node:test';
import { getActivityMemoKey } from './recordChartGrouping.js';
import { getGroupingColor } from './groupingColors.js';

test('名前のスラッシュと詳細の区切りが同じ表示になっても識別する', () => {
    const withDetails = { activity_id: 1, activity_name: '読書', memo: '本A' };
    const slashInName = { activity_id: 2, activity_name: '読書 / 本A', memo: '' };
    assert.notEqual(getActivityMemoKey(withDetails), getActivityMemoKey(slashInName));
});

test('同名のアクティビティと詳細内の区切り文字を混同しない', () => {
    const record = { activity_id: 1, activity_name: '作業', memo: 'A / B' };
    assert.notEqual(getActivityMemoKey(record), getActivityMemoKey({ ...record, activity_id: 2 }));
    assert.notEqual(getActivityMemoKey(record), getActivityMemoKey({ ...record, memo: 'A' }));
    assert.notEqual(getActivityMemoKey(record), getActivityMemoKey({ ...record, memo: 'A / B / C' }));
});

test('同じアクティビティと詳細の保存記録・仮記録は同じキーになる', () => {
    const record = { activity_id: 1, activity_name: '作業', memo: 'A / B' };
    assert.equal(getActivityMemoKey(record), getActivityMemoKey({ ...record, id: 'live-main-1', is_live: true }));
    assert.equal(getActivityMemoKey({ ...record, memo: null }), getActivityMemoKey({ ...record, memo: '' }));
    assert.equal(getActivityMemoKey(record), getActivityMemoKey({ ...record, activity_name: '改名後' }));
});

test('表示名の特殊文字を含む組み合わせを安全に識別する', () => {
    const records = ['date', 'dateValue', '__proto__', 'a.b[0]', '" / \\'].map(memo => ({ activity_id: 1, memo }));
    assert.equal(new Set(records.map(getActivityMemoKey)).size, records.length);
    assert.ok(records.every(record => getActivityMemoKey(record) !== record.memo));
});

test('色はスラッシュを含む名前と詳細を明示して決定できる', () => {
    for (const mode of ['light', 'dark']) {
        assert.equal(
            getGroupingColor('activityMemo', '読書 / 本A', mode, { activityName: '読書', memo: '本A' }),
            getGroupingColor('activityMemo', '読書 / 本A', mode)
        );
        assert.equal(
            getGroupingColor('activityMemo', '読書 / 本A', mode, { activityName: '読書 / 本A', memo: '' }),
            getGroupingColor('activity', '読書 / 本A', mode)
        );
    }
});
