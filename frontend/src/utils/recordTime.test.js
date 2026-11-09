import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { luxonLocalizer } from 'react-big-calendar';
import timeSlots from 'react-big-calendar/lib/utils/TimeSlots.js';
import noOverlap from 'react-big-calendar/lib/utils/layout-algorithms/no-overlap.js';
import { getRecordStart, formatPreciseLocalTime } from './recordTime.js';

test('FILLの時刻は秒以下を保持して保存・再計算できる', () => {
    const previousEnd = DateTime.fromISO('2026-11-06T08:13:58.027');
    const filled = formatPreciseLocalTime(previousEnd);
    assert.equal(filled, '2026-11-06T08:13:58.027');
    const start = DateTime.fromISO(filled);
    const end = DateTime.fromISO('2026-11-06T09:00');
    const duration = end.diff(start, 'minutes').minutes;
    assert.equal(getRecordStart(end, duration).toMillis(), previousEnd.toMillis());
    assert.equal(formatPreciseLocalTime(start.plus({ minutes: 5 })), '2026-11-06T08:18:58.027');
    assert.equal(formatPreciseLocalTime(end), '2026-11-06T09:00');
});

test('分の小数誤差で連続する記録が横並びにならず、実際の重なりは維持する', () => {
    const end = DateTime.fromISO('2026-11-06T12:01:11.994');
    const boundary = DateTime.fromISO('2026-11-06T10:00');
    const start = getRecordStart(end, 121.19990378417968);
    assert.equal(start.toMillis(), boundary.toMillis());
    const localizer = luxonLocalizer(DateTime);
    const slotMetrics = timeSlots.getSlotMetrics({
        min: boundary.set({ hour: 4 }).toJSDate(),
        max: boundary.endOf('day').toJSDate(),
        step: 60, timeslots: 1, localizer,
    });
    const layout = nextStart => noOverlap.default({
        events: [
            { start: boundary.minus({ minutes: 42 }).toJSDate(), end: boundary.toJSDate() },
            { start: nextStart.toJSDate(), end: end.toJSDate() },
        ],
        minimumStartDifference: 30,
        slotMetrics,
        accessors: { start: event => event.start, end: event => event.end },
    });
    assert.ok(layout(start).every(event => event.style.left === 0));
    assert.ok(layout(start.minus({ seconds: 1 })).some(event => event.style.left > 0));
});
