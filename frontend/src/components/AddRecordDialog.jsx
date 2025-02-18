import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';

function AddRecordDialog({ open, onClose, onSubmit, activity, initialValue, initialDate, isEdit }) {
    const [value, setValue] = useState(
        initialValue !== undefined && initialValue !== null ? String(initialValue) : ''
    );
    // 初期日時の設定
    const getDefaultDate = () => {
        if (initialDate) {
            // サーバーから渡された日時はUTCである前提。Luxonでローカルに変換して表示形式にする。
            return DateTime.fromISO(initialDate, { zone: 'utc' })
                .setZone(DateTime.local().zoneName)
                .toFormat("yyyy-MM-dd'T'HH:mm");
        }
        // 初回は現在のローカル日時
        return DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm");
    };
    const [dateValue, setDateValue] = useState(getDefaultDate());

    useEffect(() => {
        setValue(initialValue !== undefined && initialValue !== null ? Number(initialValue).toFixed(1) : '');
    }, [initialValue]);

    useEffect(() => {
        setDateValue(getDefaultDate());
    }, [initialDate]);

    const handleSubmit = () => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            alert("有効な数値を入力してください。");
            return;
        }
        const recordData = { activity_id: activity.id, value: numValue };
        if (dateValue) {
            // ユーザーが入力したローカル日時を、Luxon で UTC の ISO 形式に変換
            const utcDate = DateTime.fromFormat(dateValue, "yyyy-MM-dd'T'HH:mm", { zone: DateTime.local().zoneName })
                .toUTC()
                .toISO();
            recordData.created_at = utcDate;
        }
        onSubmit(recordData);
        setValue('');
        setDateValue(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
    };

    const handleClose = () => {
        setValue('');
        setDateValue(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>{isEdit ? "レコード編集" : "レコード作成"}</DialogTitle>
            <DialogContent>
                {/* 対象アクティビティの情報を表示 */}
                {activity && (
                    <>
                        <Typography variant="subtitle1">{activity.name}</Typography>
                        <Typography variant="body2">
                            記録単位: {activity.unit === 'count' ? '回' : activity.unit === 'minutes' ? '分' : activity.unit}
                        </Typography>
                    </>
                )}
                <TextField
                    label={activity.unit === 'count' ? "回数" : "計測時間（分）"}
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
                    slotProps={{
                        shrink: true,
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>キャンセル</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default AddRecordDialog;