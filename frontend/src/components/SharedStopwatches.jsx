import { useI18n } from '../i18n/I18nContext';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { DateTime } from 'luxon';
import { StopwatchView } from './Stopwatch';
import AddRecordDialog from './AddRecordDialog';
import ConfirmDialog from './ConfirmDialog';
import { useActivities } from '../contexts/ActivityContext';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useSettings } from '../contexts/SettingsContext';
import { useGroups } from '../contexts/GroupContext';
import getIconForGroup from '../utils/getIconForGroup';
import { useFilter } from '../contexts/FilterContext';
import { useRecords } from '../contexts/RecordContext';
import { getRecentMemoOptions, filterRecentMemoOptions } from '../utils/recentMemoOptions';
import { createStopwatchDraft } from '../utils/stopwatchDraft';
import { normalizeDetails, pasteDetails } from '../utils/recordDetails';
import { currentStopwatch, elapsedMilliseconds, newStopwatchId, operateStopwatch, refreshStopwatches, stopwatchRequest, useSharedStopwatches } from '../services/stopwatches';
import { desktopCommand, desktopDiscordEnabled } from '../utils/desktop';

function SessionCard({ item, own, now, busy, openConfirm, run, drafts }) {
    const { t } = useI18n();
    const { records } = useRecords();
    const detailOptions = useMemo(() => getRecentMemoOptions(records, item.activity_id), [records, item.activity_id]);
    const [memo, setMemo] = useState(item.memo);
    const [start, setStart] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [editing, setEditing] = useState(false);
    const [memoEditing, setMemoEditing] = useState(false);
    const [cancelItem, setCancelItem] = useState(null);
    const cancelRequested = useRef(false);
    const memoInput = useRef({ focused: false, composing: false });
    const updateMemoEditing = patch => {
        Object.assign(memoInput.current, patch);
        setMemoEditing(memoInput.current.focused || memoInput.current.composing);
    };
    const draftBase = useRef(item);
    const [, refreshDraft] = useState(0);
    const localDraft = useRef(null);
    if (!localDraft.current) {
        localDraft.current = createStopwatchDraft(
            (base, data) => operateStopwatch(base, 'edit', data),
            () => refreshDraft(value => value + 1),
        );
    }
    const changes = localDraft.current.changes;
    const editMemo = value => {
        if (own) {
            localDraft.current.update(item, { memo: value });
            return;
        }
        if (!editing && !showEditor) draftBase.current = item;
        setEditing(true);
        setMemo(value);
    };
    const savedItem = async () => {
        if (own) return localDraft.current.flush(item);
        if (!editing) return item;
        const result = await operateStopwatch(draftBase.current, 'edit', { memo });
        setEditing(false);
        return result.item;
    };
    const autoSave = useRef(null);
    const autoSavePending = useRef(null);
    autoSave.current = () => {
        const saving = run(savedItem).finally(() => { autoSavePending.current = null; });
        autoSavePending.current = saving;
        return saving;
    };
    // 詳細欄のフォーカス・変換中は保存せず、欄を離れてから一括保存する。
    useEffect(() => {
        if (!own || !Object.keys(changes).length || busy || memoEditing || cancelRequested.current) return;
        const timer = setTimeout(() => {
            if (!memoInput.current.focused && !memoInput.current.composing && !cancelRequested.current) autoSave.current();
        }, 600);
        return () => clearTimeout(timer);
    }, [own, changes, busy, memoEditing, cancelItem]);
    useEffect(() => {
        const registry = drafts.current;
        registry[item.id] = savedItem;
        return () => { delete registry[item.id]; };
    });
    useEffect(() => { if (!editing) setMemo(item.memo); }, [item.memo, editing]);
    const { recordSaveMode } = useSettings();
    const { groups } = useGroups();
    const canDiscord = own && item.is_local && item.discord_enabled && groups.some(group => group.name === item.activity_group && group.client_id);
    const displayedItem = own ? { ...item, ...changes } : item;
    const controller = {
        displayTime: elapsedMilliseconds(displayedItem, now), displayStartTime: displayedItem.started_at,
        memo: own ? displayedItem.memo : memo, setMemo: editMemo,
        isDiscordBusy: busy, discordEnabled: canDiscord,
        discordConnected: item.discord_connected,
        complete: () => run(async () => {
            const current = await savedItem();
            return recordSaveMode === 'confirm' ? openConfirm(current) : operateStopwatch(current, 'complete');
        }),
        cancel: () => {
            // 確認中は自動保存を止め、既に始まった保存だけ完了を待つ。
            cancelRequested.current = true;
            if (autoSavePending.current) {
                return autoSavePending.current.then(saved => setCancelItem(saved || item));
            }
            setCancelItem(item);
        },
        pause: () => openConfirm(item),
        updateStartTime: value => {
            if (!Number.isFinite(value) || value > Date.now()) throw new Error(t("Start time cannot be in the future"));
            localDraft.current.update(item, { started_at: value });
        },
    };
    const elapsed = Math.floor(elapsedMilliseconds(item, now) / 1000);
    const formattedTime = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    const startValue = timestamp => DateTime.fromMillis(timestamp).toFormat("yyyy-MM-dd'T'HH:mm:ss");
    const closeEditor = () => { setShowEditor(false); setEditing(false); setMemo(item.memo); };
    return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', ...(!own && { backgroundImage: theme => `linear-gradient(${alpha(theme.palette.text.primary, 0.035)}, ${alpha(theme.palette.text.primary, 0.035)})` }) }}>
        {own ? <>
            <StopwatchView inlineMode controller={controller} activityId={item.activity_id}
                onMemoFocus={() => updateMemoEditing({ focused: true })}
                onMemoBlur={() => updateMemoEditing({ focused: false })}
                onMemoCompositionStart={() => updateMemoEditing({ composing: true })}
                onMemoCompositionEnd={() => updateMemoEditing({ composing: false })}
                activityName={item.activity_name} activityGroup={item.activity_group}
                discordData={canDiscord ? {} : null} recordSaveMode="auto" confirming={item.status === 'confirming'} />
        </> : <Box sx={{ px: 2, pt: 2, pb: 1, position: 'relative' }}>
            <Typography variant="caption" color="text.secondary" title={`${item.device_name}${item.slot === 'sub' ? ' · サブ' : ''}`} sx={{ position: 'absolute', top: 6, left: 16, right: 16, fontSize: '0.625rem', lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.device_name}{item.slot === 'sub' ? ' · サブ' : ''}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 2, rowGap: 0, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, minHeight: 36, '& > svg': { flexShrink: 0 } }}>
                        {getIconForGroup(item.activity_group, groups)}
                        <Typography variant="h6" fontWeight={500} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item.activity_name}</Typography>
                    </Box>
                </Box>
                <Stack spacing={0} alignItems="flex-end" sx={{ gridColumn: 2, gridRow: '1 / span 2' }}>
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
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.875rem', sm: '0.75rem' } }}>開始 {DateTime.fromMillis(item.started_at).toFormat('HH:mm')}{item.status === 'confirming' ? ' · 保存確認中' : ''}</Typography>
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
            <Button size="small" disabled={busy || showEditor} onClick={() => run(async () => operateStopwatch(await savedItem(), 'resume'))}>計測に戻る</Button>
        </Stack>}
        <ConfirmDialog open={cancelItem !== null}
            content={cancelItem && `${cancelItem.device_name} の「${cancelItem.activity_name}」をキャンセルしますか？`}
            confirmLabel="OK" onCancel={() => {
                cancelRequested.current = false;
                setCancelItem(null);
            }}
            onConfirm={() => {
                return run(() => operateStopwatch(cancelItem, 'cancel')).finally(() => {
                    cancelRequested.current = false;
                    setCancelItem(null);
                });
            }} />
    </Box>;
}

