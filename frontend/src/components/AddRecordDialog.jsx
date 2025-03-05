// AddRecordDialog.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    MenuItem
} from '@mui/material';
import { DateTime } from 'luxon';

/**
 * AddRecordDialog
 * 
 * Props:
 * - open: bool
 * - onClose: function
 * - onSubmit: function(recordData) => void
 * - activity: { id, unit, name, ... } etc.
 * - initialValue: number (activity.unit===countの場合の回数 or minutes)
 * - initialDate: string (ISO)  # 既存の「created_at」にあたる
 * - isEdit: bool
 * - onDelete: optional, for deletion button
 * 
 * 変更点:
 * - unit==="minutes" のとき、「開始時刻」「終了時刻」のUIを表示
 * - DB保存時は「終了時刻 - 開始時刻」を minutes で計算し、recordData.value に入れる
 * - recordData.created_at = 終了時刻(UTC) をセット
 */
function AddRecordDialog({
    open,
    onClose,
    onSubmit,
    activity,
    initialValue,
    initialDate,
    isEdit = false,
    onDelete
}) {
    const [value, setValue] = useState('');
    const [dateValue, setDateValue] = useState(''); // count用: 既存の記録日時
    const [startTime, setStartTime] = useState(''); // minutes用
    const [endTime, setEndTime] = useState('');     // minutes用

    useEffect(() => {
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
                // 新規 or no initialDate => デフォルト: 今を終了時刻、今-0を開始
                const nowLocal = DateTime.local();
                setEndTime(nowLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
                setStartTime(nowLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
            }
        }
    }, [activity, initialValue, initialDate]);

    // 保存時処理
    const handleSubmit = () => {
        if (activity?.unit === 'count') { // 回数ベース
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
                activity_id: activity.id,
                value: numValue,
                created_at: dtUtc
            };
            onSubmit(recordData);
        } else if (activity?.unit === 'minutes') { // 分ベース：開始時刻と終了時刻を記録
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
            // DBに送るのは {value: durationInMinutes, created_at: 終了時刻(UTC)}
            const recordData = {
                activity_id: activity.id,
                value: duration,
                created_at: endLocal.toUTC().toISO()
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
                {activity && (
                    <>
                        <Typography variant="subtitle1">{activity.name}</Typography>
                    </>
                )}

                {activity?.unit === 'count' && (
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
                    </>
                )}

                {activity?.unit === 'minutes' && (
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