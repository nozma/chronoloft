import { useI18n } from '../i18n/I18nContext';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Collapse, IconButton, Stack, TextField, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { DateTime } from 'luxon';
import { StopwatchView } from './Stopwatch';
import AddRecordDialog from './AddRecordDialog';
import { useActivities } from '../contexts/ActivityContext';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGroups } from '../contexts/GroupContext';
import getIconForGroup from '../utils/getIconForGroup';
import { useFilter } from '../contexts/FilterContext';
import { useRecords } from '../contexts/RecordContext';
import { getRecentMemoOptions, filterRecentMemoOptions } from '../utils/recentMemoOptions';
import { normalizeDetails, pasteDetails } from '../utils/recordDetails';
import { elapsedMilliseconds, newStopwatchId, operateStopwatch, operateStopwatchWithDraft, stopwatchRequest, useSharedStopwatches } from '../services/stopwatches';

function SessionCard({ item, own, now, busy, openConfirm, run, drafts }) {
    const { t } = useI18n();
    const { records } = useRecords();
    const detailOptions = useMemo(() => getRecentMemoOptions(records, item.activity_id), [records, item.activity_id]);
    const [memo, setMemo] = useState(item.memo);
    const [start, setStart] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [editing, setEditing] = useState(false);
    const draftBase = useRef(item);
    const editMemo = value => {
        if (!editing && !showEditor) draftBase.current = item;
        setEditing(true);
        setMemo(value);
    };
    const savedItem = async () => {
        if (!editing) return item;
        const result = await operateStopwatch(draftBase.current, 'edit', { memo });
        setEditing(false);
        return result.item;
    };
    useEffect(() => {
        const registry = drafts.current;
        registry[item.id] = savedItem;
        return () => { delete registry[item.id]; };
    });
    useEffect(() => { if (!editing) setMemo(item.memo); }, [item.memo, editing]);
    const { recordSaveMode } = useSettings();
    const { groups } = useGroups();
    const canDiscord = own && item.is_local && item.discord_enabled && groups.some(group => group.name === item.activity_group && group.client_id);
    const controller = {
        displayTime: elapsedMilliseconds(item, now), displayStartTime: item.started_at,
        memo, setMemo: editMemo,
        isDiscordBusy: busy, discordEnabled: canDiscord,
        discordConnected: item.discord_connected,
        complete: () => run(async () => {
            const current = await savedItem();
            return recordSaveMode === 'confirm' ? openConfirm(current) : operateStopwatch(current, 'complete');
        }),
        cancel: () => { if (window.confirm(`${item.device_name} の「${item.activity_name}」をキャンセルしますか？`)) run(() => operateStopwatch(item, 'cancel')); },
        pause: () => openConfirm(item),
        updateStartTime: value => run(async () => operateStopwatchWithDraft(savedItem, 'edit', { started_at: value })),
    };
    const elapsed = Math.floor(elapsedMilliseconds(item, now) / 1000);
    const formattedTime = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    const startValue = timestamp => DateTime.fromMillis(timestamp).toFormat("yyyy-MM-dd'T'HH:mm:ss");
    const closeEditor = () => { setShowEditor(false); setEditing(false); setMemo(item.memo); };
    return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
        {own ? <>
            <StopwatchView inlineMode controller={controller} activityId={item.activity_id}
                activityName={item.activity_name} activityGroup={item.activity_group}
                discordData={canDiscord ? {} : null} recordSaveMode="auto" confirming={item.status === 'confirming'} />
            {editing && <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1.5 }}>
                <Button size="small" variant="outlined" disabled={busy} onClick={() => run(savedItem)}>{t("Save Details")}</Button>
                <Button size="small" disabled={busy} onClick={() => { setMemo(item.memo); setEditing(false); }}>取り消す</Button>
            </Stack>}
        </> : <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 2, rowGap: 0.5, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{item.device_name}{item.slot === 'sub' ? ' · サブ' : ''}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, '& > svg': { flexShrink: 0 } }}>
                        {getIconForGroup(item.activity_group, groups)}
                        <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item.activity_name}</Typography>
                    </Box>
                </Box>
                <Stack spacing={0.5} alignItems="flex-end" sx={{ gridColumn: 2, gridRow: '1 / span 2' }}>
                    <Typography sx={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5, whiteSpace: 'nowrap', textAlign: 'right' }}>{formattedTime}</Typography>
                    <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton size="small" color="primary" aria-label="終了・保存" title="終了・保存" disabled={busy || showEditor || item.status === 'confirming'} onClick={controller.complete}>
                            <CheckCircleIcon fontSize="medium" />
                        </IconButton>
                        <IconButton size="small" color="error" aria-label="計測をキャンセル" title="計測をキャンセル" disabled={busy} onClick={controller.cancel}>
                            <CancelIcon fontSize="medium" />
                        </IconButton>
                        <IconButton size="small" aria-label="編集" title="編集" disabled={busy || showEditor} onClick={() => {
                            draftBase.current = item;
                            setMemo(item.memo);
                            setStart(startValue(item.started_at));
                            setShowEditor(true);
                        }}>
                            <EditOutlinedIcon fontSize="medium" />
                        </IconButton>
                    </Stack>
                </Stack>
                <Box sx={{ minWidth: 0 }}>
                    {!showEditor && item.memo && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{item.memo}</Typography>}
                    <Typography variant="caption" color="text.secondary" display="block">開始 {DateTime.fromMillis(item.started_at).toFormat('M/d HH:mm')}{item.status === 'confirming' ? ' · 保存確認中' : ''}</Typography>
                </Box>
            </Box>
            <Collapse in={showEditor} unmountOnExit>
                <Stack spacing={1.5} sx={{ pt: 2 }}>
                    <Autocomplete
                        freeSolo
                        disabled={busy}
                        options={detailOptions}
                        filterOptions={filterRecentMemoOptions}
                        inputValue={memo ?? ''}
                        onInputChange={(event, value) => editMemo(normalizeDetails(value))}
                        onChange={(event, value) => editMemo(normalizeDetails(value))}
                        forcePopupIcon={false}
                        disableClearable
                        renderInput={params => <TextField
                            {...params}
                            label={t("Details")}
                            size="small"
                            inputProps={{ ...params.inputProps, maxLength: 10000 }}
                            onPaste={event => pasteDetails(event, editMemo)}
                            fullWidth
                        />}
                    />
                    <TextField label="開始時刻" type="datetime-local" size="small" value={start} InputLabelProps={{ shrink: true }} inputProps={{ step: 1 }} disabled={busy} onChange={e => setStart(e.target.value)} />
                    <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" disabled={busy || !start} onClick={() => run(async () => {
                            const data = { memo };
                            if (start !== startValue(draftBase.current.started_at)) data.started_at = DateTime.fromISO(start).toMillis();
                            await operateStopwatch(draftBase.current, 'edit', data);
                            closeEditor();
                        })}>変更を保存</Button>
                        <Button size="small" disabled={busy} onClick={closeEditor}>取り消す</Button>
                    </Stack>
                </Stack>
            </Collapse>

        </Box>}
        {item.status === 'confirming' && <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pb: 1.5, flexWrap: 'wrap' }}>
            <Button size="small" disabled={busy || showEditor} onClick={() => run(async () => openConfirm(await savedItem()))}>保存内容を確認</Button>
            <Button size="small" disabled={busy || showEditor} onClick={() => run(() => operateStopwatch(item, 'resume'))}>計測に戻る</Button>
        </Stack>}
    </Box>;
}

