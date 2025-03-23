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
import SubStopwatch from './SubStopwatch';
import ActivityList from './ActivityList';
import { createRecord } from '../services/api';
import { calculateTimeDetails } from '../utils/timeUtils';
import { useRecords } from '../contexts/RecordContext';

function RecordingInterface() {
    const { state, dispatch } = useUI();
    const { setActiveActivity } = useActiveActivity();
    const { setFilterState } = useFilter();
    const { activities } = useActivities();
    const { refreshActivities } = useActivities();
    const { records, refreshRecords: onRecordUpdate } = useRecords();

    const [stopwatchVisible, setStopwatchVisible] = useLocalStorageState('stopwatchVisible', false);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const [discordData, setDiscordData] = useLocalStorageState('discordData', null);

    const [subStopwatchVisible, setSubStopwatchVisible] = useLocalStorageState('subStopwatchVisible', false);
    const [subSelectedActivity, setSubSelectedActivity] = useLocalStorageState('subSelectedActivity', null);

    const stopwatchRef = useRef(null);
    const subStopwatchRef = useRef(null);
    const [recordDialogActivity, setRecordDialogActivity] = React.useState(null);

    // 「記録作成」ハンドラ
    const handleStartRecordFromSelect = async (activity) => {
        if (!activity) return;
        // ストップウォッチが動いていない場合、
        // Discord接続中か確認し、接続中ならストップウォッチを開始しない
        // （別のウィンドウでストップウォッチが動作していると考えられるため）
        if (!stopwatchVisible) {
            try {
                const presenceRes = await fetch('/api/discord_presence/status');
                const presenceData = await presenceRes.json();
                if (presenceData.connected) {
                    alert("Discord presence is active. Skipping stopwatch start.");
                    return;
                }
            } catch (e) {
                console.error("Failed to check Discord presence:", e);
            }
        }


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

    // SubStopwatch用ハンドラ
    const handleStartSubStopwatch = async (activity) => {
        if (!activity || activity.unit === 'count') return;

        if (subStopwatchVisible && subSelectedActivity && subSelectedActivity.id !== activity.id && subStopwatchRef.current) {
            const minutes = await subStopwatchRef.current.finishAndReset();
            await createRecord({ activity_id: subSelectedActivity.id, value: minutes });
            onRecordUpdate();
        }
        setSubSelectedActivity(activity);
        setSubStopwatchVisible(true);
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
            {/* Stopwatch */}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    ref={stopwatchRef}
                    onComplete={async (minutes, memo) => {
                        await createRecord({
                            activity_id: selectedActivity.id,
                            value: minutes,
                            memo: memo
                        });
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
            {subStopwatchVisible && subSelectedActivity && subSelectedActivity.unit === 'minutes' && (
                <SubStopwatch
                    ref={subStopwatchRef}
                    onComplete={async (minutes, memo) => {
                        await createRecord({ activity_id: subSelectedActivity.id, value: minutes, memo });
                        onRecordUpdate();
                        await refreshActivities();
                        localStorage.removeItem('subStopwatchState');
                        setSubStopwatchVisible(false);
                    }}
                    onCancel={() => {
                        localStorage.removeItem('subStopwatchState');
                        setSubStopwatchVisible(false);
                    }}
                    activityName={subSelectedActivity.name}
                    activityGroup={subSelectedActivity.group_name}
                />
            )}
            {/* Heading / Title */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 0.5, alignItems: 'baseline', borderBottom: '1px solid #333' }}>
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
                                activityOpen: true,
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
                                activityOpen: false,
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
                onStartSubStopwatch={handleStartSubStopwatch}
            />
            <ActivityList />
            {/* Count用ダイアログ */}
            {state.recordDialogOpen && recordDialogActivity && recordDialogActivity.unit === 'count' && (
                <AddRecordDialog
                    open={state.recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={recordDialogActivity}
                    onSubmit={handleRecordCreated}
                />
            )}
        </Box>
    );
}

export default RecordingInterface;