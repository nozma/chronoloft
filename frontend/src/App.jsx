import React, { useState, useEffect } from 'react';
import './App.css';
import CategoryManagementDialog from './components/CategoryManagementDialog';
import ActivityList from './components/ActivityList';
import RecordList from './components/RecordList';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';
import { fetchRecords } from './services/api';

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

    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    // 共通で管理するレコード一覧の状態
    const [records, setRecords] = useState([]);

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

    // 初回取得
    useEffect(() => {
        updateRecords();
    }, []);

    const handleOpenCategoryDialog = () => {
        setCategoryDialogOpen(true);
    };

    const handleCloseCategoryDialog = () => {
        setCategoryDialogOpen(false);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <div>
                <h1>Activity Tracker</h1>
                <h2>Activities</h2>
                <Button variant="contained" onClick={handleOpenCategoryDialog}>
                    カテゴリの管理
                </Button>
                <CategoryManagementDialog
                    open={categoryDialogOpen}
                    onClose={handleCloseCategoryDialog}
                />
                {/* ActivityList にはレコード作成後に updateRecords() を呼び出すためのコールバックを渡す */}
                <ActivityList onRecordUpdate={updateRecords} records={records} />
                <h2>Records</h2>
                {/* RecordList には最新のレコード一覧を props として渡す */}
                <RecordList records={records} onRecordUpdate={updateRecords} />
            </div>
        </ThemeProvider>
    );
}

export default App;