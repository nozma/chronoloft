import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
    fetchRecords as apiFetchRecords,
    createRecord as apiCreateRecord,
    updateRecord as apiUpdateRecord,
    deleteRecord as apiDeleteRecord
} from '../services/api';

const RecordContext = createContext();
const LIVE_REFRESH_MS = 5000;

const safeParseLocalStorage = (key) => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return null;
    }
};

const formatLiveCreatedAt = (now) => {
    const iso = new Date(now).toISOString();
    return iso.replace('Z', '');
};

const buildLiveRecord = ({ activity, stopwatchState, now, idPrefix }) => {
    if (!activity || !stopwatchState) return null;
    if (activity.unit && activity.unit !== 'minutes') return null;
    const startTime = Number(stopwatchState.startTime);
    if (!Number.isFinite(startTime) || startTime <= 0) return null;
    const elapsedMs = Math.max(0, now - startTime);
    const minutes = elapsedMs / 60000;
    const activityId = activity.id;
    if (activityId === null || activityId === undefined) return null;

    const activityGroupId = activity.group_id ?? activity.activity_group_id ?? null;
    const activityGroup = activity.group_name ?? activity.activity_group ?? null;
    return {
        id: `live-${idPrefix}-${activityId}`,
        activity_id: activityId,
        value: minutes,
        created_at: formatLiveCreatedAt(now),
        unit: 'minutes',
        activity_name: activity.name,
        activity_group: activityGroup,
        activity_group_id: activityGroupId,
        tags: activity.tags || [],
        memo: stopwatchState.memo || '',
        is_live: true
    };
};

const buildLiveRecords = () => {
    const now = Date.now();
    const mainState = safeParseLocalStorage('stopwatchState');
    const mainActivity = safeParseLocalStorage('selectedActivity');
    const subState = safeParseLocalStorage('subStopwatchState');
    const subActivity = safeParseLocalStorage('subSelectedActivity');

    const live = [];
    const mainRecord = buildLiveRecord({ activity: mainActivity, stopwatchState: mainState, now, idPrefix: 'main' });
    if (mainRecord) live.push(mainRecord);
    const subRecord = buildLiveRecord({ activity: subActivity, stopwatchState: subState, now, idPrefix: 'sub' });
    if (subRecord) live.push(subRecord);
    return live;
};

const areLiveRecordsEqual = (prev, next) => {
    if (prev.length !== next.length) return false;
    if (prev.length === 0) return true;
    for (let i = 0; i < prev.length; i += 1) {
        if (prev[i].id !== next[i].id) return false;
        if (prev[i].value !== next[i].value) return false;
        if (prev[i].memo !== next[i].memo) return false;
    }
    return true;
};

export function RecordProvider({ children }) {
    const [records, setRecords] = useState([]);
    const [liveRecords, setLiveRecords] = useState([]);

    useEffect(() => {
        refreshRecords();
    }, []);

    const refreshRecords = async () => {
        try {
            const data = await apiFetchRecords();
            setRecords(data);
        } catch (error) {
            console.error("Failed to fetch records:", error);
        }
    };

    const createRecord = async (recordData) => {
        await apiCreateRecord(recordData);
        await refreshRecords();
    };

    const updateRecord = async (recordId, updateData) => {
        await apiUpdateRecord(recordId, updateData);
        await refreshRecords();
    };

    const deleteRecord = async (recordId) => {
        await apiDeleteRecord(recordId);
        await refreshRecords();
    };

    useEffect(() => {
        const updateLiveRecords = () => {
            const next = buildLiveRecords();
            setLiveRecords(prev => (areLiveRecordsEqual(prev, next) ? prev : next));
        };
        updateLiveRecords();
        const timer = setInterval(updateLiveRecords, LIVE_REFRESH_MS);
        return () => clearInterval(timer);
    }, []);

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
