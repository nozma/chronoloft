import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { getDateAxisTicks, getTimeAxis } from './recordChartAxis.js';

test('日付の目盛りは記録の有無に依存せず一定間隔で生成する', () => {
    const start = DateTime.fromISO('2026-09-14');
    const end = DateTime.fromISO('2026-10-13');
    const ticks = getDateAxisTicks(start.toMillis(), end.toMillis(), 700, 'day');
    assert.deepEqual(ticks.map(value => DateTime.fromMillis(value).toISODate()), [
        '2026-09-14', '2026-09-19', '2026-09-24', '2026-09-29', '2026-10-04', '2026-10-09',
    ]);
    assert.ok(getDateAxisTicks(start.toMillis(), end.toMillis(), 300, 'day').length < ticks.length);
});

test('月単位は月境界に揃え、単一日とデータなしにも対応する', () => {
    const start = DateTime.fromISO('2026-01-01').toMillis();
    const end = DateTime.fromISO('2026-04-01').toMillis();
    assert.deepEqual(getDateAxisTicks(start, end, 700, 'month').map(value => DateTime.fromMillis(value).month), [1, 2, 3, 4]);
    assert.deepEqual(getDateAxisTicks(start, start, 700, 'day'), [start]);
    assert.deepEqual(getDateAxisTicks(undefined, undefined, 700, 'day'), []);
});

test('3時間の軸で2.5時間を含む30分刻みの目盛りを表示する', () => {
    const axis = getTimeAxis(180);
    assert.deepEqual(axis.ticks, [0, 30, 60, 90, 120, 150, 180]);
    assert.equal(axis.interval, 0);
});

test('短時間から長期間まで上端を含めて目盛り間隔を揃える', () => {
    for (const maximum of [0, 0.1, 4, 17, 119, 181, 240, 1000, 10000, 1000000]) {
        const { domain, ticks } = getTimeAxis(maximum);
        assert.equal(domain[0], 0);
        assert.ok(domain[1] >= maximum);
        assert.equal(ticks.at(-1), domain[1]);
        assert.ok(ticks.length >= 2 && ticks.length <= 7);
        const step = ticks[1] - ticks[0];
        assert.ok(ticks.slice(1).every((value, index) => value - ticks[index] === step));
    }
});
