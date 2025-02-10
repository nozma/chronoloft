import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';

function AddRecordDialog({ open, onClose, onSubmit, activity, initialValue }) {
    const [value, setValue] = useState(
        initialValue !== undefined && initialValue !== null ? String(initialValue) : ''
    );

    useEffect(() => {
        setValue(initialValue !== undefined && initialValue !== null ? Number(initialValue).toFixed(1) : '');
    }, [initialValue]);

    const handleSubmit = () => {
        // 数値として解釈できるかチェック
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            alert("有効な数値を入力してください。");
            return;
        }
        // onSubmit に activity_id と数値を渡す
        onSubmit({ activity_id: activity.id, value: numValue });
        setValue('');
    };

    const handleClose = () => {
        setValue('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose}>
            <DialogTitle>レコード作成</DialogTitle>
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