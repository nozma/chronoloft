import React, { useEffect, useState, useReducer } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// API 関連
import {
    fetchActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    fetchCategories,
    createRecord
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
import CategoryManagementDialog from './CategoryManagementDialog';
import GroupManagementDialog from './GroupManagementDialog';

// ユーティリティとコンテキスト
import getIconForGroup from '../utils/getIconForGroup';
import { calculateTimeDetails } from '../utils/timeUtils';
import { formatToLocal } from '../utils/dateUtils';
import { useActiveActivity } from '../contexts/ActiveActivityContext';

// カスタムフック
import useLocalStorageState from '../hooks/useLocalStorageState';

// UI 状態管理用 reducer
import { initialUIState, uiReducer } from '../reducers/uiReducer';

// ---------------------------------------------------------------------
// ActivityList コンポーネント本体
// ---------------------------------------------------------------------
function ActivityList({ onRecordUpdate, records }) {
    // 通常の状態管理
    const [activities, setActivities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [preFilledValue, setPreFilledValue] = useState(null);

    // ローカルストレージで管理する状態
    const [stopwatchVisible, setStopwatchVisible] = useLocalStorageState('stopwatchVisible', false);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const [discordData, setDiscordData] = useLocalStorageState('discordData', null);

    // 複数のUI状態は reducer で一元管理
    const [uiState, dispatch] = useReducer(uiReducer, initialUIState);
    const { showGrid, categoryDialogOpen, groupDialogOpen, editDialogOpen, confirmDialogOpen, recordDialogOpen } = uiState;
    const { setActiveActivity } = useActiveActivity();

    // -----------------------------------------------------------------
    // API 呼び出し: アクティビティとカテゴリの取得
    // -----------------------------------------------------------------
    useEffect(() => {
        fetchActivities()
            .then(data => setActivities(data))
            .catch(err => setError(err.message));
    }, []);

    useEffect(() => {
        fetchCategories()
            .then(data => setCategories(data))
            .catch(err => console.error(err));
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
    const handleStartRecordFromSelect = (activity) => {
        if (!activity) return;
        setSelectedActivity(activity);
        setActiveActivity(activity);
        if (activity.unit === 'count') {
            dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
        } else if (activity.unit === 'minutes') {
            const details = calculateTimeDetails(activity.id, records);
            const data = {
                group: activity.category_group,
                activity_name: activity.name,
                details: details,
                asset_key: activity.asset_key || "default_image"
            };
            setDiscordData(data);
            setStopwatchVisible(true);
        }
    };

    const handleEditActivity = (activity) => {
        setSelectedActivity(activity);
        dispatch({ type: 'SET_EDIT_DIALOG', payload: true });
    };

    const handleStopwatchComplete = (minutes) => {
        console.log("Stopwatch completed. Elapsed minutes:", minutes);
        setPreFilledValue(minutes);
        setStopwatchVisible(false);
        dispatch({ type: 'SET_RECORD_DIALOG', payload: true });
    };

    const handleRecordCreated = async (recordData) => {
        try {
            const res = await createRecord(recordData);
            console.log("Record created:", res);
            dispatch({ type: 'SET_RECORD_DIALOG', payload: false });
            setSelectedActivity(null);
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
            field: 'category_group',
            headerName: 'グループ',
            width: 150,
            valueFormatter: (params) => {
                if (params === 'study') return "勉強";
                else if (params === 'game') return "ゲーム";
                else if (params === 'workout') return "運動";
                else return params;
            }
        },
        { field: 'category_name', headerName: 'カテゴリ', width: 150 },
        {
            field: 'name',
            headerName: '項目名',
            width: 200,
            renderCell: (params) => {
                const groupName = params.row.category_group;
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getIconForGroup(groupName)}
                        <span>{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'unit',
            headerName: '記録単位',
            width: 100,
            valueFormatter: (params) => {
                if (params === 'minutes') return "分";
                else if (params === 'count') return "回";
                else return params;
            }
        },
        { field: 'asset_key', headerName: 'Asset Key', width: 150 },
        {
            field: 'created_at',
            headerName: '登録日時',
            width: 200,
            valueFormatter: (params) => formatToLocal(params)
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 240,
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
            {!showGrid && !stopwatchVisible && (
                <ActivityStart activities={activities} onStart={handleStartRecordFromSelect} />
            )}
            {/* グリッド表示または管理画面 */}
            {!stopwatchVisible && (
                !showGrid ? (
                    <div>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, gap: '8px' }}>
                            <Button variant="contained" onClick={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: true })}>
                                カテゴリの管理
                            </Button>
                            <Button variant="contained" onClick={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: true })}>
                                グループの管理
                            </Button>
                            <Button variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_GRID', payload: true })}>
                                アクティビティの管理
                            </Button>
                        </Box>
                        <CategoryManagementDialog open={categoryDialogOpen} onClose={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: false })} />
                        <GroupManagementDialog open={groupDialogOpen} onClose={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: false })} />
                    </div>
                ) : (
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
                )
            )}
            <AddActivityDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleActivityAdded}
                categories={categories}
            />
            <ConfirmDialog
                open={confirmDialogOpen}
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
            {editDialogOpen && selectedActivity && (
                <AddActivityDialog
                    open={editDialogOpen}
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
                    categories={categories}
                />
            )}
            {recordDialogOpen && selectedActivity && selectedActivity.unit === 'count' && (
                <AddRecordDialog
                    open={recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={null}
                />
            )}
            {recordDialogOpen && selectedActivity && selectedActivity.unit === 'minutes' && (
                <AddRecordDialog
                    open={recordDialogOpen}
                    onClose={() => dispatch({ type: 'SET_RECORD_DIALOG', payload: false })}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={preFilledValue}
                />
            )}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    onComplete={(minutes) => {
                        handleStopwatchComplete(minutes);
                        setActiveActivity(null);
                    }}
                    onCancel={() => {
                        setStopwatchVisible(false);
                        setSelectedActivity(null);
                        setActiveActivity(null);
                    }}
                    discordData={discordData}
                    activityName={selectedActivity.name}
                    activityGroup={selectedActivity.category_group}
                />
            )}
        </div>
    );
}

export default ActivityList;