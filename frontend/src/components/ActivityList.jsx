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

function ActivityList() {
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
    const [allRecords, setAllRecords] = useState([]);

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
            // newRow は編集後の行全体のデータです。
            // updateActivity は、activity の更新を行う API 関数です。
            await updateActivity(newRow.id, newRow);
            // 更新が成功したら newRow を返す（これが DataGrid の内部状態に反映される）
            return newRow;
        } catch (error) {
            console.error("Failed to update activity:", error);
            // エラーが発生した場合は例外を投げることで、変更が取り消される
            throw error;
        }
    };

    // 累計時間を計算する関数
    const calculateTimeDetails = (activityId, records) => {
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
        { field: 'id', headerName: 'ID', width: 70 },
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
        { field: 'name', headerName: '項目名', width: 150, editable: true },
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
        { field: 'asset_key', headerName: 'Asset Key', width: 150, editable: true },
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
                            variant="contained"
                            color="secondary"
                            onClick={() => handleDeleteButtonClick(params.row.id)}
                        >
                            Delete
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleStartRecord(params.row)}
                        >
                            Start
                        </Button>
                    </>
                );
            }
        }
    ];

    // 「Start」ボタン押下時の処理
    const handleStartRecord = (activity) => {
        setSelectedActivity(activity);
        if (activity.unit === 'count') {
            // 「回」の場合はダイアログを表示
            setRecordDialogOpen(true);
        } else if (activity.unit === 'minutes') {
            // discordData に必要な情報を組み立てる
            const details = calculateTimeDetails(activity.id, allRecords);
            const data = {
                group: activity.category_group,       // 例: "study"（バックエンドのレスポンスに合わせる）
                activity_name: activity.name,
                details: details,  // 後ほど計算結果をセットする
                asset_key: activity.asset_key || "default_image"
            };
            setDiscordData(data);
            setStopwatchVisible(true);
        }
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
            // 必要なら一覧再取得など
        } catch (err) {
            console.error("Failed to create record:", err);
        }
    };

    return (
        <div>
            <div style={{ height: 400, width: '100%' }}>
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
                />
            )}
        </div>
    );
}

export default ActivityList;