import React, { useState } from 'react'
import './App.css'
import CategoryList from './components/CategoryList';
import ActivityList from './components/ActivityList';
import RecordList from './components/RecordList';
import AddCategory from './components/AddCategory';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';

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

    const handleCategoryAdded = (newCategory) => {
        setRefreshCategory(!refreshCategory);
    }
    const handleActivityAdded = (newActivity) => {
        setRefreshActivity(!refreshActivity);
      };

    return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div>
        <h1>Activity Tracker</h1>
        <h2>Categories</h2>
        <AddCategory onCategoryAdded={handleCategoryAdded}/>
        <CategoryList key={refreshCategory} />
        <h2>Activities</h2>
        <ActivityList key={refreshActivity} />
        <h2>Records</h2>
        <RecordList />
      </div>
    </ThemeProvider>
    );
  }
  
export default App
