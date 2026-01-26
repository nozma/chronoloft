import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchActivityGroups } from '../services/api';
import useLocalStorageState from '../hooks/useLocalStorageState';

const GroupContext = createContext([]);

export function GroupProvider({ children }) {
    const [groups, setGroups] = useState([]);
    const [groupExclusions, setGroupExclusions] = useLocalStorageState('groupExclusions', {});

    const excludedGroupIds = useMemo(() => {
        const entries = Object.entries(groupExclusions || {});
        const ids = entries
            .filter(([, isExcluded]) => isExcluded)
            .map(([groupId]) => Number(groupId))
            .filter((groupId) => !Number.isNaN(groupId));
        return new Set(ids);
    }, [groupExclusions]);

    const isGroupExcluded = (groupId) => {
        if (groupId === null || groupId === undefined) return false;
        return Boolean(groupExclusions?.[String(groupId)]);
    };

    const setGroupExcluded = (groupId, excluded) => {
        if (groupId === null || groupId === undefined) return;
        const key = String(groupId);
        setGroupExclusions(prev => {
            const next = { ...(prev || {}) };
            if (excluded) {
                next[key] = true;
            } else {
                delete next[key];
            }
            return next;
        });
    };

    useEffect(() => {
        fetchActivityGroups()
            .then(data => setGroups(data))
            .catch(err => console.error("Failed to fetch groups:", err));
    }, []);


    return (
        <GroupContext.Provider value={{
            groups,
            setGroups,
            groupExclusions,
            setGroupExclusions,
            excludedGroupIds,
            isGroupExcluded,
            setGroupExcluded,
        }}>
            {children}
        </GroupContext.Provider>
    );
}

export function useGroups() {
    return useContext(GroupContext);
}
