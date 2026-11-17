import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStopwatchTime } from './stopwatchTime.js';

test('開始前は負の秒数を表示し、開始時刻を境に通常の計測へ移る', () => {
    assert.equal(formatStopwatchTime(-3661000), '-01:01:01');
    assert.equal(formatStopwatchTime(-1001), '-00:00:02');
    assert.equal(formatStopwatchTime(-1), '-00:00:01');
    assert.equal(formatStopwatchTime(0), '00:00:00');
    assert.equal(formatStopwatchTime(1000), '00:00:01');
});
