import React, { useState, useEffect } from 'react';
import './App.css';
import ActivityList from './components/ActivityList';
import RecordList from './components/RecordList';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { fetchRecords, fetchCategories } from './services/api';
import { ActiveActivityProvider } from './contexts/ActiveActivityContext';
import { GroupProvider } from './contexts/GroupContext';
import { CategoryProvider } from './contexts/CategoryContext';
import { FilterProvider } from './contexts/FilterContext';

function App() {
    // カラーテーマ対応
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                },
            }),
        [prefersDarkMode]
    );

    const [records, setRecords] = useState([]);
    const [categories, setCategories] = useState([]);


    // 初回または更新時に最新のレコード一覧を取得する関数
    const updateRecords = async () => {
        try {
            const data = await fetchRecords();
            // 新しい配列の参照で更新
            setRecords([...data]);
        } catch (error) {
            console.error("Failed to fetch records:", error);
        }
    };

    // カテゴリ一覧を取得する関数
    const updateCategories = async () => {
        try {
            const data = await fetchCategories();
            setCategories([...data]);
        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };

    // 初回取得
    useEffect(() => {
        updateRecords();
        updateCategories();
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <GroupProvider>
                <CategoryProvider>
                    <FilterProvider>
                        <ActiveActivityProvider>
                            <div>
                                <h2>Activities</h2>
                                <ActivityList onRecordUpdate={updateRecords} records={records} />
                                <h2>Records</h2>
                                <RecordList records={records} categories={categories} onRecordUpdate={updateRecords} />
                            </div>
                        </ActiveActivityProvider>
                    </FilterProvider>
                </CategoryProvider>
            </GroupProvider>
        </ThemeProvider>
    );
}

export default App;