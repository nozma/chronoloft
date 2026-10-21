import { useSharedStopwatches, sharedLiveRecords } from '../services/stopwatches';
import { normalizeDetails } from '../utils/recordDetails';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { DateTime } from 'luxon';
import {
    fetchRecords as apiFetchRecords,
    createRecord as apiCreateRecord,
    updateRecord as apiUpdateRecord,
    deleteRecord as apiDeleteRecord
} from '../services/api';
import { useActivities } from './ActivityContext';

const RecordContext = createContext();
const LIVE_REFRESH_MS = 5000;
export const STOPWATCH_SYNC_EVENT = 'chronoloft:stopwatch-sync';
const MERGE_WINDOW_MINUTES = 5;
const MERGE_WINDOW_MS = MERGE_WINDOW_MINUTES * 60 * 1000;
const MILLIS_PER_MINUTE = 60000;

const areLiveRecordsEqual = (prev, next) => {
    if (prev.length !== next.length) return false;
    if (prev.length === 0) return true;
    for (let i = 0; i < prev.length; i += 1) {
        if (prev[i].id !== next[i].id) return false;
        if (prev[i].value !== next[i].value) return false;
        if (prev[i].memo !== next[i].memo) return false;
        if (prev[i].created_at !== next[i].created_at) return false;
        if (prev[i].is_paused !== next[i].is_paused) return false;
        if (prev[i].server_session?.revision !== next[i].server_session?.revision) return false;
    }
    return true;
};

const normalizeMemo = normalizeDetails;

const resolveActivityUnit = (activityId, activities, records) => {
    const activity = activities.find((item) => item.id === activityId);
    if (activity?.unit) return activity.unit;
    const record = records.find((item) => item.activity_id === activityId && item.unit);
    return record?.unit ?? null;
};

const parseIsoToMs = (value) => {
    if (!value) return null;
    const dt = DateTime.fromISO(value, { zone: 'utc' });
    return dt.isValid ? dt.toMillis() : null;
};

export function RecordProvider({ children }) {
    const { activities } = useActivities();
    const [records, setRecords] = useState([]);
    const [liveRecords, setLiveRecords] = useState([]);
    const shared = useSharedStopwatches();

    const refreshRecords = async () => {
        try {
            const data = await apiFetchRecords();
            setRecords(data.map((record) => ({ ...record, memo: normalizeDetails(record.memo) })));
        } catch (error) {
            console.error("Failed to fetch records:", error);
        }
    };

    const createRecord = async (recordData) => {
        const payload = { ...recordData, memo: normalizeDetails(recordData.memo) };
        if (!payload.created_at) {
            payload.created_at = new Date().toISOString();
        }

        const activityId = payload.activity_id;
        const unit = resolveActivityUnit(activityId, activities, records);
        const valueMinutes = Number(payload.value);

        if (unit === 'minutes' && Number.isFinite(valueMinutes) && valueMinutes >= 0) {
            const newEndMs = parseIsoToMs(payload.created_at);
            if (Number.isFinite(newEndMs)) {
                const newStartMs = newEndMs - valueMinutes * MILLIS_PER_MINUTE;
                const memoKey = normalizeMemo(payload.memo);
                let candidate = null;
                let candidateEndMs = -Infinity;

                records.forEach((record) => {
                    if (record.activity_id !== activityId) return;
                    if (record.unit !== 'minutes') return;
                    if (normalizeMemo(record.memo) !== memoKey) return;
                    const recordEndMs = parseIsoToMs(record.created_at);
                    const recordValue = Number(record.value);
                    if (!Number.isFinite(recordEndMs)) return;
                    if (!Number.isFinite(recordValue) || recordValue < 0) return;
                    const gapMs = newStartMs - recordEndMs;
                    if (gapMs < 0 || gapMs > MERGE_WINDOW_MS) return;
                    if (recordEndMs > candidateEndMs) {
                        candidate = record;
                        candidateEndMs = recordEndMs;
                    }
                });

                if (candidate) {
                    const candidateValue = Number(candidate.value);
                    const candidateStartMs = candidateEndMs - candidateValue * MILLIS_PER_MINUTE;
                    const mergedStartMs = Math.min(candidateStartMs, newStartMs);
                    const mergedEndMs = Math.max(candidateEndMs, newEndMs);
                    const mergedValue = (mergedEndMs - mergedStartMs) / MILLIS_PER_MINUTE;
                    const updatePayload = {
                        value: mergedValue,
                        created_at: new Date(mergedEndMs).toISOString(),
                    };
                    if (Object.prototype.hasOwnProperty.call(payload, 'memo')) {
                        updatePayload.memo = payload.memo;
                    }
                    await apiUpdateRecord(candidate.id, updatePayload);
                    await refreshRecords();
                    return;
                }
            }
        }

        await apiCreateRecord(payload);
        await refreshRecords();
    };

    useEffect(() => {
        refreshRecords();
        const changed = () => refreshRecords();
        window.addEventListener('chronoloft:records-changed', changed);
        return () => window.removeEventListener('chronoloft:records-changed', changed);
    }, [shared.items]);

    const updateRecord = async (recordId, updateData) => {
        const payload = { ...updateData };
        if (Object.prototype.hasOwnProperty.call(payload, 'memo')) {
            payload.memo = normalizeDetails(payload.memo);
        }
        await apiUpdateRecord(recordId, payload);
        await refreshRecords();
    };

    const deleteRecord = async (recordId) => {
        await apiDeleteRecord(recordId);
        await refreshRecords();
    };

    useEffect(() => {
        const syncLiveRecords = () => {
            const next = sharedLiveRecords(shared.items, Date.now() + shared.offset);
            setLiveRecords(previous => areLiveRecordsEqual(previous, next) ? previous : next);
        };
        syncLiveRecords();
        const timer = setInterval(syncLiveRecords, LIVE_REFRESH_MS);
        const handleStopwatchSync = () => {
            syncLiveRecords();
        };

        window.addEventListener(STOPWATCH_SYNC_EVENT, handleStopwatchSync);

        return () => {
            clearInterval(timer);
            window.removeEventListener(STOPWATCH_SYNC_EVENT, handleStopwatchSync);
        };
    }, [shared.items, shared.offset]);

    const recordsWithLive = useMemo(() => {
        if (liveRecords.length === 0) return records;
        return [...records, ...liveRecords];
    }, [records, liveRecords]);

    return (
        <RecordContext.Provider value={{
            records,
            liveRecords,
            recordsWithLive,
            createRecord,
            updateRecord,
            deleteRecord,
            refreshRecords
        }}>
            {children}
        </RecordContext.Provider>
    );
}

export function useRecords() {
    return useContext(RecordContext);
}
