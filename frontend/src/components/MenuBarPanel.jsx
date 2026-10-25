import { useEffect, useRef } from 'react';
import { Alert, Box, Button, Divider, Stack, Typography } from '@mui/material';
import { useActivities } from '../contexts/ActivityContext';
import { useRecords } from '../contexts/RecordContext';
import { useGroups } from '../contexts/GroupContext';
import { useSharedStopwatches } from '../services/stopwatches';
import { useI18n } from '../i18n/I18nContext';
import { desktopCommand, recentDesktopActivities } from '../utils/desktop';
import getIconForGroup from '../utils/getIconForGroup';
import { fetchActivityGroups } from '../services/api';
import SharedStopwatches from './SharedStopwatches';

export default function MenuBarPanel() {
    const controller = useRef(null);
    const { t } = useI18n();
    const { activities, refreshActivities } = useActivities();
    const { records } = useRecords();
    const { groups, setGroups } = useGroups();
    const state = useSharedStopwatches();
    const main = state.items.find(item => item.device_id === state.device?.id && item.slot === 'main');
    const { recent, eligible } = recentDesktopActivities(activities, records);
    const candidates = recent.length ? recent : eligible;
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
        };
        window.addEventListener('chronoloft:panel-opened', refresh);
        return () => window.removeEventListener('chronoloft:panel-opened', refresh);
    }, [refreshActivities, setGroups]);
    return <Stack spacing={1.5} sx={{ py: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>Chronoloft</Typography>
        <SharedStopwatches ref={controller} desktopPanel />
        {!main && <>
            <Typography variant="subtitle2">{t(recent.length ? 'Recent activities' : 'Start a stopwatch')}</Typography>
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
        <Divider />
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
            <Button onClick={() => controller.current?.desktopAction('open')}>{t('Open app')}</Button>
            <Button onClick={() => controller.current?.desktopAction('settings')}>{t('Settings')}</Button>
            <Button sx={{ ml: 'auto' }} onClick={() => desktopCommand('quit')}>{t('Quit')}</Button>
        </Stack>
    </Stack>;
}
