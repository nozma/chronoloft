import { operateStopwatch, refreshStopwatches, currentStopwatch } from '../services/stopwatches';
export const STOPWATCH_DETAILS_EVENT = 'chronoloft:stopwatch-details';

// 同じ画面内のストップウォッチに更新を依頼し、受付結果を同期的に受け取る。
export async function changeStopwatchDetails(record, memo, validateOnly = false) {
    if (record.server_session) {
        if (validateOnly) {
            await refreshStopwatches();
            const current = currentStopwatch(record.session_id);
            return current?.revision === record.server_session.revision;
        }
        await operateStopwatch(record.server_session, 'edit', { memo });
        return true;
    }
    const request = { record, memo, validateOnly, accepted: false };
    window.dispatchEvent(new CustomEvent(STOPWATCH_DETAILS_EVENT, { detail: request }));
    return request.accepted;
}
