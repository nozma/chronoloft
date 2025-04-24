// AddRecordDialog.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem
} from '@mui/material';
import { DateTime } from 'luxon';
import { useActivities } from '../contexts/ActivityContext'

function AddRecordDialog({
    open,
    onClose,
    onSubmit,
    activity,
    initialValue,
    initialDate,
    initialMemo = '',
    isEdit = false,
    onDelete
}) {
    const { activities } = useActivities();
    const [selectedActivity, setSelectedActivity] = useState(activity);
    const [value, setValue] = useState('');
    const [dateValue, setDateValue] = useState(''); // count用: 記録日時
    const [startTime, setStartTime] = useState(''); // minutes用: 開始日時
    const [endTime, setEndTime] = useState('');     // minutes用: 終了日時
    const [memo, setMemo] = useState('');

    // activitiesを元のactivityとunitが一致するものに絞り込む
    const compatibleActivities = activities.filter(a => a.unit === activity.unit);

    useEffect(() => {
        if (!activity) return;
        setSelectedActivity(activity);

        if (activity?.unit === 'count') {
            setValue(initialValue ? String(initialValue) : '');
            if (initialDate) {
                const localStr = DateTime.fromISO(initialDate, { zone: 'utc' })
                    .toLocal()
                    .toFormat("yyyy-MM-dd'T'HH:mm");
                setDateValue(localStr);
            } else {
                setDateValue(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
            }
        } else if (activity?.unit === 'minutes') {
            if (initialDate) {
                // 終了時刻(ローカル)
                const endLocal = DateTime.fromISO(initialDate, { zone: 'utc' }).toLocal();
                setEndTime(endLocal.toFormat("yyyy-MM-dd'T'HH:mm"));

                // 開始時刻(=終了時刻 - duration)
                const durationMinutes = initialValue ?? 0;
                const startLocal = endLocal.minus({ minutes: durationMinutes });
                setStartTime(startLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
            } else {
                // 新規の場合は現在日時を設定
                const nowLocal = DateTime.local();
                setEndTime(nowLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
                setStartTime(nowLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
            }
        }
        if (isEdit) {
            setMemo(initialMemo ?? '');
        }
    }, [activity, initialValue, initialDate, initialMemo]);

    // 保存時処理
    const handleSubmit = () => {
        if (!selectedActivity) return;
        if (selectedActivity?.unit === 'count') { // 回数により記録するもの
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                alert("有効な数値（回数）を入力してください。");
                return;
            }
            const dtLocal = DateTime.fromFormat(dateValue, "yyyy-MM-dd'T'HH:mm");
            if (!dtLocal.isValid) {
                alert("日時が不正です");
                return;
            }
            const dtUtc = dtLocal.toUTC().toISO();

            const recordData = {
                activity_id: selectedActivity.id,
                value: numValue,
                created_at: dtUtc,
                memo: memo,
            };
            onSubmit(recordData);
        } else if (selectedActivity?.unit === 'minutes') { // 分（開始時刻と終了時刻）により記録するもの
            const startLocal = DateTime.fromFormat(startTime, "yyyy-MM-dd'T'HH:mm");
            const endLocal = DateTime.fromFormat(endTime, "yyyy-MM-dd'T'HH:mm");

            if (!startLocal.isValid || !endLocal.isValid) {
                alert("開始時刻または終了時刻が不正です");
                return;
            }
            // バリデーション: 開始<=終了
            if (startLocal > endLocal) {
                alert("開始時刻が終了時刻を超えています。");
                return;
            }

            const duration = endLocal.diff(startLocal, 'minutes').toObject().minutes ?? 0;
            // DBに送るのは終了時刻と経過時間（分） {value: durationInMinutes, created_at: 終了時刻(UTC)}
            const recordData = {
                activity_id: selectedActivity.id,
                value: duration,
                created_at: endLocal.toUTC().toISO(),
                memo: memo,
            };
            onSubmit(recordData);
        }
        onClose();
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        await onDelete();
        onClose();
    };

    const handleClose = () => {
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>{isEdit ? "編集" : "新規作成"}</DialogTitle>
            <DialogContent>
                <TextField
                    select
                    label="アクティビティ"
                    fullWidth
                    margin="dense"
                    value={selectedActivity?.id || ''}
                    onChange={(e) => {
                        const newAct = activities.find(a => a.id === Number(e.target.value));
                        if (newAct) setSelectedActivity(newAct);
                    }}
                >
                    {compatibleActivities.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                            {a.name}
                        </MenuItem>
                    ))}
                </TextField>

                {selectedActivity?.unit === 'count' && (
                    <>
                        <TextField
                            label="回数"
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            label="記録日時"
                            type="datetime-local"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            label="memo"
                            multiline
                            minRows={2}
                            fullWidth
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            sx={{ mt: 2 }}
                        />
                    </>
                )}

                {selectedActivity?.unit === 'minutes' && (
                    <>
                        <TextField
                            label="開始時刻"
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            label="終了時刻"
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            label="memo"
                            multiline
                            minRows={2}
                            fullWidth
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            sx={{ mt: 2 }}
                        />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {isEdit && onDelete && (
                    <Button onClick={handleDelete} color="error" sx={{ mr: 'auto' }}>
                        Delete
                    </Button>
                )}
                <Button onClick={handleClose}>キャンセル</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default AddRecordDialog;