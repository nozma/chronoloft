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
import AppHeader from './components/AppHeader';
import { useSettings } from './contexts/SettingsContext';

function App() {
    // カラーテーマ対応
    const { themeMode } = useSettings();
    const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
    const resolvedMode =
        themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;

    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: resolvedMode
                },
                breakpoints: {
                    values: {
                        xs: 0,
                        md: 1100
                    },
                },
            }),
        [resolvedMode]
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
            </Box>
        </ThemeProvider>
    );
}

export default App;