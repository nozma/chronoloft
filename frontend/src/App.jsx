import React, { useState, useEffect } from 'react';
import './App.css';
import Box from '@mui/material/Box';
import RecordingInterface from './components/RecordingInterface';
import History from './components/History';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { fetchRecords } from './services/api';
import { ActiveActivityProvider } from './contexts/ActiveActivityContext';
import { GroupProvider } from './contexts/GroupContext';
import { FilterProvider } from './contexts/FilterContext';
import { UIProvider } from './contexts/UIContext';
import { TagProvider } from './contexts/TagContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { RecordProvider } from './contexts/RecordContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AppHeader from './components/AppHeader';

function App() {
    // カラーテーマ対応
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: prefersDarkMode ? 'dark' : 'light',
                },
                breakpoints: {
                    values: {
                        xs: 0,
                        md: 1100
                    },
                },
            }),
        [prefersDarkMode]
    );

    return (
        <ThemeProvider theme={theme}>
            <Box
                sx={{
                    width: '100%',
                    maxWidth: { xs: '800px', md: '980px' },
                    mx: 'auto',
                    px: 1,       // サイドパディング
                }}
            >
                <CssBaseline />
                <SettingsProvider>
                    <GroupProvider>
                        <TagProvider>
                            <ActivityProvider>
                                <RecordProvider>
                                    <UIProvider>
                                        <FilterProvider>
                                            <ActiveActivityProvider>
                                                <div>
                                                    <AppHeader />
                                                    <RecordingInterface />
                                                    <History />
                                                </div>
                                            </ActiveActivityProvider>
                                        </FilterProvider>
                                    </UIProvider>
                                </RecordProvider>
                            </ActivityProvider>
                        </TagProvider>
                    </GroupProvider>
                </SettingsProvider>
            </Box>
        </ThemeProvider>
    );
}

export default App;