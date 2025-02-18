import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';

function AddRecordDialog({ open, onClose, onSubmit, activity, initialValue, initialDate, isEdit }) {
    const [value, setValue] = useState(
        initialValue !== undefined && initialValue !== null ? String(initialValue) : ''
    );
    const defaultDate = initialDate ? initialDate.substring(0, 16) : new Date().toISOString().substring(0, 16);
    const [dateValue, setDateValue] = useState(defaultDate);

    useEffect(() => {
        setValue(initialValue !== undefined && initialValue !== null ? Number(initialValue).toFixed(1) : '');
    }, [initialValue]);

    const handleSubmit = () => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            alert("有効な数値を入力してください。");
            return;
        }
        const recordData = { activity_id: activity.id, value: numValue };
        if (dateValue) {
            // "YYYY-MM-DDTHH:MM" 形式を Date オブジェクトに変換し ISO 形式にする
            recordData.created_at = new Date(dateValue).toISOString();
        }
        onSubmit(recordData);
        setValue('');
        setDateValue(new Date().toISOString().substring(0, 16));
    };

    const handleClose = () => {
        setValue('');
        setDateValue(new Date().toISOString().substring(0, 16));
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
                    label="登録日時"
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