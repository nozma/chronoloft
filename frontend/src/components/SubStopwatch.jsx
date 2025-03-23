import React, { forwardRef, useImperativeHandle, useState } from 'react';
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
        <>
            <Box sx={(theme) => ({
                display: 'flex',
                width: '100%',
                backgroundColor: theme.palette.mode === 'dark'
                    ? '#151515'  // ダークモード用
                    : '#eeeeee', // ライトモード用
                py: 1,
                px: 2,
                borderRadius: 2,                
                mb: 2
            })}
            >
                <Typography variant='caption' color='#555'>Sub Stopwatch</Typography>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {getIconForGroup(activityGroup, groups)}
                        <Typography variant="body2" sx={{ mr: 1 }}>{activityName}</Typography>
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
                                <Typography variant="body2">Start Time: {formattedStartTime}</Typography>
                                <IconButton onClick={handleEditStartTime} size='small'>
                                    <EditIcon fontSize='small' />
                                </IconButton>
                            </>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: -1 }}>
                        <Typography variant="h6" sx={{ mr: 1 }}>{formatTime(displayTime)}</Typography>
                        <IconButton color="primary" onClick={() => complete(memo)} sx={{ mx: -1.5 }}>
                            <CheckCircleIcon fontSize='middle' />
                        </IconButton>
                        <IconButton color="error" onClick={cancel} >
                            <CancelIcon fontSize='middle' />
                        </IconButton>
                    </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <TextField
                        label="Memo"
                        multiline
                        fullWidth
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                    />
                </Box>
            </Box>
            <Box sx={{ marginTop: 0 }} />
        </>
    );
});

export default SubStopwatch;