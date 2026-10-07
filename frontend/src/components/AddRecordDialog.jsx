import { useI18n } from '../i18n/I18nContext';
import { normalizeDetails, pasteDetails } from '../utils/recordDetails';
// AddRecordDialog.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Autocomplete,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Box,
    IconButton,
    Typography
} from '@mui/material';
import { DateTime } from 'luxon';
import { useActivities } from '../contexts/ActivityContext'
import { useRecords } from '../contexts/RecordContext';
import { getRecentMemoOptions, filterRecentMemoOptions } from '../utils/recentMemoOptions';

function AddRecordDialog({
    open,
    onClose,
    onSubmit,
    activity,
    initialValue,
    initialDate,
    initialMemo = '',
    isEdit = false,
    onDelete,
    autoFocusMemo = false
}) {
    const { t } = useI18n();
    const { activities } = useActivities();
    const { records } = useRecords();
    const [selectedActivity, setSelectedActivity] = useState(activity);
    const [value, setValue] = useState('');
    const [dateValue, setDateValue] = useState(''); // count用: 記録日時
    const [startTime, setStartTime] = useState(''); // minutes用: 開始日時
    const [endTime, setEndTime] = useState('');     // minutes用: 終了日時
    const [memo, setMemo] = useState(normalizeDetails(initialMemo));
    const memoRef = useRef(null);

    // activitiesを元のactivityとunitが一致するものに絞り込む
    const compatibleActivities = activities.filter(a => a.unit === activity.unit);
    const memoOptions = useMemo(
        () => getRecentMemoOptions(records, selectedActivity?.id),
        [records, selectedActivity?.id]
    );

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
        setMemo(normalizeDetails(initialMemo));
    }, [activity, initialValue, initialDate, initialMemo]);

    useEffect(() => {
        if (open && autoFocusMemo && memoRef.current) {
            memoRef.current.focus();
        }
    }, [open, autoFocusMemo]);

    // 保存時処理
    const handleSubmit = () => {
        if (!selectedActivity) return;
        if (selectedActivity?.unit === 'count') { // 回数により記録するもの
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                alert(t("Enter a valid count."));
                return;
            }
            const dtLocal = DateTime.fromFormat(dateValue, "yyyy-MM-dd'T'HH:mm");
            if (!dtLocal.isValid) {
                alert(t("Invalid date and time."));
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
                alert(t("Invalid start or end time."));
                return;
            }
            // バリデーション: 開始<=終了
            if (startLocal > endLocal) {
                alert(t("Start time must not be later than end time."));
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

    const handleKeyDown = (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    // 時刻を ±n 分ずらす汎用関数
    const adjustTime = (timeStr, delta, setter) => {
        const dt = DateTime.fromFormat(timeStr, "yyyy-MM-dd'T'HH:mm");
        if (!dt.isValid) return;
        setter(dt.plus({ minutes: delta }).toFormat("yyyy-MM-dd'T'HH:mm"));
    };

    const isValidTime = (timeStr) => (
        DateTime.fromFormat(timeStr, "yyyy-MM-dd'T'HH:mm").isValid
    );

    // 回数を増減させる
    const adjustCount = (delta) => {
        setValue(prev => {
            const current = parseFloat(prev) || 0;
            const updated = Math.max(0, current + delta);
            return String(updated);
        });
    };

    // 「前のレコードの終了」を開始時刻にセット
    const fillStartWithPrevEnd = () => {
        // ① 終了時刻を基準に
        const baseline = DateTime.fromFormat(endTime, "yyyy-MM-dd'T'HH:mm"); 

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
        setStartTime(dt.toFormat("yyyy-MM-dd'T'HH:mm"));
    };

    // 「次のレコードの開始」を終了時刻にセット（無ければ今の時刻）
    const fillEndWithNextStart = () => {
        const current = DateTime.fromFormat(endTime, "yyyy-MM-dd'T'HH:mm");
        // nextRec の開始 = endLocal.minus({ minutes: value })
        const candidates = records
            .map(r => {
                const endLocal = DateTime.fromISO(r.created_at, { zone: 'utc' }).toLocal();
                return { startLocal: endLocal.minus({ minutes: r.value }) };
            })
            .filter(o => o.startLocal > current)
            .sort((a, b) => a.startLocal.valueOf() - b.startLocal.valueOf());
        if (candidates.length) {
            setEndTime(candidates[0].startLocal.toFormat("yyyy-MM-dd'T'HH:mm"));
        } else {
            setEndTime(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        }
    };


    return (
        <Dialog
            open={open}
            onClose={handleClose}
            onKeyDown={handleKeyDown}
        >
            <DialogTitle>{isEdit ? t("Edit") : t("Create")}</DialogTitle>
            <DialogContent>
                <TextField
                    select
                    label={t("Activity")}
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
                        <Box display="flex" alignItems="center" mb={1}>
                            <TextField
                                label={t("Count")}
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                sx={{ flex: 1 }}
                                margin="dense"
                            />
                            <IconButton size="small" onClick={() => adjustCount(-5)}>
                                −5
                            </IconButton>
                            <IconButton size="small" onClick={() => adjustCount(-1)}>
                                −1
                            </IconButton>
                            <IconButton size="small" onClick={() => adjustCount(+1)}>
                                +1
                            </IconButton>
                            <IconButton size="small" onClick={() => adjustCount(+5)}>
                                +5
                            </IconButton>
                        </Box>
                        <TextField
                            label={t("Recorded at")}
                            type="datetime-local"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <Autocomplete
                            freeSolo
                            options={memoOptions}
                            filterOptions={filterRecentMemoOptions}
                            inputValue={memo ?? ''}
                            onInputChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                            onChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                            forcePopupIcon={false}
                            disableClearable
                            sx={{ mt: 2 }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("Details")}
                                    size="small"
                                    onPaste={(event) => pasteDetails(event, setMemo)}
                                    fullWidth
                                    inputRef={memoRef}
                                    autoFocus={autoFocusMemo}
                                />
                            )}
                        />
                    </>
                )}

                {selectedActivity?.unit === 'minutes' && (
                    <>
                        {/* 開始時刻入力＋ボタン群 */}
                        <Box mb={1.5}>
                            <Box display="flex" alignItems="center">
                                <TextField
                                    label={t("Start time")}
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    sx={{ flex: 1 }}
                                    margin="dense"
                                />
                                <Button size="small" onClick={fillStartWithPrevEnd}>
                                    FILL
                                </Button>
                                <IconButton size="small" onClick={() => adjustTime(startTime, -5, setStartTime)}>
                                    −5
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(startTime, -1, setStartTime)}>
                                    −1
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(startTime, +1, setStartTime)}>
                                    +1
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(startTime, +5, setStartTime)}>
                                    +5
                                </IconButton>
                            </Box>
                            {!isEdit && (
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    flexWrap="wrap"
                                    gap={0.75}
                                    mt={0.5}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
                                        {t("From end time")}
                                    </Typography>
                                    {[15, 30, 60].map((minutes) => (
                                        <Button
                                            key={minutes}
                                            size="small"
                                            variant="outlined"
                                            disabled={!isValidTime(endTime)}
                                            aria-label={t("Set start to {count} minutes before end", { count: minutes })}
                                            onClick={() => adjustTime(endTime, -minutes, setStartTime)}
                                            sx={{ minWidth: 0, px: 1.25 }}
                                        >
                                            {t("{count} minutes before", { count: minutes })}
                                        </Button>
                                    ))}
                                </Box>
                            )}
                        </Box>

                        {/* 終了時刻入力＋ボタン群 */}
                        <Box mb={1}>
                            <Box display="flex" alignItems="center">
                                <TextField
                                    label={t("End time")}
                                    type="datetime-local"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    sx={{ flex: 1 }}
                                    margin="dense"
                                />
                                <Button size="small" onClick={fillEndWithNextStart}>
                                    FILL
                                </Button>
                                <IconButton size="small" onClick={() => adjustTime(endTime, -5, setEndTime)}>
                                    −5
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(endTime, -1, setEndTime)}>
                                    −1
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(endTime, +1, setEndTime)}>
                                    +1
                                </IconButton>
                                <IconButton size="small" onClick={() => adjustTime(endTime, +5, setEndTime)}>
                                    +5
                                </IconButton>
                            </Box>
                            {!isEdit && (
                                <Box
                                    display="flex"
                                    alignItems="center"
                                    flexWrap="wrap"
                                    gap={0.75}
                                    mt={0.5}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>
                                        {t("From start time")}
                                    </Typography>
                                    {[15, 30, 60].map((minutes) => (
                                        <Button
                                            key={minutes}
                                            size="small"
                                            variant="outlined"
                                            disabled={!isValidTime(startTime)}
                                            aria-label={t("Set end to {count} minutes after start", { count: minutes })}
                                            onClick={() => adjustTime(startTime, minutes, setEndTime)}
                                            sx={{ minWidth: 0, px: 1.25 }}
                                        >
                                            {t("{count} minutes after", { count: minutes })}
                                        </Button>
                                    ))}
                                </Box>
                            )}
                        </Box>

                        <Autocomplete
                            freeSolo
                            options={memoOptions}
                            filterOptions={filterRecentMemoOptions}
                            inputValue={memo ?? ''}
                            onInputChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                            onChange={(event, newValue) => setMemo(normalizeDetails(newValue))}
                            forcePopupIcon={false}
                            disableClearable
                            sx={{ mt: 2 }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("Details")}
                                    size="small"
                                    onPaste={(event) => pasteDetails(event, setMemo)}
                                    fullWidth
                                    inputRef={memoRef}
                                    autoFocus={autoFocusMemo}
                                />
                            )}
                        />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                {isEdit && onDelete && (
                    <Button onClick={handleDelete} color="error" sx={{ mr: 'auto' }}>
                        {t("Delete")}
                    </Button>
                )}
                <Button onClick={handleClose}>{t("Cancel")}</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    {t("Submit")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default AddRecordDialog;
