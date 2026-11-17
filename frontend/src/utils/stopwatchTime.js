export function formatStopwatchTime(ms) {
    const seconds = ms < 0 ? Math.ceil(-ms / 1000) : Math.floor(ms / 1000);
    const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
    return (ms < 0 ? '-' : '') + parts.map(part => String(part).padStart(2, '0')).join(':');
}
