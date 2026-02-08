import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { Button, Typography, Box, TextField, IconButton, Popover } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';
import { useRecords } from '../contexts/RecordContext';
import { DateTime } from 'luxon';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import { updateDiscordPresence } from '../services/api';

const Stopwatch = forwardRef((props, ref) => {
    const { groups } = useGroups();
    const { records } = useRecords();
    // カスタムフック useStopwatch を利用してタイマー処理全体を管理する
    const {
        displayTime,
        complete,
        pause,
        resume,
        finishAndReset,
        reset,
        cancel,
        updateStartTime,
        currentStartTime,
        displayStartTime,
        memo,
        setMemo,
        isDiscordBusy
    } = useStopwatch('stopwatchState', props.discordData, { onComplete: props.onComplete, onCancel: props.onCancel });

    useImperativeHandle(ref, () => ({
        complete,
        finishAndReset,
        reset,
        pause,
        resume,
        isDiscordBusy
    }));

    // Start Time 編集用状態
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [editedStartTime, setEditedStartTime] = React.useState("");

    // カレンダーアイコン押下時に DatePicker を表示
    const handleOpenPicker = (event) => {
        if (displayStartTime) {
            setEditedStartTime(DateTime.fromMillis(displayStartTime).toFormat("yyyy-MM-dd'T'HH:mm"));
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
        let dt = DateTime.fromFormat(editedStartTime, "yyyy-MM-dd'T'HH:mm");
        if (!dt.isValid) {
            // 初期値がセットされていない場合は currentStartTime を基準にする
            if (displayStartTime) {
                dt = DateTime.fromMillis(displayStartTime);
                setEditedStartTime(dt.toFormat("yyyy-MM-dd'T'HH:mm"));
            } else {
                return; // 基準が無ければ何もしない
            }
        }
        const newDt = dt.plus({ minutes: delta });
        setEditedStartTime(newDt.toFormat("yyyy-MM-dd'T'HH:mm"));
        try {
            updateStartTime(newDt.toMillis());
        } catch (error) {
            alert(error.message);
        }
    };

    // 現在の開始時刻の表示（currentStartTime を利用）
    const formattedStartTime = displayStartTime
        ? DateTime.fromMillis(displayStartTime).toFormat("HH:mm")
        : "Undefined";

    // 時間をフォーマットする関数
    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleCompleteClick = async () => {
        if (props.recordSaveMode === 'confirm' && props.onConfirmComplete) {
            const snapshot = await pause();
            if (snapshot) {
                props.onConfirmComplete(snapshot.minutes, snapshot.memo);
            }
            return;
        }
        complete(memo);
    };

    // 7日/30日累積時間と1つ前の期間の累積時間を計算
    const { total7d, total30d, prev7d, prev30d } = useMemo(() => {
        const now = new Date();
        const past30 = new Date(now);
        past30.setDate(now.getDate() - 30);
        const past7 = new Date(now);
        past7.setDate(now.getDate() - 7);
        const prev30Start = new Date(past30);
        prev30Start.setDate(prev30Start.getDate() - 30);
        const prev7Start = new Date(past7);
        prev7Start.setDate(prev7Start.getDate() - 7);

        let sum7 = 0;
        let sum30 = 0;
        let prevSum7 = 0;
        let prevSum30 = 0;
        for (const rec of records) {
            if (rec.activity_id !== props.activityId) continue;
            const created = new Date(rec.created_at);
            if (created >= past30) sum30 += rec.value;
            if (created >= past7) sum7 += rec.value;
            if (created >= prev7Start && created < past7) prevSum7 += rec.value;
            if (created >= prev30Start && created < past30) prevSum30 += rec.value;
        }
        return { total7d: sum7, total30d: sum30, prev7d: prevSum7, prev30d: prevSum30 };
    }, [records, props.activityId]);

    const runningMinutes = displayTime / 60000;
    const total7Display = total7d + runningMinutes;
    const total30Display = total30d + runningMinutes;

    const totalLabel7 = `${Math.floor(total7Display / 60)}:${String((total7Display % 60).toFixed(0)).padStart(2, '0')} /7d`;
    const totalLabel30 = `${Math.floor(total30Display / 60)}:${String((total30Display % 60).toFixed(0)).padStart(2, '0')} /30d`;

    const diff7 = Math.round(total7Display - prev7d);
    const diff30 = Math.round(total30Display - prev30d);
    const formatDiff = (min) => {
        const sign = min > 0 ? '+' : min < 0 ? '-' : '';
        const abs = Math.abs(min);
        const h = Math.floor(abs / 60);
        const m = Math.floor(abs % 60);
        return `${sign}${h}:${String(m).padStart(2, '0')}`;
    };
    const diffLabel7 = formatDiff(diff7);
    const diffLabel30 = formatDiff(diff30);

    // ストップウォッチ起動中にタイトルバーを変更するため、onTickを呼び出す
    useEffect(() => {
        if (props.onTick) {
            props.onTick(displayTime);
        }
    }, [displayTime, props.onTick]);

    // 直近のレコード終了時刻を取得して editedStartTime にセット
    const handleFillPrevEnd = () => {
        // ① 終了時刻がまだ無い＝ストップウォッチ動作中なので「現在時刻」を基準に
        const baseline = DateTime.local();

        // ② 全レコードを終了時刻(created_at)降順ソート
        const sorted = [...records].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        // ③ baseline より前のレコードを探す
        const prevRec = sorted.find(rec => {
            const endLocal = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            return endLocal < baseline;
        });

        // ④ 見つかったらその終了時刻、無ければ baseline をセット
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

    return (
        <>
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    backgroundColor: theme.palette.mode === 'dark'
                        ? '#222'  // ダークモード用
                        : '#fafafa', // ライトモード用
                    zIndex: 100,
                    py: 1,
                    px: 8
                })}
            >
                <Box sx={{ flex: 1, width: '10%' }} >
                    <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                        {/* アクティビティ名・アイコン表示 */}
                        {getIconForGroup(props.activityGroup, groups)}
                        <Typography variant="h6" sx={{ mr: 2 }}>
                            {props.activityName}
                        </Typography>
                    </Box>
                    {/* 経過時間と完了・キャンセルアイコン */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography variant="h5" sx={{ mr: 1 }}>{formatTime(displayTime)}</Typography>
                        <IconButton color="primary" size="small" onClick={handleCompleteClick} disabled={isDiscordBusy}>
                            <CheckCircleIcon fontSize='medium' />
                        </IconButton>
                        <IconButton color="error" size="small" onClick={cancel} disabled={isDiscordBusy}>
                            <CancelIcon fontSize='medium' />
                        </IconButton>
                        <Box sx={{ ml: 1, display: 'flex', gap: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Typography variant="body2" color="#999" sx={{ lineHeight: 1 }}>{totalLabel7}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={(theme) => ({
                                        lineHeight: 1,
                                        mt: 0.5,
                                        color:
                                            diff7 > 0
                                                ? theme.palette.mode === 'dark'
                                                    ? theme.palette.success.light
                                                    : theme.palette.success.dark
                                                : diff7 < 0
                                                    ? theme.palette.mode === 'dark'
                                                        ? theme.palette.error.light
                                                        : theme.palette.error.dark
                                                    : undefined,
                                    })}
                                >
                                    {diffLabel7}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Typography variant="body2" color="#999" sx={{ lineHeight: 1 }}>{totalLabel30}</Typography>
                                <Typography
                                    variant="caption"
                                    sx={(theme) => ({
                                        lineHeight: 1,
                                        mt: 0.5,
                                        color:
                                            diff30 > 0
                                                ? theme.palette.mode === 'dark'
                                                    ? theme.palette.success.light
                                                    : theme.palette.success.dark
                                                : diff30 < 0
                                                    ? theme.palette.mode === 'dark'
                                                        ? theme.palette.error.light
                                                        : theme.palette.error.dark
                                                    : undefined,
                                    })}
                                >
                                    {diffLabel30}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{ m: -0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">Start Time: {formattedStartTime}</Typography>
                        <IconButton onClick={handleOpenPicker} sx={{ ml: -1 }} size='small'>
                            <CalendarMonthIcon fontSize='small' />
                        </IconButton>
                        <Button size="small" sx={{ minWidth: 0, px: 0.5, m: -0.5 }} onClick={handleFillPrevEnd}>Fill</Button>
                        <IconButton size="small" sx={{ p: 0.75, m: -0.5, fontSize: '0.9rem' }} onClick={() => adjustStartTime(-5)}>-5</IconButton>
                        <IconButton size="small" sx={{ p: 0.75, m: -0.5, fontSize: '0.9rem' }} onClick={() => adjustStartTime(-1)}>-1</IconButton>
                        <IconButton size="small" sx={{ p: 0.75, m: -0.5, fontSize: '0.9rem' }} onClick={() => adjustStartTime(1)}>+1</IconButton>
                        <IconButton size="small" sx={{ p: 0.75, m: -0.5, fontSize: '0.9rem' }} onClick={() => adjustStartTime(5)}>+5</IconButton>
                        <Popover
                            open={Boolean(anchorEl)}
                            anchorEl={anchorEl}
                            onClose={handleClosePicker}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ p: 1 }}>
                                <TextField
                                    type="datetime-local"
                                    value={editedStartTime}
                                    onChange={(e) => handleChangeStartTime(e.target.value)}
                                    size='small'
                                />
                            </Box>
                        </Popover>
                    </Box>
                </Box>
                <Box sx={{ position: 'relative', flex: 1, mt: 1 }}>
                    {/* メモ入力欄 */}
                    <TextField
                        label="Memo"
                        multiline
                        rows={2}
                        fullWidth
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                    />
                    {/* Update Presence ボタン */}
                    {props.discordData && (
                        <IconButton
                            size="small"
                            onClick={() => {
                                const data = {
                                    group: props.activityGroup,
                                    activity_name: props.activityName,
                                    details: memo,
                                    asset_key: props.discordData?.asset_key || 'default_image',
                                };
                                updateDiscordPresence(data)
                                    .catch(err => console.error('Failed to update presence:', err));
                            }}
                            disabled={isDiscordBusy}
                            sx={{
                                position: 'absolute',
                                right: 4,
                                bottom: 8,
                                p: 0.5,
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                        >
                            <SyncIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </Box>
            <Box sx={{ marginTop: 8 }} />
        </>
    );
});

export default Stopwatch;
