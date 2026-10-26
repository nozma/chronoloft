import { useI18n } from '../i18n/I18nContext';
import { normalizeDetails, pasteDetails } from '../utils/recordDetails';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { Autocomplete, Button, Typography, Box, TextField, IconButton, Popover } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useSettings } from '../contexts/SettingsContext';
import { alpha } from '@mui/material/styles';
import { useGroups } from '../contexts/GroupContext';
import { useRecords } from '../contexts/RecordContext';
import { DateTime } from 'luxon';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { getRecentMemoOptions, filterRecentMemoOptions } from '../utils/recentMemoOptions';
import ConfirmDialog from './ConfirmDialog';

export const StopwatchView = forwardRef(function StopwatchView(props, ref) {
    const { t } = useI18n();
    const isInlineMode = Boolean(props.inlineMode);
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
        displayStartTime,
        memo,
        setMemo,
        isDiscordBusy
    } = props.controller;

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
    const [alertMessage, setAlertMessage] = React.useState(null);
    const startTimeRef = React.useRef(displayStartTime);
    startTimeRef.current = displayStartTime;

    // 開始時刻の押下時に編集画面を表示
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
                setAlertMessage(error.message);
            }
        }
    };

    const adjustStartTime = (delta) => {
        if (startTimeRef.current == null) return;
        const newDt = DateTime.fromMillis(startTimeRef.current).plus({ minutes: delta });
        try {
            updateStartTime(newDt.toMillis());
            startTimeRef.current = newDt.toMillis();
            setEditedStartTime(newDt.toFormat("yyyy-MM-dd'T'HH:mm"));
        } catch (error) {
            setAlertMessage(error.message);
        }
    };

    // 現在の開始時刻の表示（currentStartTime を利用）
    const formattedStartTime = displayStartTime
        ? DateTime.fromMillis(displayStartTime).toFormat("HH:mm")
        : t("Undefined");

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

    const memoOptions = useMemo(
        () => getRecentMemoOptions(records, props.activityId),
        [records, props.activityId]
    );

    const { onTick, onMemoChange } = props;

    // 詳細の入力・復元・リセットをタイトルバーへ反映する
    useEffect(() => {
        onMemoChange?.(memo ?? '');
    }, [memo, onMemoChange]);

    // ストップウォッチ起動中にタイトルバーを変更するため、onTickを呼び出す
    useEffect(() => {
        if (onTick) {
            onTick(displayTime);
        }
    }, [displayTime, onTick]);

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
            setAlertMessage(error.message);
        }
    };

    const shortcutSx = {
        minWidth: { xs: 36, sm: 28 },
        minHeight: { xs: 40, sm: 0 },
        px: { xs: 0.75, sm: 0.75 },
        py: { xs: 0.75, sm: 0.25 },
        fontSize: { xs: '0.875rem', sm: '0.75rem' },
        lineHeight: 1.75,
        textTransform: 'none',
        fontVariantNumeric: 'tabular-nums',
        borderRadius: 1.5,
        fontWeight: 500,
        bgcolor: 'action.hover',
        transition: 'background-color 0.15s',
        '@media (hover: hover) and (pointer: fine)': {
            '&:hover': { bgcolor: 'action.selected' },
        },
    };
    const startTimeControls = <>
        <Button
            size="small"
            color="inherit"
            disabled={isDiscordBusy}
            onClick={handleOpenPicker}
            aria-label={`開始時刻を変更: ${formattedStartTime}`}
            aria-haspopup="dialog"
            aria-expanded={Boolean(anchorEl)}
            title="開始時刻を変更"
            sx={{ minWidth: 0, minHeight: { xs: 40, sm: 0 }, px: { xs: 1, sm: 0.5 }, py: { xs: 0.75, sm: 0.25 }, mr: 0.5, color: 'text.secondary', fontSize: { xs: '0.875rem', sm: '0.75rem' }, textTransform: 'none' }}
        >
            {t("Start")} {formattedStartTime}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Button variant="text" color="primary" size="small" disabled={isDiscordBusy} sx={theme => ({
                ...shortcutSx,
                px: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                },
            })} title="直前の記録の終了時刻に合わせる" onClick={handleFillPrevEnd}>FILL</Button>
            {[-5, -1, 1, 5].map(delta => (
                <Button
                    key={delta}
                    variant="text"
                    color="inherit"
                    size="small"
                    disabled={isDiscordBusy}
                    sx={shortcutSx}
                    aria-label={`開始時刻を${Math.abs(delta)}分${delta < 0 ? '早める' : '遅らせる'}`}
                    onClick={() => adjustStartTime(delta)}
                >
                    {delta > 0 ? '+' : ''}{delta}
                </Button>
            ))}
        </Box>
    </>;

    return (
        <>
            <Box
                sx={(theme) => ({
                    display: isInlineMode ? 'grid' : 'flex',
                    gridTemplateColumns: isInlineMode ? 'minmax(0, 1fr) auto' : undefined,
                    columnGap: isInlineMode ? 1 : undefined,
                    rowGap: isInlineMode ? 1.25 : undefined,
                    alignItems: isInlineMode ? 'center' : undefined,
                    flexDirection: isInlineMode ? 'column' : 'row',
                    position: isInlineMode ? 'relative' : 'fixed',
                    top: isInlineMode ? 'auto' : 0,
                    left: isInlineMode ? 'auto' : 0,
                    width: '100%',
                    backgroundColor: isInlineMode ? 'transparent' : theme.palette.background.paper,
                    zIndex: isInlineMode ? 'auto' : 100,
                    py: isInlineMode ? 1.5 : 1,
                    px: isInlineMode ? 2 : 8,
                    borderRadius: isInlineMode ? 1 : 0,
                    mb: 0,
                })}
            >
                <Box sx={isInlineMode ? { display: 'contents' } : { flex: 1, width: '10%' }} >
                    <Box sx={{ gridColumn: isInlineMode ? 1 : undefined, gridRow: isInlineMode ? 1 : undefined, mb: 0.5, minWidth: 0, display: 'flex', justifyContent: isInlineMode ? 'flex-start' : 'center', alignItems: 'center', gap: 0.5, '& > svg': { flexShrink: 0 } }}>
                        {/* アクティビティ名・アイコン表示 */}
                        {getIconForGroup(props.activityGroup, groups)}
                        <Typography variant="h6" fontWeight={500} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            {props.activityName}
                        </Typography>
                    </Box>
                    {isInlineMode ? (
                        <>
                            <Box sx={{ display: 'contents' }}>
                                <Typography sx={{ gridColumn: 2, gridRow: 1, textAlign: 'right', fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5, whiteSpace: 'nowrap' }}>{formatTime(displayTime)}</Typography>
                                <Box sx={{ gridColumn: 2, gridRow: 2, justifySelf: 'end', justifyContent: 'flex-end', display: 'flex', gap: 0 }}>
                                    {!props.confirming && <IconButton aria-label="終了・保存" title="終了・保存" color="primary" size="small" onClick={handleCompleteClick} disabled={isDiscordBusy}>
                                        <CheckCircleIcon fontSize='medium' />
                                    </IconButton>}
                                    <IconButton aria-label="計測をキャンセル" title="計測をキャンセル" color="error" size="small" onClick={cancel} disabled={isDiscordBusy}>
                                        <CancelIcon fontSize='medium' />
                                    </IconButton>
                                </Box>
                            </Box>
                            <Box sx={{ gridColumn: '1 / -1', gridRow: 3, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', pt: 0.5 }}>
                                {startTimeControls}
                            </Box>
                        </>
                    ) : (
                        <>
                            {/* 経過時間と完了・キャンセルアイコン */}
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Typography variant="h5" sx={{ mr: 1 }}>{formatTime(displayTime)}</Typography>
                                {!props.confirming && <IconButton aria-label="終了・保存" title="終了・保存" color="primary" size="small" onClick={handleCompleteClick} disabled={isDiscordBusy}>
                                    <CheckCircleIcon fontSize='medium' />
                                </IconButton>}
                                <IconButton aria-label="計測をキャンセル" title="計測をキャンセル" color="error" size="small" onClick={cancel} disabled={isDiscordBusy}>
                                    <CancelIcon fontSize='medium' />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                                {startTimeControls}
                            </Box>
                        </>
                    )}
                    <Popover
                        open={Boolean(anchorEl)}
                        anchorEl={anchorEl}
                        onClose={handleClosePicker}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        <Box sx={{ p: 1 }}>
                            <TextField
                                disabled={isDiscordBusy}
                                type="datetime-local"
                                value={editedStartTime}
                                onChange={(e) => handleChangeStartTime(e.target.value)}
                                size='small'
                            />
                        </Box>
                    </Popover>
                </Box>
                <Box sx={isInlineMode ? { gridColumn: '1 / -1', gridRow: 2, minWidth: 0, mr: props.confirming ? 5.5 : 9.25 } : { position: 'relative', flex: 1, mt: 1 }}>
                    {/* メモ入力欄 */}
                    <Autocomplete
                        onFocusCapture={props.onMemoFocus}
                        onBlurCapture={props.onMemoBlur}
                        onCompositionStartCapture={props.onMemoCompositionStart}
                        onCompositionEndCapture={props.onMemoCompositionEnd}
                        fullWidth
                        sx={{ minWidth: 0 }}
                        disabled={isDiscordBusy}
                        freeSolo
                        options={memoOptions}
                        filterOptions={filterRecentMemoOptions}
                        inputValue={memo ?? ''}
                        onInputChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                        onChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                        forcePopupIcon={false}
                        disableClearable
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t("Details")}
                                size="small"
                                onPaste={(event) => pasteDetails(event, setMemo)}
                                fullWidth
                            />
                        )}
                    />
                </Box>
            </Box>
            {!isInlineMode && <Box sx={{ marginTop: 8 }} />}
            <ConfirmDialog open={alertMessage !== null} content={alertMessage}
                confirmLabel="OK" onConfirm={() => setAlertMessage(null)} />
        </>
    );
});

const Stopwatch = forwardRef(function Stopwatch(props, ref) {
    const { discordEnabled } = useSettings();
    const controller = useStopwatch('stopwatchState', props.discordData, { onComplete: props.onComplete, onCancel: props.onCancel, discordEnabled });
    return <StopwatchView {...props} ref={ref} controller={{ ...controller, discordEnabled }} />;
});

export default Stopwatch;
