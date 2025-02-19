import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchActivityGroups } from '../services/api';

const GroupContext = createContext([]);

export function GroupProvider({ children }) {
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        fetchActivityGroups()
            .then(data => setGroups(data))
            .catch(err => console.error("Failed to fetch groups:", err));
    }, []);


    return (
        <GroupContext.Provider value={groups}>
            {children}
        </GroupContext.Provider>
    );
}

export function useGroups() {
    return useContext(GroupContext);
}