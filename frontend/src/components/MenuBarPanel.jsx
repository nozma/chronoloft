import { useEffect, useRef } from 'react';
import { Alert, Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useActivities } from '../contexts/ActivityContext';
import { useRecords } from '../contexts/RecordContext';
import { useGroups } from '../contexts/GroupContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSharedStopwatches } from '../services/stopwatches';
import { useI18n } from '../i18n/I18nContext';
import { recentDesktopActivities } from '../utils/desktop';
import getIconForGroup from '../utils/getIconForGroup';
import { fetchActivityGroups } from '../services/api';
import SharedStopwatches from './SharedStopwatches';

export default function MenuBarPanel() {
    const controller = useRef(null);
    const { t } = useI18n();
    const { activities, refreshActivities } = useActivities();
    const { records } = useRecords();
    const { groups, setGroups, excludedGroupIds, setGroupExclusions } = useGroups();
    const { recentDays, recentLimit, recentMinimum } = useSettings();
    const state = useSharedStopwatches();
    const main = state.items.find(item => item.device_id === state.device?.id && item.slot === 'main');
    const { recent: candidates, hasHistory } = recentDesktopActivities(activities, records, {
        recentDays, recentLimit, recentMinimum, excludedGroupIds,
    });
    useEffect(() => {
        const resize = () => window.webkit?.messageHandlers?.chronoloft?.postMessage({
            command: 'resize',
            height: document.querySelector('[role=dialog]') ? 560 : Math.ceil(document.getElementById('root').getBoundingClientRect().height),
        });
        const observer = new ResizeObserver(resize);
        observer.observe(document.getElementById('root'));
        const dialogs = new MutationObserver(resize);
        dialogs.observe(document.body, { childList: true, subtree: true });
        return () => { observer.disconnect(); dialogs.disconnect(); };
    }, []);
    useEffect(() => {
        const refresh = () => {
            refreshActivities();
            fetchActivityGroups().then(setGroups).catch(() => {});
            // パネルを開くたびに、アプリで変更したグループの除外設定を読み直す。
            try {
                setGroupExclusions(JSON.parse(localStorage.getItem('groupExclusions') || '{}'));
            } catch (error) {
                console.error('Failed to refresh group exclusions:', error);
            }
        };
        window.addEventListener('chronoloft:panel-opened', refresh);
        return () => window.removeEventListener('chronoloft:panel-opened', refresh);
    }, [refreshActivities, setGroups, setGroupExclusions]);
    return <Stack spacing={1.5} sx={{ py: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={600}>Chronoloft</Typography>
            <Tooltip title={t('Open app')}>
                <IconButton size="small" aria-label={t('Open app')} onClick={() => controller.current?.desktopAction('open')}>
                    <OpenInNewIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
        <SharedStopwatches ref={controller} desktopPanel />
        {!main && <>
            <Typography variant="subtitle2">{t(hasHistory ? 'Recent activities' : 'Start a stopwatch')}</Typography>
            {!candidates.length && <Alert severity="info">{t('No time activities available. Add one in the app.')}</Alert>}
            <Box>
                {candidates.map(activity => <Button key={activity.id} fullWidth
                    disabled={!state.ready || state.busy || Boolean(state.error)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', overflowWrap: 'anywhere' }}
                    onClick={() => controller.current?.start(activity)}>
                    {getIconForGroup(groups.find(group => group.id === activity.group_id)?.name, groups)}
                    {activity.name}
                </Button>)}
            </Box>
        </>}
    </Stack>;
}
