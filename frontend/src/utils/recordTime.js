// 分の浮動小数点を日時に足し引きするときのミリ秒切り捨てを防ぐ。
export function getRecordStart(end, minutes) {
    return end.minus({ milliseconds: Math.round(minutes * 60000) });
}

// FILLと時刻調整では秒以下を保持し、分ちょうどなら従来の表示にする。
export function formatPreciseLocalTime(dateTime) {
    return dateTime.toFormat(dateTime.second || dateTime.millisecond
        ? "yyyy-MM-dd'T'HH:mm:ss.SSS"
        : "yyyy-MM-dd'T'HH:mm");
}
