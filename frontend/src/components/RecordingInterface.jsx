import { useI18n } from '../i18n/I18nContext';
import { useRef, useState } from 'react';
import { Box, Typography, Menu, MenuItem, IconButton } from '@mui/material';
import { useUI } from '../contexts/UIContext';
import { useActivities } from '../contexts/ActivityContext';
import { useRecords } from '../contexts/RecordContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSharedStopwatches } from '../services/stopwatches';
import ActivityStart from './ActivityStart';
import AddRecordDialog from './AddRecordDialog';
import SharedStopwatches from './SharedStopwatches';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsDialog from './SettingsDialog';
import { clearUiSettings } from '../utils/storageReset';

function RecordingInterface({ showSettingsMenu = true, showHeading = true }) {
    const { t } = useI18n();
    const { dispatch } = useUI();
    const { activities, refreshActivities } = useActivities();
    const { createRecord } = useRecords();
    const { isTwoColumnLayout } = useSettings();
    const shared = useSharedStopwatches();
    const controller = useRef(null);
    const [countActivity, setCountActivity] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const menuOpen = Boolean(anchorEl);
    const main = shared.items.find(item => item.device_id === shared.device?.id && item.slot === 'main');
    const twoColumnFrameSx = {
        p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1,
        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    };
    const handleStart = activity => {
        if (activity.unit === 'minutes') controller.current?.start(activity);
        else if (activity.unit === 'count') setCountActivity(activity);
    };
    return <Box sx={{ mb: 2 }}>
        <SharedStopwatches ref={controller} />
        <Box sx={isTwoColumnLayout ? twoColumnFrameSx : {}}>
            {/* Heading / Title */}
            {(showHeading || showSettingsMenu) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 2 }, mb: 2, pb: 0.5, alignItems: 'center', borderBottom: '1px solid #333' }}>
                    {showHeading && (
                        <>
                            <Typography variant="h5" sx={{ mr: 2 }}>
                                {t("Record Your Activity")}
                            </Typography>
                            <Typography
                                variant='caption'
                                color='#ccc'
                                onClick={() =>
                                    dispatch({
                                        type: 'UPDATE_UI',
                                        payload: {
                                            groupOpen: true,
                                            tagOpen: true,
                                            activityOpen: true,
                                        }
                                    })
                                }
                                sx={{ cursor: 'pointer' }}
                            >
                                {t("Open All")}
                            </Typography>
                            <Typography
                                variant='caption'
                                color='#ccc'
                                onClick={() =>
                                    dispatch({
                                        type: 'UPDATE_UI',
                                        payload: {
                                            groupOpen: false,
                                            tagOpen: false,
                                            activityOpen: false,
                                        }
                                    })
                                }
                                sx={{ cursor: 'pointer' }}
                            >
                                {t("Close All")}
                            </Typography>
                        </>
                    )}
                    {showSettingsMenu && (
                        <Box sx={{ ml: 'auto' }}>
                            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                                <MoreVertIcon />
                            </IconButton>
                        </Box>
                    )}
                </Box>
            )}
            {showSettingsMenu && (
                <>
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={() => setAnchorEl(null)}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        transformOrigin={{ horizontal: 'right' }}
                    >
                        <MenuItem
                            onClick={() => {
                                setSettingsOpen(true);
                                setAnchorEl(null);
                            }}
                        >
                            {t("Settings")}
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                if (confirm(t("All UI settings will be cleared. Continue?"))) {
                                    clearUiSettings();
                                    location.reload();
                                }
                            }}
                        >
                            {t("Reset UI Settings")}
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                location.reload();
                            }}
                        >
                            {t("Reload")}
                        </MenuItem>
                    </Menu>
                    <SettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                    />
                </>
            )}
            <ActivityStart activities={activities} onStart={handleStart}
                stopwatchVisible={Boolean(main)} selectedActivity={activities.find(item => item.id === main?.activity_id)} />
        </Box>
        {countActivity && <AddRecordDialog open activity={countActivity} onClose={() => setCountActivity(null)}
            onSubmit={async data => { await createRecord(data); await refreshActivities(); }} />}
    </Box>;
}

export default RecordingInterface;
