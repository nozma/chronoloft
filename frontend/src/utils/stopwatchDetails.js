export const STOPWATCH_DETAILS_EVENT = 'chronoloft:stopwatch-details';

// 同じ画面内のストップウォッチに更新を依頼し、受付結果を同期的に受け取る。
export function changeStopwatchDetails(record, memo, validateOnly = false) {
    const request = { record, memo, validateOnly, accepted: false };
    window.dispatchEvent(new CustomEvent(STOPWATCH_DETAILS_EVENT, { detail: request }));
    return request.accepted;
}
