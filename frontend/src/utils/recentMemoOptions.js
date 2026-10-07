import { createFilterOptions } from '@mui/material/Autocomplete';
import { normalizeDetails } from './recordDetails';
const MAX_RECENT_MEMO_OPTIONS = 10;

// 全候補を文字で絞り込んでから、表示件数を制限する。
export const filterRecentMemoOptions = createFilterOptions({ limit: MAX_RECENT_MEMO_OPTIONS });

export const getRecentMemoOptions = (records, activityId, now = Date.now()) => {
    const seen = new Set();

    return records
        .filter((record) => record.activity_id === activityId)
        .map((record) => ({
            memo: typeof record.memo === 'string' ? normalizeDetails(record.memo).trim() : '',
            createdAt: new Date(record.created_at).getTime(),
        }))
        .filter(({ memo, createdAt }) => (
            memo &&
            Number.isFinite(createdAt) &&
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
