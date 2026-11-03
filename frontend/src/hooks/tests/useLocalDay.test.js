import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { DateTime, Settings } from 'luxon';

const source = transformSync(readFileSync(new URL('../useLocalDay.js', import.meta.url), 'utf8'), {
    format: 'cjs',
}).code;

function setup(iso) {
    let now = DateTime.fromISO(iso, { zone: 'Asia/Tokyo' }).toMillis();
    const oldNow = Settings.now;
    const oldZone = Settings.defaultZone;
    Settings.now = () => now;
    Settings.defaultZone = 'Asia/Tokyo';
    let state;
    let effect;
    let timerId = 0;
    const timers = new Map();
    const intervals = new Map();
    const listeners = new Map();
    const target = prefix => ({
        addEventListener: (name, callback) => listeners.set(prefix + name, callback),
        removeEventListener: name => listeners.delete(prefix + name),
    });
    const context = vm.createContext({
        module: { exports: {} },
        require: name => name === 'luxon' ? { DateTime } : {
            useState: initial => {
                state ??= initial();
                return [state, update => { state = update(state); }];
            },
            useEffect: callback => { effect = callback; },
        },
        setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
        clearTimeout: id => timers.delete(id),
        setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
        clearInterval: id => intervals.delete(id),
        window: target('window:'), document: target('document:'),
    });
    vm.runInContext(source, context);
    context.module.exports.default();
    const cleanup = effect();
    return {
        get day() { return state; }, timers, intervals, listeners,
        advance: iso => { now = DateTime.fromISO(iso, { zone: 'Asia/Tokyo' }).toMillis(); },
        close: () => { cleanup(); Settings.now = oldNow; Settings.defaultZone = oldZone; },
    };
}

test('日付境界で基準日を更新し、次の午前0時に再予約する', () => {
    const clock = setup('2026-11-03T23:59:59');
    try {
        assert.equal([...clock.timers.values()][0].delay, 1000);
        clock.advance('2026-11-04T00:00:00');
        [...clock.timers.values()][0].callback();
        assert.equal(clock.day.toISODate(), '2026-11-04');
        assert.equal(clock.timers.size, 1);
        assert.equal([...clock.timers.values()][0].delay, 86400000);
    } finally { clock.close(); }
});

for (const event of ['window:focus', 'window:pageshow', 'document:visibilitychange', 'interval']) {
    test(`${event}で複数日のスリープ後も更新し、同日中は基準日を維持する`, () => {
        const clock = setup('2026-11-03T23:00:00');
        try {
            const callback = event === 'interval' ? [...clock.intervals.values()][0] : clock.listeners.get(event);
            const previous = clock.day;
            callback();
            assert.equal(clock.day, previous);
            clock.advance('2026-11-06T10:00:00');
            callback();
            assert.equal(clock.day.toISODate(), '2026-11-06');
            assert.equal([...clock.timers.values()][0].delay, 14 * 3600000);
        } finally { clock.close(); }
        assert.equal(clock.timers.size, 0);
        assert.equal(clock.intervals.size, 0);
        assert.equal(clock.listeners.size, 0);
    });
}
