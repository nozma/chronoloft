import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopDiscordEnabled, recentDesktopActivities } from './desktop.js';

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
