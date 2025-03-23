import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Button, Typography, Box, TextField, IconButton } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { DateTime } from 'luxon';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import useStopwatch from '../hooks/useStopwatch';

const SubStopwatch = forwardRef(({ onComplete, onCancel, activityName, activityGroup }, ref) => {
    const { groups } = useGroups();
    const {
        displayTime,
        complete,
        finishAndReset,
        cancel,
        updateStartTime,
        currentStartTime,
        memo,
        setMemo,
    } = useStopwatch(null, { onComplete, onCancel }); // Discord連携を無効化

    useImperativeHandle(ref, () => ({
        complete,
        finishAndReset
    }));

    const [isEditingStartTime, setIsEditingStartTime] = useState(false);
    const [editedStartTime, setEditedStartTime] = useState("");

    const handleEditStartTime = () => {
        if (currentStartTime) {
            setEditedStartTime(DateTime.fromMillis(currentStartTime).toFormat("yyyy-MM-dd'T'HH:mm"));
        } else {
            setEditedStartTime(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        }
        setIsEditingStartTime(true);
    };

    const handleSaveStartTime = () => {
        const newStart = DateTime.fromFormat(editedStartTime, "yyyy-MM-dd'T'HH:mm").toMillis();
        if (newStart > Date.now()) {
            alert("Start time cannot be in the future");
            return;
        }
        try {
            updateStartTime(newStart);
            setIsEditingStartTime(false);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleCancelEditStartTime = () => {
        setIsEditingStartTime(false);
    };

    const formattedStartTime = currentStartTime
        ? DateTime.fromMillis(currentStartTime).toFormat("HH:mm")
        : "Undefined";

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <Box sx={{ p: 2, borderRadius: 4, mt: 2, border: '1px solid #ccc' }}>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                {getIconForGroup(activityGroup, groups)}
                <Typography variant="h6" sx={{ mr: 2 }}>{activityName}</Typography>
                {isEditingStartTime ? (
                    <>
                        <TextField
                            type="datetime-local"
                            value={editedStartTime}
                            onChange={(e) => setEditedStartTime(e.target.value)}
                            size='small'
                        />
                        <Button onClick={handleSaveStartTime} variant="contained" color="primary">Save</Button>
                        <Button onClick={handleCancelEditStartTime} variant="outlined">Cancel</Button>
                    </>
                ) : (
                    <>
                        <Typography variant="body1">(Start Time: {formattedStartTime}</Typography>
                        <IconButton onClick={handleEditStartTime} size='small'>
                            <EditIcon fontSize='small' />
                        </IconButton>
                        <Typography variant='body1'>)</Typography>
                    </>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ mr: 2 }}>{formatTime(displayTime)}</Typography>
                <IconButton color="primary" onClick={() => complete(memo)}>
                    <CheckCircleIcon fontSize='large' />
                </IconButton>
                <IconButton color="error" onClick={cancel}>
                    <CancelIcon fontSize='large' />
                </IconButton>
            </Box>

            <TextField
                label="Memo"
                multiline
                rows={2}
                fullWidth
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                sx={{ my: 2 }}
            />
        </Box>
    );
});

export default SubStopwatch;