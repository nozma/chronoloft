import test from 'node:test';
import assert from 'node:assert/strict';
import { recentDesktopActivities } from './desktop.js';

test('最近の候補は有効な時間計測だけを重複なしで5件まで表示する', () => {
    const activities = Array.from({ length: 7 }, (_, id) => ({ id, unit: 'minutes', is_active: true }));
    activities.push({ id: 8, unit: 'count' }, { id: 9, unit: 'minutes', is_active: false });
    const records = [8, 9, 99, 0, 0, 1, 2, 3, 4, 5, 6].map((activity_id, index) => ({
        activity_id, created_at: new Date(Date.UTC(2026, 9, 25) - index * 60000).toISOString().replace('Z', ''),
    }));
    records.push({ activity_id: 6, created_at: '2027-01-01T00:00:00Z' });
    records.push({ activity_id: 6, created_at: 'invalid' });
    const { recent, eligible } = recentDesktopActivities(activities, records, Date.UTC(2026, 9, 26));
    assert.deepEqual(recent.map(item => item.id), [0, 1, 2, 3, 4]);
    assert.equal(eligible.length, 7);
});

test('履歴がない場合も開始可能な時間計測の一覧を返す', () => {
    const activity = { id: 1, unit: 'minutes' };
    assert.deepEqual(recentDesktopActivities([activity], []), { recent: [], eligible: [activity] });
});
