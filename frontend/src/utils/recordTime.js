import { DateTime } from 'luxon';

// 保存時刻は文字列のまま受け取り、Luxonで失われるミリ秒未満も復元に使う。
export function getRecordStart(endTime, minutes) {
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

// FILLと時刻調整では秒以下を保持し、分ちょうどなら従来の表示にする。
export function formatPreciseLocalTime(dateTime) {
    return dateTime.toFormat(dateTime.second || dateTime.millisecond
        ? "yyyy-MM-dd'T'HH:mm:ss.SSS"
        : "yyyy-MM-dd'T'HH:mm");
}
