import React, { useEffect } from 'react';
import './App.css';
import Box from '@mui/material/Box';
import RecordingInterface from './components/RecordingInterface';
import History from './components/History';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
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
    const { themeMode, layoutMode } = useSettings();
    const isTwoColumnLayout = layoutMode === 'two-column';
    const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
    const resolvedMode =
        themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;

    useEffect(() => {
        document.documentElement.dataset.theme = resolvedMode;
        document.documentElement.style.colorScheme = resolvedMode;
        document.body.dataset.theme = resolvedMode;
        document.body.style.colorScheme = resolvedMode;
    }, [resolvedMode]);

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
    const twoColumnSidebarSx = {
        position: 'sticky',
        top: '1rem',
        maxHeight: 'calc(100dvh - 2rem)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
    };
    const twoColumnPaneFrameSx = {
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.02)',
    };

    return (
        <ThemeProvider theme={theme}>
            <Box
                sx={{
                    width: '100%',
                    maxWidth: isTwoColumnLayout
                        ? { xs: '920px', md: '1180px' }
                        : { xs: '800px', md: '980px' },
                    mx: 'auto',
                    px: isTwoColumnLayout ? 0.5 : 1, // サイドパディング
                }}
            >
                <CssBaseline enableColorScheme />
                <GroupProvider>
                    <TagProvider>
                        <ActivityProvider>
                            <RecordProvider>
                                <UIProvider>
                                    <FilterProvider>
                                        <ActiveActivityProvider>
                                            <div>
                                                <AppHeader />
                                                {isTwoColumnLayout ? (
                                                    <Box
                                                        sx={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '320px minmax(0, 1fr)',
                                                            gap: 2,
                                                            alignItems: 'start',
                                                        }}
                                                    >
                                                        <Box
                                                            component="aside"
                                                            sx={twoColumnSidebarSx}
                                                        >
                                                            <RecordingInterface showSettingsMenu={false} showHeading={false} />
                                                        </Box>
                                                        <Box component="main" sx={{ minWidth: 0 }}>
                                                            <Box sx={twoColumnPaneFrameSx}>
                                                                <History />
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <>
                                                        <RecordingInterface showSettingsMenu={true} />
                                                        <History />
                                                    </>
                                                )}
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
