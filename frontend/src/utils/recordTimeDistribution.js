import { DateTime } from 'luxon';

const MILLIS_PER_MINUTE = 60000;

/**
 * minutes レコードをローカル日付単位に分割して走査する
 * @param {Object} record - { created_at, value }
 * @param {(segmentStart: DateTime, minutes: number) => void} onSegment
 * @param {Object} options
 * @param {DateTime} [options.clipStart] - この時刻より前を切り落とす（ローカル時刻）
 * @param {DateTime} [options.clipEnd] - この時刻より後を切り落とす（ローカル時刻）
 */
export function forEachLocalDayMinuteSegment(record, onSegment, options = {}) {
    const durationMinutes = Number(record?.value);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

    const endLocal = DateTime.fromISO(record?.created_at, { zone: 'utc' }).toLocal();
    if (!endLocal.isValid) return;
    const clipStart = options?.clipStart?.isValid ? options.clipStart : null;
    const clipEnd = options?.clipEnd?.isValid ? options.clipEnd : null;

    let cursor = endLocal.minus({ minutes: durationMinutes });
    while (cursor < endLocal) {
        const nextDayStart = cursor.startOf('day').plus({ days: 1 });
        const segmentEnd = nextDayStart < endLocal ? nextDayStart : endLocal;
        const effectiveStart = clipStart && cursor < clipStart ? clipStart : cursor;
        const effectiveEnd = clipEnd && segmentEnd > clipEnd ? clipEnd : segmentEnd;
        const segmentMinutes = (effectiveEnd.toMillis() - effectiveStart.toMillis()) / MILLIS_PER_MINUTE;
        if (segmentMinutes > 0) {
            onSegment(effectiveStart, segmentMinutes);
        }
        cursor = segmentEnd;
    }
}
