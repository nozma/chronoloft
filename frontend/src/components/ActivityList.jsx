import React, { useEffect, useState, useRef } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// API 関連
import {
    fetchActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    createRecord,
} from '../services/api';

// カスタムコンポーネント
import {
    Button,
    Snackbar,
    Alert,
    Box,
    IconButton
} from '@mui/material';
import CustomToolbar from './CustomToolbar';
import AddActivityDialog from './AddActivityDialog';
import ConfirmDialog from './ConfirmDialog';
import AddRecordDialog from './AddRecordDialog';
import Stopwatch from './Stopwatch';
import ActivityStart from './ActivityStart';

// ユーティリティとコンテキスト
import getIconForGroup from '../utils/getIconForGroup';
import { calculateTimeDetails } from '../utils/timeUtils';
import { formatToLocal } from '../utils/dateUtils';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useFilter } from '../contexts/FilterContext';
import { useGroups } from '../contexts/GroupContext';
import { useUI } from '../contexts/UIContext';

// カスタムフック
import useLocalStorageState from '../hooks/useLocalStorageState';

// ---------------------------------------------------------------------
// ActivityList コンポーネント本体
// ---------------------------------------------------------------------
function ActivityList({ onRecordUpdate, records }) {
    // 通常の状態管理
    const { groups } = useGroups();
    const [activities, setActivities] = useState([]);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [preFilledValue, setPreFilledValue] = useState(null);
    const stopwatchRef = useRef(null);
    const [recordDialogActivity, setRecordDialogActivity] = useState(null);

    // ローカルストレージで管理する状態
    const [stopwatchVisible, setStopwatchVisible] = useLocalStorageState('stopwatchVisible', false);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const [discordData, setDiscordData] = useLocalStorageState('discordData', null);

    // UI状態
    const { state, dispatch } = useUI();
    const { setActiveActivity } = useActiveActivity();

    // フィルター状態
    const { setFilterState } = useFilter();

    // -----------------------------------------------------------------
    // API 呼び出し: アクティビティとカテゴリ、グループの取得
    // -----------------------------------------------------------------
    useEffect(() => {
        fetchActivities()
            .then(data => setActivities(data))
            .catch(err => setError(err.message));
    }, []);

    if (error) return <div>Error: {error}</div>;

    // -----------------------------------------------------------------
    // イベントハンドラ
    // -----------------------------------------------------------------
    const handleAddClick = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const handleActivityAdded = async (activityData) => {
        try {
            await addActivity(activityData);
            fetchActivities()
                .then(data => setActivities(data))
                .catch(err => setError(err.message));
        } catch (err) {
            console.error("Failed to add activity:", err);
        }
    };

    const handleDeleteButtonClick = (activityId) => {
        setSelectedActivityId(activityId);
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: true });
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteActivity(selectedActivityId);
            fetchActivities()
                .then(data => setActivities(data))
                .catch(err => setError(err.message));
        } catch (err) {
            console.error("Failed to delete activity:", err);
            setSnackbarMessage(err.message);
            setSnackbarOpen(true);
        }
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        setSelectedActivityId(null);
    };

    const handleCancelDelete = () => {
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        setSelectedActivityId(null);
    };

    const handleSnackbarClose = () => setSnackbarOpen(false);

    const processRowUpdate = async (newRow, oldRow) => {
        try {
            await updateActivity(newRow.id, newRow);
            return newRow;
        } catch (error) {
            console.error("Failed to update activity:", error);
            throw error;
        }
    };

    // activity を選択して開始する処理（分の場合は累計時間計算を利用）
    const handleStartRecordFromSelect = async (activity) => {
        if (!activity) return;
        
        if (activity.unit === 'minutes') {
            // もし現在のストップウォッチが動いていて、かつ現在の selectedActivity が別の minutes アクティビティなら
            // 既存記録を作成してストップウォッチとDiscord接続を一旦停止する。
            if (stopwatchVisible && selectedActivity && selectedActivity.id !== activity.id && stopwatchRef.current) {
                const details = calculateTimeDetails(activity.id, records);
                const newDiscordData = {
                    group: activity.group_name,
                    activity_name: activity.name,
                    details: details,
                    asset_key: activity.asset_key || "default_image"
                };
                const minutes = await stopwatchRef.current.finishAndReset(newDiscordData);
                createRecord({ activity_id: selectedActivity.id, value: minutes });
                onRecordUpdate();
            }
            // ストップウォッチを起動し、Discord連携を開始する
            setSelectedActivity(activity);
            setActiveActivity(activity);
            setFilterState({
                groupFilter: activity.group_name,
                activityNameFilter: activity.name,
            });
            const details = calculateTimeDetails(activity.id, records);
            const data = {
                group: activity.group_name,
                activity_name: activity.name,
                details: details,
                asset_key: activity.asset_key || "default_image"
            };
            setDiscordData(data);
            setStopwatchVisible(true);
        } else if (activity.unit === 'count') {
            // count の場合は、ストップウォッチや Discord 連携はそのままにして、
            // recordDialogActivity（新たな state）に新しいアクティビティをセットし、
            // 記録用ダイアログを開く
            setRecordDialogActivity(activity);
            dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
            // ここでは selectedActivity/activeActivity は変更しない（既存のストップウォッチがあれば継続）
        }
    };

    const handleEditActivity = (activity) => {
        setSelectedActivity(activity);
        dispatch({ type: 'SET_EDIT_DIALOG', payload: true });
    };

    const handleRecordCreated = async (recordData) => {
        try {
            const res = await createRecord(recordData);
            console.log("Record created:", res);
            dispatch({ type: 'SET_RECORD_DIALOG', payload: false });
            setPreFilledValue(null);
            onRecordUpdate();
            fetchActivities()
                .then(data => setActivities(data))
                .catch(err => setError(err.message));
        } catch (err) {
            console.error("Failed to create record:", err);
        }
    };

    // -----------------------------------------------------------------
    // データグリッドの列定義
    // -----------------------------------------------------------------
    const columns = [
        {
            field: 'is_active',
            headerName: 'State',
            valueFormatter: (params) => { return (params ? "Active" : "Inactive") }
        },
        {
            field: 'name',
            headerName: 'Name',
            width: 200,
            renderCell: (params) => {
                const groupName = params.row.group_name;
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getIconForGroup(groupName, groups)}
                        <span>{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'unit',
            headerName: 'Unit',
            valueFormatter: (params) => {
                if (params === 'minutes') return "分";
                else if (params === 'count') return "回";
                else return params;
            }
        },
        { field: 'asset_key', headerName: 'Asset Key', width: 150 },
        {
            field: 'actions',
            headerName: 'Actions',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                return (
                    <>
                        <IconButton onClick={() => handleEditActivity(params.row)} >
                            <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteButtonClick(params.row.id)} >
                            <DeleteIcon />
                        </IconButton>
                    </>
                );
            }
        }
    ];


    return (
        <div>
            {/* アクティビティ選択（ストップウォッチ表示前） */}
            {!state.showGrid && (
                <ActivityStart activities={activities} onStart={handleStartRecordFromSelect} stopwatchVisible={stopwatchVisible} />
            )}
            {/* グリッド表示または管理画面 */}
            {!stopwatchVisible && state.showGrid && (
                <>
                    <div style={{ height: 400, width: '100%', maxWidth: '800px' }}>
                        <DataGrid
                            rows={activities}
                            columns={columns}
                            pageSize={5}
                            rowsPerPageOptions={[5]}
                            disableSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            slots={{ toolbar: CustomToolbar }}
                            slotProps={{
                                toolbar: { addButtonLabel: 'Add Activity', onAddClick: handleAddClick }
                            }}
                        />
                    </div>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, mt: 1 }}>
                        <Button variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_GRID', payload: false })} sx={{ mb: 2 }}>
                            閉じる
                        </Button>
                    </Box>
                </>

            )}
            <AddActivityDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleActivityAdded}
            />
            <ConfirmDialog
                open={state.confirmDialogOpen}
                title="Confirm Deletion"
                content="Are you sure you want to delete this activity?"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
            >
                <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
            {state.editDialogOpen && selectedActivity && (
                <AddActivityDialog
                    open={state.editDialogOpen}
                    onClose={() => dispatch({ type: 'SET_EDIT_DIALOG', payload: false })}
                    onSubmit={async (activityData) => {
                        try {
                            await updateActivity(selectedActivity.id, activityData);
                            const updatedActivities = await fetchActivities();
                            setActivities(updatedActivities);
                            dispatch({ type: 'SET_EDIT_DIALOG', payload: false });
                            setSelectedActivity(null);
                        } catch (err) {
                            console.error("Failed to update activity:", err);
                        }
                    }}
                    initialData={selectedActivity}
                />
            )}
            {state.recordDialogOpen && selectedActivity && selectedActivity.unit === 'count' && (
                <AddRecordDialog
                    open={state.recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={null}
                />
            )}
            {state.recordDialogOpen && recordDialogActivity && recordDialogActivity.unit === 'count' && (
                <AddRecordDialog
                    open={state.recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={recordDialogActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={null}
                />
            )}
            {!recordDialogActivity && state.recordDialogOpen && selectedActivity && selectedActivity.unit === 'minutes' && (
                <AddRecordDialog
                    open={state.recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={preFilledValue}
                />
            )}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    ref={stopwatchRef}
                    onComplete={(minutes) => {
                        createRecord({ activity_id: selectedActivity.id, value: minutes })
                            .then((res) => {
                                console.log("Record created:", res);
                                onRecordUpdate();
                            })
                            .catch((err) => {
                                console.error("Record creation failed:", err);
                            });
                        setStopwatchVisible(false);
                        setActiveActivity(null);
                    }}
                    onCancel={() => {
                        setStopwatchVisible(false);
                        setActiveActivity(null);
                    }}
                    discordData={discordData}
                    activityName={selectedActivity.name}
                    activityGroup={selectedActivity.group_name}
                />
            )}
        </div>
    );
}

export default ActivityList;