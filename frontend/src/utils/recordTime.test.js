import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { luxonLocalizer } from 'react-big-calendar';
import timeSlots from 'react-big-calendar/lib/utils/TimeSlots.js';
import noOverlap from 'react-big-calendar/lib/utils/layout-algorithms/no-overlap.js';
import { getRecordStart } from './recordTime.js';
import { calendarDayLayout } from './calendarDayLayout.js';

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

test('マイクロ秒を含む終了時刻でも連続記録が横並びにならない', () => {
    const boundary = DateTime.local(2026, 11, 6, 10);
    const end = boundary.plus({ hours: 2, minutes: 1, seconds: 11 });
    const localizer = luxonLocalizer(DateTime);
    const slotMetrics = timeSlots.getSlotMetrics({
        min: boundary.set({ hour: 4 }).toJSDate(), max: boundary.endOf('day').toJSDate(),
        step: 60, timeslots: 1, localizer,
    });
    for (const micros of [100, 499, 500, 501, 900, 999]) {
        const rawEnd = `${end.toFormat("yyyy-MM-dd'T'HH:mm:ss")}.994${String(micros).padStart(3, '0')}${end.toFormat('ZZ')}`;
        const duration = (7271994000 + micros) / 60000000;
        const start = getRecordStart(rawEnd, duration);
        assert.equal(start.toMillis(), boundary.toMillis(), rawEnd);
        const layout = nextStart => noOverlap.default({
            events: [
                { start: boundary.minus({ minutes: 30 }).toJSDate(), end: boundary.toJSDate() },
                { start: nextStart.toJSDate(), end: DateTime.fromISO(rawEnd).toJSDate() },
            ],
            minimumStartDifference: 30, slotMetrics,
            accessors: { start: event => event.start, end: event => event.end },
        });
        assert.ok(layout(start).every(event => event.style.left === 0), rawEnd);
        assert.ok(layout(start.minus({ milliseconds: 1 })).some(event => event.style.left > 0));
    }
});

test('ゼロ時間とミリ秒未満の記録の開始時刻が表示上の終了時刻を超えない', () => {
    const rawEnd = '2026-11-06T03:01:11.994900Z';
    const end = DateTime.fromISO(rawEnd);
    for (const minutes of [0, 0.000001]) {
        assert.equal(getRecordStart(rawEnd, minutes).toMillis(), end.toMillis());
    }
});

test('同じ分で接する記録は割合の加算誤差で横にずれず、0分の記録も列を占有しない', () => {
    const day = DateTime.local(2026, 11, 6, 4);
    const slotMetrics = timeSlots.getSlotMetrics({
        min: day.toJSDate(), max: day.endOf('day').toJSDate(),
        step: 60, timeslots: 1, localizer: luxonLocalizer(DateTime),
    });
    const event = (start, end) => ({
        start: day.plus({ minutes: start }).toJSDate(),
        end: day.plus({ minutes: end }).toJSDate(),
    });
    const options = {
        minimumStartDifference: 30, slotMetrics,
        accessors: { start: item => item.start, end: item => item.end },
    };
    const adjacent = [event(1, 5), event(5, 15)];
    assert.ok(noOverlap.default({ ...options, events: adjacent }).some(item => item.style.left > 0));
    const layout = calendarDayLayout({ ...options, events: [...adjacent, event(5, 5)] });
    assert.equal(layout.length, 2);
    assert.ok(layout.every(item => item.style.left === 0));
    assert.ok(calendarDayLayout({ ...options, events: [event(1, 6), event(5, 15)] })
        .some(item => item.style.left > 0));
});
