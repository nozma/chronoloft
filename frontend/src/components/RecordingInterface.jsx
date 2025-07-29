import React, { useRef, useState, useEffect } from 'react';
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
import { createRecord } from '../services/api';
import { calculateTimeDetails } from '../utils/timeUtils';
import { useRecords } from '../contexts/RecordContext';
import { useGroups } from '../contexts/GroupContext';
import { useSettings } from '../contexts/SettingsContext';
import { DateTime } from 'luxon';

function RecordingInterface() {
    const { state, dispatch } = useUI();
    const { setActiveActivity } = useActiveActivity();
    const { setFilterState } = useFilter();
    const { activities } = useActivities();
    const { refreshActivities } = useActivities();
    const { records, refreshRecords: onRecordUpdate } = useRecords();
    const { groups } = useGroups();

    // メインStopwatch
    const [stopwatchVisible, setStopwatchVisible] = useLocalStorageState('stopwatchVisible', false);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const [discordData, setDiscordData] = useLocalStorageState('discordData', null);
    const [mainDisplayTime, setMainDisplayTime] = useState(0);

    // サブStopwatch
    const [subStopwatchVisible, setSubStopwatchVisible] = useLocalStorageState('subStopwatchVisible', false);
    const [subSelectedActivity, setSubSelectedActivity] = useLocalStorageState('subSelectedActivity', null);

    const stopwatchRef = useRef(null);
    const subStopwatchRef = useRef(null);
    const [recordDialogActivity, setRecordDialogActivity] = React.useState(null);

    // ダイアログの初期日時を保持
    const [recordDialogInitialDate, setRecordDialogInitialDate] = useState(null);

    // 設定項目
    const {
        autoFilterOnSelect,
        discordEnabled,
        recordSaveMode,
    } = useSettings();

    // 確認モード時の一時保存データ
    const [pendingRecord, setPendingRecord] = useState(null);
    // 確認モードでダイアログを閉じたあとに開始したいアクティビティ
    const [nextActivity, setNextActivity] = useState(null);

    // タイトル更新
    useEffect(() => {
        // 1) メインだけ動いている
        if (stopwatchVisible && selectedActivity && !subStopwatchVisible) {
            // 経過時間をフォーマット
            const totalSeconds = Math.floor(mainDisplayTime / 1000);
            const hh = Math.floor(totalSeconds / 3600);
            const mm = Math.floor((totalSeconds % 3600) / 60);
            const formattedTime = `${hh}:${String(mm).padStart(2, '0')}`;
            document.title = `(${formattedTime}) ${selectedActivity.name} - Chronoloft`;
        }
        // 2) メインとサブ両方動いている
        else if (stopwatchVisible && selectedActivity && subStopwatchVisible && subSelectedActivity) {
            const totalSeconds = Math.floor(mainDisplayTime / 1000);
            const hh = Math.floor(totalSeconds / 3600);
            const mm = Math.floor((totalSeconds % 3600) / 60);
            const formattedTime = `${hh}:${String(mm).padStart(2, '0')}`;
            document.title = `(${formattedTime}) ${selectedActivity.name} (${subSelectedActivity.name}) - Chronoloft`;
        }
        // 3) サブだけ動いている
        else if (!stopwatchVisible && subStopwatchVisible && subSelectedActivity) {
            document.title = `(${subSelectedActivity.name}) - Chronoloft`;
        }
        // 4) 何も動いていない
        else {
            document.title = 'Chronoloft';
        }
    }, [
        stopwatchVisible,
        subStopwatchVisible,
        selectedActivity,
        subSelectedActivity,
        mainDisplayTime
    ]);

    // 「記録作成」ハンドラ
    const handleStartRecordFromSelect = async (activity) => {
        if (!activity) return;
        if (stopwatchRef.current?.isDiscordBusy) return; // Discordリクエスト中は操作を受け付けない

        // ストップウォッチが動いていない場合、Discord接続中か確認し、接続中ならストップウォッチを開始しない
        // （別のウィンドウでストップウォッチが動作していると考えられるため）
        // ただし、groupにclient_idが設定されていない場合、Discord連係が無効の場合は接続をしないので判定を行わない
        const groupData = groups.find(g => g.name === activity.group_name);
        if (groupData && groupData.client_id !== "" && discordEnabled) {
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
        }


        if (activity.unit === 'minutes') {
            // minutes -> ストップウォッチ
            if (stopwatchVisible && selectedActivity && selectedActivity.id !== activity.id && stopwatchRef.current) {
                // 既に別ストップウォッチが動いている -> 一旦finishAndReset
                const details = calculateTimeDetails(activity.id, records);
                const prevGroup = groups.find(g => g.name === selectedActivity.group_name);
                const newDiscordData = (discordEnabled && prevGroup?.client_id) // 連係有効かつClient IDのあるグループは連係データを組み立てる
                    ? {
                        group: activity.group_name,
                        activity_name: activity.name,
                        details,
                        asset_key: activity.asset_key || "default_image"
                    }
                    : null;
                const { minutes, memo } = await stopwatchRef.current.finishAndReset(newDiscordData);
                if (recordSaveMode === 'confirm') {
                    // 確認モードならダイアログ表示＆次のアクティビティを予約
                    setPendingRecord({ minutes, memo, activity: selectedActivity });
                    setRecordDialogActivity(selectedActivity);
                    setRecordDialogInitialDate(DateTime.local().toISO());
                    dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
                    setNextActivity(activity);
                    return;
                }

                // auto モード: 既存レコードを作成
                await createRecord({ activity_id: selectedActivity.id, value: minutes, memo });
                onRecordUpdate();
            }
            // 新しいActivityを選択
            setSelectedActivity(activity);
            setActiveActivity(activity);

            // 自動フィルタ設定がONの場合、アクティビティフィルタを自動で切り替える
            if (autoFilterOnSelect) {
                setFilterState(prev => ({
                    ...prev,
                    activityNameFilter: activity.name,
                }));
            }

            // Discord presence用データ
            const details = calculateTimeDetails(activity.id, records);
            const groupInfo = groups.find(g => g.name === activity.group_name);
            setDiscordData(
                // Discord連係が有効で、Client IDが設定されている場合のみ設定
                discordEnabled && groupInfo?.client_id
                    ? {
                        group: activity.group_name,
                        activity_name: activity.name,
                        details,
                        asset_key: activity.asset_key || "default_image"
                    }
                    : null // nullの場合はDiscord連係は動作しない
            );

            setStopwatchVisible(true);

        } else if (activity.unit === 'count') {
            // 回数 -> レコードダイアログ
            setRecordDialogActivity(activity);
            setRecordDialogInitialDate(DateTime.local().toISO());
            dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
        }
    };

    // SubStopwatch用ハンドラ
    const handleStartSubStopwatch = async (activity) => {
        if (!activity || activity.unit === 'count') return;

        if (subStopwatchVisible && subSelectedActivity && subSelectedActivity.id !== activity.id && subStopwatchRef.current) {
            const { minutes, memo } = await subStopwatchRef.current.finishAndReset();
            await createRecord({ activity_id: subSelectedActivity.id, value: minutes, memo: memo });
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

    // 完了時ハンドラ
    const handleStopwatchComplete = async (minutes, memo) => {
        if (recordSaveMode === 'auto') {
            // 既存の自動レコード作成ロジック
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
        } else {
            // 確認モード：ダイアログを開く
            setPendingRecord({ minutes, memo, activity: selectedActivity });
            setRecordDialogActivity(selectedActivity);
            setRecordDialogInitialDate(DateTime.local().toISO());
            dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
        }
    };

    return (
        <Box sx={{ mb: 2 }}>
            {/* Stopwatch */}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    ref={stopwatchRef}
                    onComplete={handleStopwatchComplete}
                    onCancel={() => {
                        localStorage.removeItem('stopwatchState');
                        setStopwatchVisible(false);
                        setActiveActivity(null);
                    }}
                    discordData={discordData}
                    activityId={selectedActivity.id}
                    activityName={selectedActivity.name}
                    activityGroup={selectedActivity.group_name}
                    onTick={(time) => setMainDisplayTime(time)}
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
            {/* ダイアログ（回数＋確認モード共通） */}
            {state.recordDialogOpen && (recordDialogActivity.unit === 'count' || pendingRecord) && (
                <AddRecordDialog
                    open={true}
                    autoFocusMemo={Boolean(pendingRecord)}
                    onClose={() => {
                        dispatch({ type: 'SET_RECORD_DIALOG', payload: false });
                        setRecordDialogInitialDate(null);
                        // 確認モードでキャンセルした場合はストップウォッチも閉じる
                        if (pendingRecord) {
                            setPendingRecord(null);
                            localStorage.removeItem('stopwatchState');
                            setStopwatchVisible(false);
                            setActiveActivity(null);
                        }
                        // ダイアログ閉後に予約した nextActivity があれば再開
                        if (nextActivity) {
                            setSelectedActivity(nextActivity);
                            setActiveActivity(nextActivity);
                            if (autoFilterOnSelect) {
                                setFilterState(prev => ({
                                    ...prev,
                                    activityNameFilter: nextActivity.name,
                                }));
                            }
                            const details = calculateTimeDetails(nextActivity.id, records);
                            const groupInfo = groups.find(g => g.name === nextActivity.group_name);
                            setDiscordData(
                                discordEnabled && groupInfo?.client_id
                                    ? {
                                        group: nextActivity.group_name,
                                        activity_name: nextActivity.name,
                                        details,
                                        asset_key: nextActivity.asset_key || 'default_image'
                                    }
                                    : null
                            );
                            setStopwatchVisible(true);
                            setNextActivity(null);
                        }
                    }}
                    onSubmit={async (recordData) => {
                        // 確認モードの場合は pendingRecord をマージ
                        if (pendingRecord) {
                            recordData = {
                                activity_id: pendingRecord.activity.id,
                                value: pendingRecord.minutes,
                                memo: pendingRecord.memo,
                                ...recordData,
                            };
                        }
                        await createRecord(recordData);
                        onRecordUpdate();
                        await refreshActivities();
                        dispatch({ type: 'SET_RECORD_DIALOG', payload: false });
                        setRecordDialogInitialDate(null);
                        setPendingRecord(null);
                        // ダイアログ送信後に予約した nextActivity があれば再開
                        if (nextActivity) {
                            setSelectedActivity(nextActivity);
                            setActiveActivity(nextActivity);
                            if (autoFilterOnSelect) {
                                setFilterState(prev => ({
                                    ...prev,
                                    activityNameFilter: nextActivity.name,
                                }));
                            }
                            const details2 = calculateTimeDetails(nextActivity.id, records);
                            const groupInfo2 = groups.find(g => g.name === nextActivity.group_name);
                            setDiscordData(
                                discordEnabled && groupInfo2?.client_id
                                    ? {
                                        group: nextActivity.group_name,
                                        activity_name: nextActivity.name,
                                        details: details2,
                                        asset_key: nextActivity.asset_key || 'default_image'
                                    }
                                    : null
                            );
                            setStopwatchVisible(true);
                            setNextActivity(null);
                        }
                    }}
                    activity={recordDialogActivity}
                    initialValue={pendingRecord?.minutes}
                    initialMemo={pendingRecord?.memo}
                    initialDate={recordDialogInitialDate}
                    isEdit={false}
                />
            )}
        </Box>
    );
}

export default RecordingInterface;