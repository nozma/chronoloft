import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    fetchRecords as apiFetchRecords,
    createRecord as apiCreateRecord,
    updateRecord as apiUpdateRecord,
    deleteRecord as apiDeleteRecord
} from '../services/api';

const RecordContext = createContext();

export function RecordProvider({ children }) {
    const [records, setRecords] = useState([]);

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

    return (
        <RecordContext.Provider value={{
            records,
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