const SharedStopwatches = forwardRef(function SharedStopwatches(props, ref) {
    const { t } = useI18n();
    const state = useSharedStopwatches();
    const { activities, refreshActivities } = useActivities();
    const { setActiveActivity } = useActiveActivity();
    const { setFilterState } = useFilter();
    const { discordEnabled, recordSaveMode, autoFilterOnSelect } = useSettings();
    const [now, setNow] = useState(Date.now());
    const [othersOpen, setOthersOpen] = useState(true);
    const [pending, setPending] = useState(null);
    const [error, setError] = useState('');
    const [quitItem, setQuitItem] = useState(null);
    const actionLock = useRef(false);
    const submitted = useRef(false);
    const pendingSubmit = useRef(null);
    const quittingAfterSave = useRef(false);
    const drafts = useRef({});
    const own = state.items.filter(item => item.device_id === state.device?.id && (!props.desktopPanel || item.slot === 'main'));
    const main = own.find(item => item.slot === 'main');
    const other = state.items.filter(item => item.device_id !== state.device?.id);
    const busy = state.busy || !state.ready || Boolean(state.error);
    const ownConfirmation = Boolean(pending && pending.item.device_id === state.device?.id && pending.item.slot === 'main');

    useEffect(() => {
        desktopCommand(ownConfirmation ? 'confirmation-open' : 'confirmation-closed');
        return () => { if (ownConfirmation) desktopCommand('confirmation-closed'); };
    }, [ownConfirmation]);

    useEffect(() => {
        if (props.desktopPanel || !state.ready || !state.device?.is_local) return;
        const ready = () => window.pywebview?.api?.desktop_ready?.(state.device.id);
        ready();
        window.addEventListener('pywebviewready', ready);
        return () => window.removeEventListener('pywebviewready', ready);
    }, [props.desktopPanel, state.ready, state.device?.id, state.device?.is_local]);
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
        if (props.desktopPanel || !main || !state.device?.is_local || busy || main.discord_enabled === discordEnabled) return;
        operateStopwatch(main, 'edit', { discord_enabled: discordEnabled }).catch(err => setError(err.message));
    }, [props.desktopPanel, main, state.device?.is_local, discordEnabled, busy]);

    const start = async activity => {
        const publishToDiscord = props.desktopPanel ? await desktopDiscordEnabled() : discordEnabled;
        if (autoFilterOnSelect) setFilterState(previous => ({ ...previous, activityNameFilter: activity.name }));
        await stopwatchRequest('/api/stopwatches', {
            id: newStopwatchId(), device_id: state.device.id, activity_id: activity.id,
            discord_enabled: state.device.is_local && publishToDiscord,
        });
    };
    const openConfirm = async (item, next = null) => {
        const result = item.status === 'confirming' ? { item } : await operateStopwatch(item, 'confirm');
        // 一覧の再取得で項目オブジェクトが変わっても、確認中の入力を初期化しない。
        const activity = activities.find(value => value.id === result.item.activity_id)
            || { id: result.item.activity_id, name: result.item.activity_name, unit: 'minutes' };
        setPending({ item: result.item, next, activity });
        return null;
    };
    const desktopAction = command => run(async () => {
        if (busy) throw new Error(t('Wait for the current operation to finish.'));
        if (main) await drafts.current[main.id]?.();
        await desktopCommand(command);
    });
    useEffect(() => {
        const handle = event => {
            if (event.detail === 'open-panel') { desktopAction('panel-ready'); return; }
            if (event.detail !== 'quit') return;
            run(async () => {
                if (busy) throw new Error(t('Wait for the current operation to finish.'));
                const saved = main ? await drafts.current[main.id]?.() || main : null;
                await refreshStopwatches();
                const latest = saved && currentStopwatch(saved.id);
                if (latest) setQuitItem(latest);
                else await desktopCommand('quit-ready');
            });
        };
        window.addEventListener('chronoloft:desktop', handle);
        return () => window.removeEventListener('chronoloft:desktop', handle);
    });
    const finishQuit = action => run(async () => {
        if (pending?.item.id === quitItem.id && action === 'complete') {
            quittingAfterSave.current = true;
            try {
                if (!await pendingSubmit.current?.()) {
                    setQuitItem(null);
                    return;
                }
            } finally { quittingAfterSave.current = false; }
        } else {
            await operateStopwatch(quitItem, action);
            if (pending?.item.id === quitItem.id) setPending(null);
        }
        setQuitItem(null);
        await desktopCommand('quit-ready');
    });
    useImperativeHandle(ref, () => ({
        desktopAction,
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
        {!props.desktopPanel && other.length > 0 && <Box>
            <Button color="inherit" size="small" fullWidth onClick={() => setOthersOpen(value => !value)} aria-expanded={othersOpen} sx={{ justifyContent: 'space-between', color: 'text.secondary', px: 0.5, mb: othersOpen ? 1 : 0 }} endIcon={<ExpandMoreIcon sx={{ transform: othersOpen ? 'rotate(180deg)' : 'none' }} />}>
                ほかの端末
            </Button>
            <Collapse in={othersOpen}>
                <Stack spacing={1.5}>{other.map(item => <SessionCard key={item.id} item={item} now={now + state.offset} busy={busy} openConfirm={openConfirm} run={run} drafts={drafts} />)}</Stack>
            </Collapse>
        </Box>}
        <Dialog open={Boolean(quitItem)} onClose={() => { if (!state.busy) setQuitItem(null); }} fullWidth maxWidth="xs">
            <DialogTitle>{t('Quit Chronoloft?')}</DialogTitle>
            <DialogContent>
                <Typography>{t('Save the current stopwatch or discard it before quitting.')}</Typography>
                <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>{quitItem?.activity_name}</Typography>
                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap' }}>
                <Button disabled={state.busy} onClick={() => setQuitItem(null)}>{t('Keep running')}</Button>
                <Button disabled={state.busy} color="error" onClick={() => finishQuit('cancel')}>{t('Discard and quit')}</Button>
                <Button disabled={state.busy} variant="contained" onClick={() => finishQuit('complete')}>{t('Save and quit')}</Button>
            </DialogActions>
        </Dialog>
        {pending && <AddRecordDialog open title={`${pending.item.device_name}：${pending.item.activity_name}`}
            submitRef={pendingSubmit}
            activity={pending.activity}
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
                if (pending.next && !quittingAfterSave.current) await run(() => start(pending.next));
            }} />}
    </Stack>;
});
export default SharedStopwatches;
