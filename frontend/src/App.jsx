import React, { useState, useEffect } from 'react';
import './App.css';
import CategoryManagementDialog from './components/CategoryManagementDialog';
import ActivityList from './components/ActivityList';
import RecordList from './components/RecordList';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';
import { fetchRecords, fetchCategories } from './services/api';

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
                <h2>Activities</h2>
                <Button variant="contained" onClick={handleOpenCategoryDialog}>
                    カテゴリの管理
                </Button>
                <CategoryManagementDialog
                    open={categoryDialogOpen}
                    onClose={handleCloseCategoryDialog}
                />
                <ActivityList onRecordUpdate={updateRecords} records={records} />
                <h2>Records</h2>
                <RecordList records={records} categories={categories} onRecordUpdate={updateRecords} />
            </div>
        </ThemeProvider>
    );
}

export default App;