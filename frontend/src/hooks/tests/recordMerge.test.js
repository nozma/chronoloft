import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DateTime } from 'luxon';

const source = readFileSync(new URL('../../contexts/RecordContext.jsx', import.meta.url), 'utf8');
const create = source.slice(source.indexOf('    const createRecord ='), source.indexOf('\n    useEffect', source.indexOf('    const createRecord =')));
const record = (id, activity_id, memo, end) => ({ id, activity_id, memo, value: 1, unit: 'minutes', created_at: `2026-10-26T09:0${end}:00Z` });

async function save(records, enabled = true) {
    const writes = [];
    const context = vm.createContext({
        records, mergeConsecutiveRecords: enabled, activities: [], DateTime,
        normalizeDetails: value => value || '', normalizeMemo: value => value || '',
        resolveActivityUnit: () => 'minutes',
        parseIsoToMs: value => DateTime.fromISO(value, { zone: 'utc' }).toMillis(),
        MILLIS_PER_MINUTE: 60000, MERGE_WINDOW_MS: 300000,
        apiUpdateRecord: async (id, data) => writes.push({ id, ...data }),
        apiCreateRecord: async data => writes.push({ new: true, ...data }),
        refreshRecords: async () => {},
    });
    await vm.runInContext(`${create}\ncreateRecord(${JSON.stringify(record(9, 1, 'A', 3))});`, context);
    return writes[0];
}

test('同じ内容で5分以内なら空き時間を含めて結合し、OFFなら新規保存する', async () => {
    const records = [record(1, 1, 'A', 1)];
    assert.equal((await save(records)).id, 1);
    assert.equal((await save(records)).value, 3);
    assert.equal((await save(records, false)).new, true);
});

test('別のアクティビティまたは詳細の記録を挟んだら結合しない', async () => {
    for (const middle of [record(2, 2, 'B', 2), record(2, 1, 'B', 2)]) {
        assert.equal((await save([record(1, 1, 'A', 1), middle])).new, true);
    }
});
