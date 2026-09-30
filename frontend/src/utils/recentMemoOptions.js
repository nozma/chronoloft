const RECENT_MEMO_DAYS = 7;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export const getRecentMemoOptions = (records, activityId, now = Date.now()) => {
    const cutoff = now - RECENT_MEMO_DAYS * MILLIS_PER_DAY;
    const seen = new Set();

    return records
        .filter((record) => record.activity_id === activityId)
        .map((record) => ({
            memo: typeof record.memo === 'string' ? record.memo.trim() : '',
            createdAt: new Date(record.created_at).getTime(),
        }))
        .filter(({ memo, createdAt }) => (
            memo &&
            Number.isFinite(createdAt) &&
            createdAt >= cutoff &&
            createdAt <= now
        ))
        .sort((a, b) => b.createdAt - a.createdAt)
        .reduce((options, { memo }) => {
            if (!seen.has(memo)) {
                seen.add(memo);
                options.push(memo);
            }
            return options;
        }, []);
};
