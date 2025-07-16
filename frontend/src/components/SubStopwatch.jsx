import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Typography, Box, TextField, IconButton, Popover } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { DateTime } from 'luxon';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useRecords } from '../contexts/RecordContext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import useStopwatch from '../hooks/useStopwatch';

const SubStopwatch = forwardRef((props, ref) => {
    const { groups } = useGroups();
    const { records } = useRecords();
    const {
        displayTime,
        complete,
        finishAndReset,
        cancel,
        updateStartTime,
        currentStartTime,
        memo,
        setMemo,
    } = useStopwatch('subStopwatchState', null, { onComplete: props.onComplete, onCancel: props.onCancel }); // Discord連係はしないのでDiscordDataは不要

    useImperativeHandle(ref, () => ({
        complete,
        finishAndReset
    }));

    const [anchorEl, setAnchorEl] = useState(null);
    const [editedStartTime, setEditedStartTime] = useState("");

    const handleOpenPicker = (event) => {
        if (currentStartTime) {
            setEditedStartTime(DateTime.fromMillis(currentStartTime).toFormat("yyyy-MM-dd'T'HH:mm"));
        } else {
            setEditedStartTime(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        }
        setAnchorEl(event.currentTarget);
    };

    const handleClosePicker = () => {
        setAnchorEl(null);
    };

    const handleChangeStartTime = (value) => {
        setEditedStartTime(value);
        const dt = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm");
        if (dt.isValid) {
            try {
                updateStartTime(dt.toMillis());
            } catch (error) {
                alert(error.message);
            }
        }
    };

    const adjustStartTime = (delta) => {
        const dt = DateTime.fromFormat(editedStartTime, "yyyy-MM-dd'T'HH:mm");
        if (!dt.isValid) return;
        const newDt = dt.plus({ minutes: delta });
        setEditedStartTime(newDt.toFormat("yyyy-MM-dd'T'HH:mm"));
        try {
            updateStartTime(newDt.toMillis());
        } catch (error) {
            alert(error.message);
        }
    };

    const handleFillPrevEnd = () => {
        const baseline = DateTime.local();
        const sorted = [...records].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const prevRec = sorted.find(rec => {
            const endLocal = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            return endLocal < baseline;
        });
        const dt = prevRec
            ? DateTime.fromISO(prevRec.created_at, { zone: 'utc' }).toLocal()
            : baseline;
        setEditedStartTime(dt.toFormat("yyyy-MM-dd'T'HH:mm"));
        try {
            updateStartTime(dt.toMillis());
        } catch (error) {
            alert(error.message);
        }
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
                        {getIconForGroup(props.activityGroup, groups)}
                        <Typography variant="body2" sx={{ mr: 1 }}>{props.activityName}</Typography>
                        <Typography variant="body2">Start Time: {formattedStartTime}</Typography>
                        <IconButton onClick={handleOpenPicker} size='small'>
                            <CalendarMonthIcon fontSize='small' />
                        </IconButton>
                        <Popover
                            open={Boolean(anchorEl)}
                            anchorEl={anchorEl}
                            onClose={handleClosePicker}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                    type="datetime-local"
                                    value={editedStartTime}
                                    onChange={(e) => handleChangeStartTime(e.target.value)}
                                    size='small'
                                />
                                <Button size="small" onClick={handleFillPrevEnd}>Fill</Button>
                                <IconButton size="small" onClick={() => adjustStartTime(-5)}>-5</IconButton>
                                <IconButton size="small" onClick={() => adjustStartTime(-1)}>-1</IconButton>
                                <IconButton size="small" onClick={() => adjustStartTime(1)}>+1</IconButton>
                                <IconButton size="small" onClick={() => adjustStartTime(5)}>+5</IconButton>
                            </Box>
                        </Popover>
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
