import { DateTime } from 'luxon';

export function getDateAxisTicks(minimum, maximum, width, unit) {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return [];
    const start = DateTime.fromMillis(minimum).startOf(unit === 'month' ? 'month' : 'day');
    const end = DateTime.fromMillis(maximum);
    const intervalUnit = unit === 'month' ? 'months' : 'days';
    // 日付ラベルが重ならない個数に絞り、記録のない日にも等間隔で目盛りを置く。
    const maxTicks = Math.max(2, Math.floor(width / 90));
    const span = end.diff(start, intervalUnit).get(intervalUnit);
    const step = Math.max(1, Math.ceil(span / (maxTicks - 1)));
    const ticks = [];
    for (let date = start; date <= end; date = date.plus({ [intervalUnit]: step })) {
        ticks.push(date.toMillis());
    }
    return ticks;
}

export function getTimeAxis(maxValue) {
    const maximum = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
    // 最大6区間に収め、時間として読みやすい間隔を選ぶ。
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];
    let step = steps.find(candidate => maximum <= candidate * 6);
    if (!step) {
        const days = maximum / 6 / 1440;
        const magnitude = 10 ** Math.floor(Math.log10(days));
        step = [1, 2, 5, 10].find(candidate => candidate * magnitude >= days) * magnitude * 1440;
    }
    const intervals = Math.ceil(maximum / step);
    const ticks = Array.from({ length: intervals + 1 }, (_, index) => index * step);
    return { domain: [0, ticks[ticks.length - 1]], ticks, interval: 0 };
}
