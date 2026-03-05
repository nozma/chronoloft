import {
    Button,
    Box,
    IconButton,
    ToggleButton,
    Typography,
    Collapse,
    Menu,
    MenuItem,
    Tooltip
} from '@mui/material';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import GroupManagementDialog from './GroupManagementDialog';
import TagManagementDialog from './TagManagementDialog';
import ActivityManagementDialog from './ActivityManagementDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useActivities } from '../contexts/ActivityContext';
import { useFilter } from '../contexts/FilterContext';
import { useUI } from '../contexts/UIContext';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { styled } from '@mui/material/styles';
import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';

function TruncatedActivityLabel({ text, sx }) {
    const textRef = useRef(null);
    const containerRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    const measureTruncation = useCallback(() => {
        const textElement = textRef.current;
        const containerElement = containerRef.current;
        if (!textElement || !containerElement) return;

        // テキスト本来の幅と、ボタン内で実際に使える幅を比較して省略を判定する
        setIsTruncated(textElement.scrollWidth > containerElement.clientWidth + 1);
    }, []);

    useLayoutEffect(() => {
        const textElement = textRef.current;
        const containerElement = containerRef.current;
        if (!textElement || !containerElement) return;

        const rafId = window.requestAnimationFrame(measureTruncation);

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measureTruncation);
            return () => {
                window.cancelAnimationFrame(rafId);
                window.removeEventListener('resize', measureTruncation);
            };
        }

        const observer = new ResizeObserver(measureTruncation);
        observer.observe(textElement);
        observer.observe(containerElement);
        return () => {
            window.cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [text, measureTruncation]);

    return (
        <Tooltip
            title={text}
            enterDelay={0}
            enterNextDelay={0}
            arrow
            disableHoverListener={!isTruncated}
        >
            <Box
                component="span"
                ref={containerRef}
                sx={{ display: 'inline-flex', flex: '1 1 auto', minWidth: 0, maxWidth: '100%' }}
                onMouseEnter={measureTruncation}
            >
                <Box component="span" ref={textRef} sx={{ ...sx, display: 'block', width: '100%' }}>
                    {text}
                </Box>
            </Box>
        </Tooltip>
    );
}

