// パネルと通常画面で同じネイティブ操作を利用する。
export const isMenuBarPanel = () => new URLSearchParams(window.location.search).get('menubar') === '1';

export function desktopCommand(command) {
    if (window.webkit?.messageHandlers?.chronoloft) {
        window.webkit.messageHandlers.chronoloft.postMessage({ command });
        return Promise.resolve();
    }
    return window.pywebview?.api?.desktop_command(command);
}

export function recentDesktopActivities(activities, records, now = Date.now()) {
    const eligible = activities.filter(item => item.unit === 'minutes' && item.is_active !== false);
    const byId = new Map(eligible.map(item => [item.id, item]));
    const seen = new Set();
    const recent = [];
    // APIのタイムゾーン省略日時はUTCとして扱う。
    const timestamp = value => Date.parse(`${value}${/[Zz]|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z'}`);
    for (const record of records.map(item => ({ ...item, timestamp: timestamp(item.created_at) }))
        .filter(item => Number.isFinite(item.timestamp) && item.timestamp <= now)
        .sort((a, b) => b.timestamp - a.timestamp)) {
        if (!byId.has(record.activity_id) || seen.has(record.activity_id)) continue;
        seen.add(record.activity_id);
        recent.push(byId.get(record.activity_id));
        if (recent.length === 5) break;
    }
    return { recent, eligible };
}