const SharedStopwatches = forwardRef(function SharedStopwatches(props, ref) {
    const state = useSharedStopwatches();
    const { activities, refreshActivities } = useActivities();
    const { setActiveActivity } = useActiveActivity();
    const { setFilterState } = useFilter();
    const { discordEnabled, recordSaveMode, autoFilterOnSelect } = useSettings();
    const [now, setNow] = useState(Date.now());
    const [othersOpen, setOthersOpen] = useState(true);
    const [pending, setPending] = useState(null);
    const [error, setError] = useState('');
    const actionLock = useRef(false);
    const submitted = useRef(false);
    const drafts = useRef({});
    const own = state.items.filter(item => item.device_id === state.device?.id);
    const main = own.find(item => item.slot === 'main');
    const other = state.items.filter(item => item.device_id !== state.device?.id);
    const busy = state.busy || !state.ready || Boolean(state.error);
    const run = async action => {
        if (actionLock.current) return;
        actionLock.current = true;
        setError('');
        try { return await action(); }
        catch (err) { setError(err.message); }
        finally { actionLock.current = false; }
    };
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => {
        setActiveActivity(activities.find(activity => activity.id === main?.activity_id) || null);
        if (!main) { document.title = 'Chronoloft'; return; }
        const minutes = Math.floor(elapsedMilliseconds(main, now + state.offset) / 60000);
        document.title = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} ${main.activity_name}${main.memo ? `｜${main.memo}` : ''} - Chronoloft`;
    }, [main, activities, now, state.offset, setActiveActivity]);
    // Discord設定の反映は、起動PC自身のメイン計測に限る。
    useEffect(() => {
        if (!main || !state.device?.is_local || busy || main.discord_enabled === discordEnabled) return;
        operateStopwatch(main, 'edit', { discord_enabled: discordEnabled }).catch(err => setError(err.message));
    }, [main, state.device?.is_local, discordEnabled, busy]);

    const start = async activity => {
        if (autoFilterOnSelect) setFilterState(previous => ({ ...previous, activityNameFilter: activity.name }));
        await stopwatchRequest('/api/stopwatches', {
            id: newStopwatchId(), device_id: state.device.id, activity_id: activity.id,
            discord_enabled: state.device.is_local && discordEnabled,
        });
    };
    const openConfirm = async (item, next = null) => {
        const result = item.status === 'confirming' ? { item } : await operateStopwatch(item, 'confirm');
        setPending({ item: result.item, next });
        return null;
    };
    useImperativeHandle(ref, () => ({
        start: activity => run(async () => {
            if (busy) throw new Error('接続状態を確認してください。');
            if (main?.activity_id === activity.id) return;
            if (main) {
                const current = await drafts.current[main.id]?.() || main;
                if (recordSaveMode === 'confirm') return openConfirm(current, activity);
                await operateStopwatch(current, 'complete');
            }
            await start(activity);
        }),
    }));
    const pendingCurrent = pending && state.items.find(item => item.id === pending.item.id);
    const pendingStale = pending && (!pendingCurrent || pendingCurrent.revision !== pending.item.revision);
    return <Stack spacing={1.5} sx={{ mb: 2 }}>
        {(error || state.error) && <Alert severity="error">{error || state.error}</Alert>}
        {state.migrationWarning && <Alert severity="warning">{state.migrationWarning}</Alert>}
        {state.warning && <Alert severity="warning">{state.warning}</Alert>}
        {!state.ready && <Typography variant="body2" color="text.secondary">計測状態を取得しています…</Typography>}
        {own.map(item => <SessionCard key={item.id} item={item} own now={now + state.offset} busy={busy} openConfirm={openConfirm} run={run} drafts={drafts} />)}
        {other.length > 0 && <Box>
            <Button color="inherit" size="small" fullWidth onClick={() => setOthersOpen(value => !value)} aria-expanded={othersOpen} sx={{ justifyContent: 'space-between', color: 'text.secondary', px: 0.5, mb: othersOpen ? 1 : 0 }} endIcon={<ExpandMoreIcon sx={{ transform: othersOpen ? 'rotate(180deg)' : 'none' }} />}>
                ほかの端末
            </Button>
            <Collapse in={othersOpen}>
                <Stack spacing={1.5}>{other.map(item => <SessionCard key={item.id} item={item} now={now + state.offset} busy={busy} openConfirm={openConfirm} run={run} drafts={drafts} />)}</Stack>
            </Collapse>
        </Box>}
        {pending && <AddRecordDialog open title={`${pending.item.device_name}：${pending.item.activity_name}`}
            activity={activities.find(item => item.id === pending.item.activity_id) || { id: pending.item.activity_id, name: pending.item.activity_name, unit: 'minutes' }}
            initialValue={elapsedMilliseconds(pending.item, now + state.offset) / 60000}
            initialMemo={pending.item.memo} initialDate={new Date(pending.item.paused_at).toISOString()}
            autoFocusMemo onClose={() => {
                if (submitted.current) { submitted.current = false; return; }
                setPending(null);
                if (!pendingStale) run(() => operateStopwatch(pending.item, 'resume'));
            }} onSubmit={async data => {
                if (pendingStale) throw new Error('計測が別の画面で変更されました。確認画面を開き直してください。');
                await operateStopwatch(pending.item, 'complete', data);
                submitted.current = true;
                setPending(null);
                await refreshActivities();
                if (pending.next) await run(() => start(pending.next));
            }} />}
    </Stack>;
});
export default SharedStopwatches;