function ActivityStart({
    activities,
    onStart,
    stopwatchVisible,
    onStartSubStopwatch,
    selectedActivity,
    subSelectedActivity,
    subStopwatchVisible,
}) {
    const { groups, excludedGroupIds } = useGroups();
    const { excludedActivityIds } = useActivities();
    const { state, dispatch } = useUI();
    const { filterState, setFilterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;
    const { recentDays, recentLimit, layoutMode } = useSettings();
    const isTwoColumnLayout = layoutMode === 'two-column';

    const [contextMenuAnchor, setContextMenuAnchor] = useState(null);
    const [contextTargetActivity, setContextTargetActivity] = useState(null);
    const [showRemaining, setShowRemaining] = useState(false);
    const [showArchive, setShowArchive] = useState(false);

    // アクティビティに対するフィルターの適用
    const filteredActivities = activities.filter(act => {
        // グループフィルタ
        if (groupFilter && act.group_name !== groupFilter) {
            return false;
        }
        if (excludedGroupIds.has(act.group_id) && act.group_name !== groupFilter) {
            return false;
        }
        // タグフィルタ
        if (tagFilter) {
            const activityTag = act.tags.map(t => t.name);
            return activityTag.includes(tagFilter);
        }
        if (excludedActivityIds.has(Number(act.id)) && groupFilter !== '') {
            return false;
        }
        return true;
    });

    // タグに対するフィルターの適用
    const groupTags = useMemo(() => {
        const encountered = new Set();
        const result = [];
        activities.forEach(act => {
            if (groupFilter && act.group_name !== groupFilter) return;  // グループフィルタ適用
            if (!groupFilter && excludedGroupIds.has(Number(act.group_id))) return;
            if (groupFilter && excludedActivityIds.has(Number(act.id))) return;
            act.tags?.forEach(t => {
                if (!encountered.has(t.name)) {
                    encountered.add(t.name);
                    result.push(t.name);
                }
            });
        });
        return result;
    }, [activities, groupFilter, excludedGroupIds, excludedActivityIds]);

    // 表示するActivityを設定を反映して絞り込む
    // 期間フィルタ
    const activeActivities = filteredActivities.filter(act => Boolean(act.is_active));
    const inactiveActivities = filteredActivities.filter(act => !Boolean(act.is_active));

    let recentWithinRange;
    if (recentDays === 'all') {
        recentWithinRange = activeActivities;
    } else {
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - Number(recentDays));
        recentWithinRange = activeActivities.filter(
            act => act.last_record && new Date(act.last_record) >= cutoff
        );
    }

    // 件数上限
    const limitCount =
        recentLimit === 'all'
            ? recentWithinRange.length
            : Number(recentLimit);

    // 上限件数ぶんだけ recentActivities とし、残りを remainingActivities に回す
    const recentActivities = recentWithinRange.slice(0, limitCount);
    const remainingActivities = activeActivities.filter(
        act => !recentActivities.includes(act)
    );

    // トグルボタンのスタイル
    const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
        [`& .${toggleButtonGroupClasses.grouped}`]: {
            margin: theme.spacing(0.5),
            border: 0,
            borderRadius: 10,
            [`&.${toggleButtonGroupClasses.disabled}`]: {
                border: 0,
            },
        },
        [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]:
        {
            marginLeft: -1,
            borderLeft: '1px solid transparent',
        },
    }));

    // 右クリック用ハンドラ
    const handleContextMenu = (event, activity) => {
        event.preventDefault();
        setContextMenuAnchor(event.currentTarget);
        setContextTargetActivity(activity);
    };

    const handleCloseContextMenu = () => {
        setContextMenuAnchor(null);
        setContextTargetActivity(null);
    };

    const handleStartSubStopwatch = () => {
        handleCloseContextMenu();
        if (contextTargetActivity && onStartSubStopwatch) {
            onStartSubStopwatch(contextTargetActivity);
        }
    };

    const handleGroupFilterChange = (newGroupFilter) => {
        setFilterState(prev => ({
            ...prev,
            groupFilter: newGroupFilter ?? '',
            activityNameFilter: '',
            tagFilter: '',
        }));
    };
    const activityButtonCompactSx = isTwoColumnLayout
        ? {
            px: 1,
            py: 0.25,
            minHeight: 30,
            fontSize: '0.78rem',
            width: 'fit-content',
            maxWidth: '100%',
            minWidth: 0,
            overflow: 'hidden',
            '& .MuiButton-startIcon': { mr: 0.5, ml: -0.25, flexShrink: 0 },
        }
        : {};
    const activityNameLabelSx = isTwoColumnLayout
        ? {
            display: 'inline-block',
            minWidth: 0,
            flex: '1 1 auto',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
        }
        : {};


    return (
        <>
            <Box sx={{ mb: 3 }}>
                {/* グループフィルタ */}
                <Box sx={{ mb: isTwoColumnLayout ? 1.5 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography
                            variant='caption'
                            color='#cccccc'
                            sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                            onClick={() => dispatch({ type: 'SET_GROUP_OPEN', payload: !state.groupOpen })}
                        >
                            Group
                            <KeyboardArrowRightIcon
                                fontSize='small'
                                sx={{
                                    transition: 'transform 0.15s linear',
                                    transform: state.groupOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    marginLeft: '4px'
                                }}
                            />
                        </Typography>
                        {isTwoColumnLayout && !state.activityDialogOpen && (
                            <IconButton
                                size="small"
                                onClick={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: true })}
                                sx={{ color: '#cccccc' }}
                            >
                                <SettingsIcon fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                    <Collapse in={state.groupOpen}>
                        <Box>
                            {isTwoColumnLayout ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                                    <ToggleButton
                                        value=""
                                        aria-label="All"
                                        size="small"
                                        selected={groupFilter === ''}
                                        onClick={() => handleGroupFilterChange('')}
                                        sx={{ minHeight: 30, py: 0.25, px: 1 }}
                                    >
                                        All
                                    </ToggleButton>
                                    {groups.map((group) => (
                                        <ToggleButton
                                            key={group.id}
                                            value={group.name}
                                            aria-label={group.name}
                                            size="small"
                                            selected={groupFilter === group.name}
                                            onClick={() => handleGroupFilterChange(group.name)}
                                            sx={{ minHeight: 30, py: 0.25, px: 1 }}
                                        >
                                            {getIconForGroup(group.name, groups)}
                                            {group.name}
                                        </ToggleButton>
                                    ))}
                                </Box>
                            ) : (
                                <ToggleButtonGroup
                                    value={groupFilter}
                                    exclusive
                                    size='medium'
                                    onChange={(e, newGroupFilter) => {
                                        if (newGroupFilter === null) {
                                            return;
                                        }
                                        handleGroupFilterChange(newGroupFilter);
                                    }}
                                    aria-label="Group filter"
                                    sx={{ mb: 1, mr: 1 }}
                                >
                                    <ToggleButton value="" aria-label="All">
                                        All
                                    </ToggleButton>
                                    {groups.map((group) => (
                                        <ToggleButton key={group.id} value={group.name} aria-label={group.name}>
                                            {getIconForGroup(group.name, groups)}
                                            {group.name}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            )}
                            {!isTwoColumnLayout && !state.activityDialogOpen && (
                                <IconButton
                                    onClick={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: true })}
                                    sx={{
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        '&:hover': { opacity: 1 },
                                    }}>
                                    <SettingsIcon />
                                </IconButton>
                            )}
                            <GroupManagementDialog open={state.groupDialogOpen} onClose={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: false })} />
                        </Box>
                    </Collapse>
                </Box>

                {/* タグフィルタ */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography
                        variant='caption'
                        color='#cccccc'
                        sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                        onClick={() => dispatch({ type: 'SET_TAG_OPEN', payload: !state.tagOpen })}
                    >
                        Tag
                        <KeyboardArrowRightIcon
                            fontSize='small'
                            sx={{
                                transition: 'transform 0.15s linear',
                                transform: state.tagOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                marginLeft: '4px'
                            }}
                        />
                    </Typography>
                    {isTwoColumnLayout && !state.activityDialogOpen && (
                        <IconButton
                            size="small"
                            onClick={() => dispatch({ type: 'SET_TAG_DIALOG', payload: true })}
                            sx={{ color: '#cccccc' }}
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
                <Collapse in={state.tagOpen}>
                    <Box>
                        <StyledToggleButtonGroup
                            value={tagFilter}
                            exclusive
                            size='small'
                            onChange={(e) => {
                                const tagFilter = e.currentTarget.value;
                                setFilterState(prev => ({
                                    ...prev,
                                    tagFilter: tagFilter || ``,
                                }));
                            }}
                            multiple
                            sx={{
                                mb: 1,
                                mr: isTwoColumnLayout ? 0 : 1,
                                flexWrap: 'wrap',
                                ...(isTwoColumnLayout
                                    ? {
                                        rowGap: 0,
                                        [`& .${toggleButtonGroupClasses.grouped}`]: { margin: 0.25 },
                                        '& .MuiToggleButton-root': { lineHeight: 1.1 },
                                    }
                                    : {}),
                            }}
                        >
                            <ToggleButton
                                value=""
                                aria-label="All"
                                sx={isTwoColumnLayout ? { minHeight: 30, py: 0.25, px: 1, fontSize: '0.78rem' } : {}}
                            >
                                All
                            </ToggleButton>
                            {groupTags.map(tagName => (
                                <ToggleButton
                                    key={tagName}
                                    value={tagName}
                                    sx={isTwoColumnLayout ? { minHeight: 30, py: 0.25, px: 1, fontSize: '0.78rem' } : {}}
                                >
                                    {tagName}
                                </ToggleButton>
                            ))}
                            {!isTwoColumnLayout && !state.activityDialogOpen && (
                                <IconButton
                                    onClick={() => dispatch({ type: 'SET_TAG_DIALOG', payload: true })}
                                    sx={{
                                        opacity: 0,
                                        transition: 'opacity 0.2s',
                                        '&:hover': { opacity: 1 },
                                    }}>
                                    <SettingsIcon />
                                </IconButton>
                            )}
                        </StyledToggleButtonGroup>
                        <TagManagementDialog open={state.tagDialogOpen} onClose={() => dispatch({ type: 'SET_TAG_DIALOG', payload: false })} />
                    </Box>
                </Collapse>
                {/* アクティビティ表示 */}
                {!state.activityDialogOpen && (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography
                                variant='caption'
                                color='#cccccc'
                                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                                onClick={() => dispatch({ type: 'SET_ACTIVITY_OPEN', payload: !state.activityOpen })}
                            >
                                Activity (Click to start recording)
                                <KeyboardArrowRightIcon
                                    fontSize='small'
                                    sx={{
                                        transition: 'transform 0.15s linear',
                                        transform: state.activityOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                        marginLeft: '4px'
                                    }}
                                />
                            </Typography>
                            {isTwoColumnLayout && (
                                <IconButton
                                    size="small"
                                    onClick={() => dispatch({ type: 'SET_ACTIVITY_DIALOG', payload: true })}
                                    sx={{ color: '#cccccc' }}
                                >
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                        <Collapse in={state.activityOpen}>
                            <Box>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {recentActivities.map(activity => (
                                        <Button
                                            key={activity.id}
                                            variant="outlined"
                                            color="primary"
                                            size={isTwoColumnLayout ? 'small' : 'medium'}
                                            onClick={() => onStart(activity)}
                                            onContextMenu={(e) => handleContextMenu(e, activity)}
                                            sx={{
                                                display: 'flex',
                                                textTransform: 'none',
                                                borderRadius: 5,
                                                boxShadow: 2,
                                                justifyContent: isTwoColumnLayout ? 'flex-start' : 'center',
                                                ...activityButtonCompactSx,
                                                ...(activity.is_active
                                                    ? {}
                                                    : {
                                                        color: 'text.disabled',
                                                        borderColor: 'text.disabled',
                                                        '&:hover': {
                                                            borderColor: 'text.disabled',
                                                            backgroundColor: 'action.hover'
                                                        },
                                                    }),
                                            }}
                                            startIcon={getIconForGroup(activity.group_name, groups)}
                                        >
                                            <TruncatedActivityLabel text={activity.name} sx={activityNameLabelSx} />
                                        </Button>
                                    ))}
                                    {/* 設定アイコンの表示 */}
                                    {!isTwoColumnLayout && !state.activityDialogOpen && (
                                        <IconButton
                                            variant="contained" onClick={() => dispatch({ type: 'SET_ACTIVITY_DIALOG', payload: true })}
                                            sx={{
                                                opacity: 0,
                                                transition: 'opacity 0.3s',
                                                '&:hover': { opacity: 1 },
                                            }}
                                        >
                                            <SettingsIcon />
                                        </IconButton>
                                    )}
                                </Box>
                                {/* 残りの項目を表示するUI */}
                                {(remainingActivities.length > 0 || inactiveActivities.length > 0) && (
                                    <Typography
                                        variant='caption'
                                        color='#777'
                                        sx={{
                                            alignItems: 'center',
                                            display: 'flex',
                                            cursor: 'pointer',
                                            my: 0.5,
                                            ml: 2
                                        }}
                                        onClick={() => setShowRemaining((prev) => {
                                            const next = !prev;
                                            if (next) setShowArchive(false);
                                            return next;
                                        })}
                                    >
                                        More Items
                                        <KeyboardArrowRightIcon
                                            fontSize='small'
                                            sx={{
                                                transition: 'transform 0.15s linear',
                                                transform: showRemaining ? 'rotate(90deg)' : 'rotate(0deg)',
                                                marginLeft: '4px'
                                            }}
                                        />
                                    </Typography>
                                )}
                                <Collapse in={showRemaining}>
                                    {remainingActivities.length > 0 && (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0 }}>
                                            {remainingActivities.map(activity => (
                                                <Button
                                                    key={activity.id}
                                                    variant="outlined"
                                                    color="primary"
                                                    size={isTwoColumnLayout ? 'small' : 'medium'}
                                                    onClick={() => onStart(activity)}
                                                    onContextMenu={(e) => handleContextMenu(e, activity)}
                                                    sx={{
                                                        display: 'flex',
                                                        textTransform: 'none',
                                                        borderRadius: 5,
                                                        boxShadow: 2,
                                                        justifyContent: isTwoColumnLayout ? 'flex-start' : 'center',
                                                        ...activityButtonCompactSx,
                                                    }}
                                                    startIcon={getIconForGroup(activity.group_name, groups)}
                                                >
                                                    <TruncatedActivityLabel text={activity.name} sx={activityNameLabelSx} />
                                                </Button>
                                            ))}
                                        </Box>
                                    )}
                                    {inactiveActivities.length > 0 && (
                                        <>
                                            <Typography
                                                variant='caption'
                                                color='#777'
                                                sx={{
                                                    alignItems: 'center',
                                                    display: 'flex',
                                                    cursor: 'pointer',
                                                    my: 0.5,
                                                    ml: 2
                                                }}
                                                onClick={() => setShowArchive((prev) => !prev)}
                                            >
                                                Archive
                                                <KeyboardArrowRightIcon
                                                    fontSize='small'
                                                    sx={{
                                                        transition: 'transform 0.15s linear',
                                                        transform: showArchive ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        marginLeft: '4px'
                                                    }}
                                                />
                                            </Typography>
                                            <Collapse in={showArchive}>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0 }}>
                                                    {inactiveActivities.map(activity => (
                                                        <Button
                                                            key={activity.id}
                                                            variant="outlined"
                                                            color="primary"
                                                            size={isTwoColumnLayout ? 'small' : 'medium'}
                                                            onClick={() => onStart(activity)}
                                                            onContextMenu={(e) => handleContextMenu(e, activity)}
                                                            sx={{
                                                                display: 'flex',
                                                                textTransform: 'none',
                                                                borderRadius: 5,
                                                                boxShadow: 2,
                                                                justifyContent: isTwoColumnLayout ? 'flex-start' : 'center',
                                                                ...activityButtonCompactSx,
                                                                color: 'text.disabled',
                                                                borderColor: 'text.disabled',
                                                                '&:hover': {
                                                                    borderColor: 'text.disabled',
                                                                    backgroundColor: 'action.hover'
                                                                },
                                                            }}
                                                            startIcon={getIconForGroup(activity.group_name, groups)}
                                                        >
                                                            <TruncatedActivityLabel text={activity.name} sx={activityNameLabelSx} />
                                                        </Button>
                                                    ))}
                                                </Box>
                                            </Collapse>
                                        </>
                                    )}
                                </Collapse>
                                <Menu
                                    open={Boolean(contextMenuAnchor)}
                                    anchorEl={contextMenuAnchor}
                                    onClose={handleCloseContextMenu}
                                >
                                    <MenuItem
                                        onClick={handleStartSubStopwatch}
                                        disabled={contextTargetActivity?.unit === 'count'}
                                    >
                                        Start Sub Stopwatch
                                    </MenuItem>
                                </Menu>
                            </Box>
                        </Collapse>
                    </>
                )}
                <ActivityManagementDialog
                    open={state.activityDialogOpen}
                    onClose={() => dispatch({ type: 'SET_ACTIVITY_DIALOG', payload: false })}
                    runningActivityIds={[
                        ...(stopwatchVisible && selectedActivity ? [selectedActivity.id] : []),
                        ...(subStopwatchVisible && subSelectedActivity ? [subSelectedActivity.id] : []),
                    ]}
                />
            </Box>
        </>
    );
}

export default ActivityStart;
