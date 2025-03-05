import React, { useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { useUI } from '../contexts/UIContext';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useFilter } from '../contexts/FilterContext';
import { useActivities } from '../contexts/ActivityContext';
import useLocalStorageState from '../hooks/useLocalStorageState';

import ActivityStart from './ActivityStart';
import AddRecordDialog from './AddRecordDialog';
import Stopwatch from './Stopwatch';
import ActivityList from './ActivityList';
import { createRecord } from '../services/api';
import { calculateTimeDetails } from '../utils/timeUtils';

function RecordingInterface({ onRecordUpdate, records }) {
    const { state, dispatch } = useUI();
    const { setActiveActivity } = useActiveActivity();
    const { setFilterState } = useFilter();
    const { activities } = useActivities();
    const { refreshActivities } = useActivities();

    const [stopwatchVisible, setStopwatchVisible] = useLocalStorageState('stopwatchVisible', false);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const [discordData, setDiscordData] = useLocalStorageState('discordData', null);

    const stopwatchRef = useRef(null);
    const [recordDialogActivity, setRecordDialogActivity] = React.useState(null);

    // 「記録作成」ハンドラ
    const handleStartRecordFromSelect = async (activity) => {
        if (!activity) return;

        if (activity.unit === 'minutes') {
            // minutes -> ストップウォッチ
            if (stopwatchVisible && selectedActivity && selectedActivity.id !== activity.id && stopwatchRef.current) {
                // 既に別ストップウォッチが動いている -> 一旦finishAndReset
                const details = calculateTimeDetails(activity.id, records);
                const newDiscordData = {
                    group: activity.group_name,
                    activity_name: activity.name,
                    details: details,
                    asset_key: activity.asset_key || "default_image"
                };
                const minutes = await stopwatchRef.current.finishAndReset(newDiscordData);
                // 既存Activityの記録を作成
                if (selectedActivity?.id) {
                    await createRecord({ activity_id: selectedActivity.id, value: minutes });
                    onRecordUpdate();
                }
            }
            // 新しいActivityを選択
            setSelectedActivity(activity);
            setActiveActivity(activity);

            // FilterContextに反映するなど
            setFilterState(prev => ({
                ...prev,
                activityNameFilter: activity.name,
            }));

            // Discord presence用データ
            const details = calculateTimeDetails(activity.id, records);
            setDiscordData({
                group: activity.group_name,
                activity_name: activity.name,
                details,
                asset_key: activity.asset_key || "default_image"
            });
            setStopwatchVisible(true);

        } else if (activity.unit === 'count') {
            // 回数 -> レコードダイアログ
            setRecordDialogActivity(activity);
            dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
        }
    };

    // 回数ダイアログでのレコード作成
    const handleRecordCreated = async (recordData) => {
        try {
            await createRecord(recordData);
            dispatch({ type: 'SET_RECORD_DIALOG', payload: false });
            onRecordUpdate();
            await refreshActivities();
        } catch (err) {
            console.error("Failed to create record:", err);
        }
    };

    return (
        <Box sx={{ mb: 2 }}>
            {/* Heading / Title */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'baseline' }}>
                <Typography variant="h5" sx={{ mr: 2 }}>
                    Record Your Activity
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
                            }
                        })
                    }
                    sx={{ cursor: 'pointer' }}
                >
                    Open All
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
                            }
                        })
                    }
                    sx={{ cursor: 'pointer' }}
                >
                    Close All
                </Typography>
            </Box>
            <ActivityStart
                activities={activities}
                onStart={handleStartRecordFromSelect}
                stopwatchVisible={stopwatchVisible}
            />
            <ActivityList onRecordUpdate={onRecordUpdate} records={records} />
            {/* Count用ダイアログ */}
            {state.recordDialogOpen && recordDialogActivity && recordDialogActivity.unit === 'count' && (
                <AddRecordDialog
                    open={state.recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={recordDialogActivity}
                    onSubmit={handleRecordCreated}
                />
            )}
            {/* Stopwatch */}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    ref={stopwatchRef}
                    onComplete={async (minutes) => {
                        await createRecord({ activity_id: selectedActivity.id, value: minutes });
                        onRecordUpdate();
                        await refreshActivities();
                        localStorage.removeItem('stopwatchState');
                        setStopwatchVisible(false);
                        setActiveActivity(null);
                    }}
                    onCancel={() => {
                        localStorage.removeItem('stopwatchState');
                        setStopwatchVisible(false);
                        setActiveActivity(null);
                    }}
                    discordData={discordData}
                    activityName={selectedActivity.name}
                    activityGroup={selectedActivity.group_name}
                />
            )}
        </Box>
    );
}

export default RecordingInterface;