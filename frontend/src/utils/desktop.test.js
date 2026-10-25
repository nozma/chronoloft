import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopDiscordEnabled, recentDesktopActivities } from './desktop.js';

const settings = { recentDays: '14', recentLimit: '15', recentMinimum: '1' };

test('最近の候補は設定した上限まで有効な時間計測だけを重複なしで表示する', () => {
    const activities = Array.from({ length: 7 }, (_, id) => ({ id, unit: 'minutes', is_active: true }));
    activities.push({ id: 8, unit: 'count' }, { id: 9, unit: 'minutes', is_active: false });
    const records = [8, 9, 99, 0, 0, 1, 2, 3, 4, 5, 6].map((activity_id, index) => ({
        activity_id, created_at: new Date(Date.UTC(2026, 9, 25) - index * 60000).toISOString().replace('Z', ''),
    }));
    records.push({ activity_id: 6, created_at: '2027-01-01T00:00:00Z' });
    records.push({ activity_id: 6, created_at: 'invalid' });
    const { recent, eligible } = recentDesktopActivities(activities, records,
        { ...settings, recentLimit: '5' }, Date.UTC(2026, 9, 26));
    assert.deepEqual(recent.map(item => item.id), [0, 1, 2, 3, 4]);
    assert.equal(eligible.length, 7);
    assert.equal(recentDesktopActivities(activities, records, settings, Date.UTC(2026, 9, 26)).recent.length, 7);
});

test('履歴がない場合は最低件数の候補を返し、開始用の見出しを維持する', () => {
    const activity = { id: 1, unit: 'minutes' };
    assert.deepEqual(recentDesktopActivities([activity], [], settings), {
        recent: [activity], eligible: [activity], hasHistory: false,
    });
    const activities = Array.from({ length: 20 }, (_, id) => ({ id, unit: 'minutes' }));
    assert.equal(recentDesktopActivities(activities, [], settings).recent.length, 1);
    assert.equal(recentDesktopActivities(activities, [], { ...settings, recentMinimum: '5' }).recent.length, 5);
});

test('対象期間を反映し、期間外の候補を使用日時順に最低件数まで補充する', () => {
    const now = Date.UTC(2026, 9, 26, 12);
    const activities = Array.from({ length: 8 }, (_, id) => ({ id, unit: 'minutes' }));
    const records = [40, 20, 10, 8, 7, 3].map((days, activity_id) => ({
        activity_id, created_at: new Date(now - days * 86400000).toISOString(),
    }));
    const selected = options => recentDesktopActivities(activities, records, { ...settings, ...options }, now)
        .recent.map(item => item.id);
    assert.deepEqual(selected({ recentDays: '7' }), [5, 4]);
    assert.deepEqual(selected({ recentDays: '14' }), [5, 4, 3, 2]);
    assert.deepEqual(selected({ recentDays: '30' }), [5, 4, 3, 2, 1]);
    assert.deepEqual(selected({ recentDays: '7', recentMinimum: '5' }), [5, 4, 3, 2, 1]);
    assert.deepEqual(selected({ recentDays: '7', recentLimit: '5', recentMinimum: '15' }), [5, 4, 3, 2, 1]);
    assert.deepEqual(selected({ recentDays: 'all', recentLimit: 'all' }), [5, 4, 3, 2, 1, 0, 6, 7]);
});

test('上限が無制限の場合は5件を超える候補もすべて表示する', () => {
    const now = Date.UTC(2026, 9, 26);
    const activities = Array.from({ length: 35 }, (_, id) => ({ id, unit: 'minutes' }));
    const records = activities.map(item => ({ activity_id: item.id, created_at: new Date(now).toISOString() }));
    assert.equal(recentDesktopActivities(activities, records, { ...settings, recentLimit: '30' }, now).recent.length, 30);
    assert.equal(recentDesktopActivities(activities, records, { ...settings, recentLimit: 'all' }, now).recent.length, 35);
});

test('パネル開始時は保存済みDiscord設定を読み直し、取得失敗時は開始へ進まない', async () => {
    const request = async path => {
        assert.equal(path, '/api/settings/local');
        return { ok: true, json: async () => ({ settings: { discordEnabled: false } }) };
    };
    assert.equal(await desktopDiscordEnabled(request), false);
    assert.equal(await desktopDiscordEnabled(async () => ({ ok: true, json: async () => ({ settings: {} }) })), true);
    await assert.rejects(desktopDiscordEnabled(async () => ({ ok: false })), /設定/);
});

test('公開設定の取得が応答しない場合は打ち切り、再試行できる', async context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = desktopDiscordEnabled((path, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    context.mock.timers.tick(10000);
    await assert.rejects(pending, /timeout/);
    assert.equal(await desktopDiscordEnabled(async () => ({ ok: true, json: async () => ({ settings: { discordEnabled: false } }) })), false);
});
