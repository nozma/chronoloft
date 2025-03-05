import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchRecords, createRecord, updateRecord, deleteRecord } from '../services/api';

const RecordContext = createContext();

export function RecordProvider({ children }) {
    const [records, setRecords] = useState([]);

    useEffect(() => {
        refreshRecords();
    }, []);

    const refreshRecords = async () => {
        try {
            const data = await fetchRecords();
            setRecords(data);
        } catch (err) {
            console.error('Failed to fetch records:', err);
        }
    };

    const createRecordInContext = async (recordData) => {
        try {
            await createRecord(recordData);
            await refreshRecords();
        } catch (err) {
            console.error('Failed to create record:', err);
            throw err;
        }
    };

    const updateRecordInContext = async (recordId, updateData) => {
        try {
            await updateRecord(recordId, updateData);
            await refreshRecords();
        } catch (err) {
            console.error('Failed to update record:', err);
            throw err;
        }
    };

    const deleteRecordInContext = async (recordId) => {
        try {
            await deleteRecord(recordId);
            await refreshRecords();
        } catch (err) {
            console.error('Failed to delete record:', err);
            throw err;
        }
    };

    return (
        <RecordContext.Provider value={{
            records,
            refreshRecords,
            createRecordInContext,
            updateRecordInContext,
            deleteRecordInContext
        }}>
            {children}
        </RecordContext.Provider>
    );
}

export function useRecords() {
    return useContext(RecordContext);
}