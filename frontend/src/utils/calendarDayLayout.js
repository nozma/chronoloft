import noOverlap from 'react-big-calendar/lib/utils/layout-algorithms/no-overlap.js';

const POSITION_SCALE = 100000000;

export function calendarDayLayout({ events, accessors, slotMetrics, ...options }) {
    // 終端と次の始端が同じでも、割合の加算誤差で重なったと判定されることがある。
    // 横並びの判定は整数座標で行い、縦の表示位置は元の割合を使う。
    const layout = noOverlap.default ?? noOverlap;
    const positioned = layout({
        ...options,
        accessors,
        events: events.filter(event => accessors.end(event) > accessors.start(event)),
        slotMetrics: {
            getRange(...args) {
                const range = slotMetrics.getRange(...args);
                const top = Math.round(range.top * POSITION_SCALE);
                const bottom = Math.round((range.top + range.height) * POSITION_SCALE);
                return { ...range, top, height: bottom - top };
            },
        },
    });
    return positioned.map(({ event, style }) => {
        const { top, height } = slotMetrics.getRange(accessors.start(event), accessors.end(event));
        return { event, style: { ...style, top, height: `calc(${height}% - 2px)` } };
    });
}
