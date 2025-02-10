import React, { useState } from 'react'
import './App.css'
import CategoryManagementDialog from './components/CategoryManagementDialog';
import ActivityList from './components/ActivityList';
import RecordList from './components/RecordList';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';


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

    const [refreshCategory, setRefreshCategory] = useState(false);
    const [refreshActivity, setRefreshActivity] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

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
                <ActivityList key={refreshActivity} />
                <h2>Records</h2>
                <RecordList />
            </div>
        </ThemeProvider>
    );
}

export default App
