import React, { useEffect, useState } from 'react';
import {
    fetchActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    fetchCategories,
    createRecord
} from '../services/api';
import { DataGrid } from '@mui/x-data-grid';
import CustomToolbar from './CustomToolbar';
import AddActivityDialog from './AddActivityDialog';
import ConfirmDialog from './ConfirmDialog';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddRecordDialog from './AddRecordDialog';
import Stopwatch from './Stopwatch';
import ActivityStart from './ActivityStart';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import Box from '@mui/material/Box';
import CategoryManagementDialog from './CategoryManagementDialog';
import GroupManagementDialog from './GroupManagementDialog';

function ActivityList({ onRecordUpdate, records }) {
    const [activities, setActivities] = useState([]);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [recordDialogOpen, setRecordDialogOpen] = useState(false);
    const [stopwatchVisible, setStopwatchVisible] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [preFilledValue, setPreFilledValue] = useState(null);
    const [discordData, setDiscordData] = useState(null);
    const [showGrid, setShowGrid] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [activityGridVisible, setActivityGridVisible] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    // 状態の復元
    useEffect(() => {
        const savedVisible = localStorage.getItem('stopwatchVisible');
        if (savedVisible === 'true') {
            setStopwatchVisible(true);
        }
        const savedActivity = localStorage.getItem('selectedActivity');
        if (savedActivity) {
            try {
                setSelectedActivity(JSON.parse(savedActivity));
            } catch (error) {
                console.error("Failed to parse selectedActivity:", error);
            }
        }
        const savedDiscordData = localStorage.getItem('discordData');
        if (savedDiscordData) {
            try {
                setDiscordData(JSON.parse(savedDiscordData));
            } catch (error) {
                console.error("Failed to parse discordData from localStorage:", error);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('stopwatchVisible', stopwatchVisible);
    }, [stopwatchVisible]);

    useEffect(() => {
        if (selectedActivity) {
            localStorage.setItem('selectedActivity', JSON.stringify(selectedActivity));
        } else {
            localStorage.removeItem('selectedActivity');
        }
    }, [selectedActivity]);
    useEffect(() => {
        if (discordData) {
            localStorage.setItem('discordData', JSON.stringify(discordData));
        } else {
            localStorage.removeItem('discordData');
        }
    }, [discordData]);


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

    if (error) {
        return <div>Error: {error}</div>;
    }

    const handleAddClick = () => {
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
    };

    const handleActivityAdded = async (activityData) => {
        try {
            await addActivity(activityData);
            // 新規登録後、再度アクティビティ一覧を取得する
            fetchActivities()
                .then(data => setActivities(data))
                .catch(err => setError(err.message));
        } catch (err) {
            console.error("Failed to add activity:", err);
        }
    };

    // 削除確認ダイアログ
    const handleDeleteButtonClick = (activityId) => {
        setSelectedActivityId(activityId);
        setConfirmDialogOpen(true);
    };

    // 確認ダイアログで「Confirm」が押された場合の削除処理
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
        setConfirmDialogOpen(false);
        setSelectedActivityId(null);
    };

    // ダイアログで「Cancel」が押された場合の処理
    const handleCancelDelete = () => {
        setConfirmDialogOpen(false);
        setSelectedActivityId(null);
    };

    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };

    const processRowUpdate = async (newRow, oldRow) => {
        try {
            await updateActivity(newRow.id, newRow);
            return newRow;
        } catch (error) {
            console.error("Failed to update activity:", error);
            throw error;
        }
    };

    // 累計時間を計算する関数
    const calculateTimeDetails = (activityId, records) => {
        console.log("Calculating for activityId:", activityId);
        console.log("Received records:", records);
        const now = new Date();
        const last30Days = new Date();
        last30Days.setDate(now.getDate() - 30);
        // activity_idが一致するレコードを抽出
        const activityRecords = records.filter(rec => rec.activity_id === activityId);
        const totalOverall = activityRecords.reduce((sum, rec) => sum + rec.value, 0);
        const totalLast30Days = activityRecords
            .filter(rec => new Date(rec.created_at) >= last30Days)
            .reduce((sum, rec) => sum + rec.value, 0);
        // 時間表示をフォーマット
        const formatTime30Days = (minutes) => {
            const hrs = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `${hrs}時間${mins}分`;
        };
        const formatTimeTotal = (minutes) => {
            const hrs = Math.floor(minutes / 60);
            return `${hrs}時間`;
        };
        return `${formatTime30Days(totalLast30Days)}/30日 (合計${formatTimeTotal(totalOverall)})`;
    };

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
                let IconComponent = null;
                const groupName = params.row.category_group; // APIレスポンスのフィールド名に合わせる
                if (groupName === 'study') {
                    IconComponent = MenuBookIcon;
                } else if (groupName === 'game') {
                    IconComponent = SportsEsportsIcon;
                } else if (groupName === 'workout') {
                    IconComponent = FitnessCenterIcon;
                } else {
                    IconComponent = HomeWorkIcon;
                }

                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {IconComponent && <IconComponent style={{ marginRight: 8 }} />}
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
            headerName: '登録日',
            width: 200,
            valueFormatter: (params) => {
                const date = new Date(params);
                const year = date.getFullYear();
                const month = ("0" + (date.getMonth() + 1)).slice(-2);
                const day = ("0" + date.getDate()).slice(-2);
                return `${year}年${month}月${day}日`;
            }
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
                        <Button
                            variant="outlined"
                            color="info"
                            onClick={() => handleEditActivity(params.row)}
                            sx={{ mr: 1 }}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={() => handleDeleteButtonClick(params.row.id)}
                        >
                            Delete
                        </Button>
                    </>
                );
            }
        }
    ];

    // activityを選択して開始する場合の処理
    const handleStartRecordFromSelect = (activity) => {
        if (!activity) return;
        setSelectedActivity(activity);
        if (activity.unit === 'count') {
            setRecordDialogOpen(true);
        } else if (activity.unit === 'minutes') {
            // minutes の場合は、Discord 連携用の情報を組み立てる
            const details = calculateTimeDetails(activity.id, records);
            const data = {
                group: activity.category_group,       // 例: "study"（バックエンドのレスポンスに合わせる）
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
        setEditDialogOpen(true);
    };

    // Stopwatch 完了時の処理
    const handleStopwatchComplete = (minutes) => {
        console.log("Stopwatch completed. Elapsed minutes:", minutes);
        // ストップウォッチの計測結果を preFilledValue にセットし、確認用ダイアログを表示する
        setPreFilledValue(minutes);
        setStopwatchVisible(false);
        setRecordDialogOpen(true);
    };

    // Recordダイアログでレコード作成が完了したときの処理
    const handleRecordCreated = async (recordData) => {
        try {
            const res = await createRecord(recordData);
            console.log("Record created:", res);
            setRecordDialogOpen(false);
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
    
    return (
        <div>
            {!showGrid && !stopwatchVisible && (<ActivityStart activities={activities} onStart={handleStartRecordFromSelect} />)}
            {!stopwatchVisible && (
                !showGrid ? (
                    <div>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, gap: '8px' }}>
                            <Button variant="contained" onClick={() => setCategoryDialogOpen(true)}>
                                カテゴリの管理
                            </Button>
                            <Button variant="contained" onClick={() => setGroupDialogOpen(true)}>
                                グループの管理
                            </Button>
                            <Button variant="contained" onClick={() => setShowGrid(true)}>
                                アクティビティの管理
                            </Button>
                        </Box>
                        <CategoryManagementDialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} />
                        <GroupManagementDialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} />
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
                                slots={{
                                    toolbar: CustomToolbar,
                                }}
                                slotProps={{
                                    toolbar: { addButtonLabel: 'Add Activity', onAddClick: handleAddClick },
                                }}
                            />
                        </div>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, mt: 1 }}>
                            <Button variant="contained" onClick={() => setShowGrid(false)} sx={{ mb: 2 }}>
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
            {/* 編集ダイアログ */}
            {editDialogOpen && selectedActivity && (
                <AddActivityDialog
                    open={editDialogOpen}
                    onClose={() => setEditDialogOpen(false)}
                    onSubmit={async (activityData) => {
                        try {
                            await updateActivity(selectedActivity.id, activityData);
                            const updatedActivities = await fetchActivities();
                            setActivities(updatedActivities);
                            setEditDialogOpen(false);
                            setSelectedActivity(null);
                        } catch (err) {
                            console.error("Failed to update activity:", err);
                        }
                    }}
                    // 編集用の場合は初期値を selectedActivity に設定
                    initialData={selectedActivity}
                    categories={categories}
                />
            )}
            {/* 「count」用のレコード作成ダイアログ */}
            {recordDialogOpen && selectedActivity && selectedActivity.unit === 'count' && (
                <AddRecordDialog
                    open={recordDialogOpen}
                    onClose={() => setRecordDialogOpen(false)}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={null}  // この場合はユーザーが入力するので初期値は不要
                />
            )}
            {/* 「minutes」用のレコード作成ダイアログ、初期値としてストップウォッチ計測結果を渡す */}
            {recordDialogOpen && selectedActivity && selectedActivity.unit === 'minutes' && (
                <AddRecordDialog
                    open={recordDialogOpen}
                    onClose={() => setRecordDialogOpen(false)}
                    activity={selectedActivity}
                    onSubmit={handleRecordCreated}
                    initialValue={preFilledValue}  // ここに計測結果（分）が初期値としてセットされる
                />
            )}
            {/* Stopwatch UI */}
            {stopwatchVisible && selectedActivity && selectedActivity.unit === 'minutes' && (
                <Stopwatch
                    onComplete={handleStopwatchComplete}
                    onCancel={() => {
                        setStopwatchVisible(false);
                        setSelectedActivity(null);
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