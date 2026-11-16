import { DateTime } from 'luxon';

// 保存時刻は文字列のまま受け取り、Luxonで失われるミリ秒未満も復元に使う。
export function getRecordStart(endTime, minutes, startedAt) {
    // 計測中や保存確認では、経過時間から復元せず計測の開始時刻を使う。
    if (Number.isFinite(startedAt)) return DateTime.fromMillis(startedAt);
    const end = typeof endTime === 'string'
        ? DateTime.fromISO(endTime, { zone: 'utc' }).toLocal()
        : endTime;
    const fraction = typeof endTime === 'string'
        ? endTime.match(/T\d{2}:\d{2}:\d{2}[.,](\d+)/)?.[1]
        : null;
    const subMillisecond = fraction ? Number(`0.${fraction}`) * 1000 - end.millisecond : 0;
    // 終了時刻と経過時間の精度をそろえてから、表示用の整数ミリ秒へ丸める。
    const durationMilliseconds = Math.max(0, Math.round(minutes * 60000 - subMillisecond));
    return end.minus({ milliseconds: durationMilliseconds });
}

export function formatMinuteInput(dateTime) {
    return dateTime.toFormat("yyyy-MM-dd'T'HH:mm");
}
