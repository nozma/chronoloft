import {
    Button,
    Box,
    IconButton,
    ToggleButton,
    Typography,
    Collapse,
    Menu,
    MenuItem
} from '@mui/material';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import GroupManagementDialog from './GroupManagementDialog';
import TagManagementDialog from './TagManagementDialog';
import ActivityManagementDialog from './ActivityManagementDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useFilter } from '../contexts/FilterContext';
import { useUI } from '../contexts/UIContext';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { styled } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

function ActivityStart({ activities, onStart, stopwatchVisible, onStartSubStopwatch }) {
    const { groups } = useGroups();
    const { state, dispatch } = useUI();
    const { filterState, setFilterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;
    const { recentDays, recentLimit } = useSettings();

    const [contextMenuAnchor, setContextMenuAnchor] = useState(null);
    const [contextTargetActivity, setContextTargetActivity] = useState(null);
    const [showRemaining, setShowRemaining] = useState(false);

    // アクティビティに対するフィルターの適用
    const filteredActivities = activities.filter(act => {
        // グループフィルタ
        if (groupFilter && act.group_name !== groupFilter) {
            return false;
        }
        // タグフィルタ
        if (tagFilter) {
            const activityTag = act.tags.map(t => t.name);
            return activityTag.includes(tagFilter);
        }
        return true;
    });
    // タグに対するフィルターの適用
    const groupTags = useMemo(() => {
        const encountered = new Set();
        const result = [];
        activities.forEach(act => {
            if (groupFilter && act.group_name !== groupFilter) return;  // グループフィルタ適用
            act.tags?.forEach(t => {
                if (!encountered.has(t.name)) {
                    encountered.add(t.name);
                    result.push(t.name);
                }
            });
        });
        return result;
    }, [activities, groupFilter]);

    // 表示するActivityを設定を反映して絞り込む
    // 期間フィルタ
    let recentWithinRange;
    if (recentDays === 'all') {
        recentWithinRange = filteredActivities;
    } else {
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - Number(recentDays));
        recentWithinRange = filteredActivities.filter(
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
    const remainingActivities = filteredActivities.filter(
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


    return (
        <>
            <Box sx={{ mb: 3 }}>
                {/* グループフィルタ */}
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
                <Collapse in={state.groupOpen}>
                    <Box>
                        <ToggleButtonGroup
                            value={groupFilter}
                            exclusive
                            size='medium'
                            onChange={(e, newGroupFilter) => {
                                if (newGroupFilter === null) {
                                    return;
                                }
                                setFilterState(prev => ({
                                    ...prev,
                                    groupFilter: newGroupFilter ?? ``,
                                    activityNameFilter: ``,
                                    tagFilter: ``,
                                }));
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
                        {!state.activityDialogOpen && !stopwatchVisible && (
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

                {/* タグフィルタ */}
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
                            sx={{ mb: 1, mr: 1, flexWrap: 'wrap' }}
                        >
                            <ToggleButton value="" aria-label="All">
                                All
                            </ToggleButton>
                            {groupTags.map(tagName => (
                                <ToggleButton key={tagName} value={tagName}>
                                    {tagName}
                                </ToggleButton>
                            ))}
                            {!state.activityDialogOpen && !stopwatchVisible && (
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
                        <Collapse in={state.activityOpen}>
                            <Box>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {recentActivities.map(activity => (
                                        <Button
                                            key={activity.id}
                                            variant="outlined"
                                            color="primary"
                                            onClick={() => onStart(activity)}
                                            onContextMenu={(e) => handleContextMenu(e, activity)}
                                            sx={{
                                                display: 'flex',
                                                textTransform: 'none',
                                                borderRadius: 5,
                                                boxShadow: 2,
                                            }}
                                            startIcon={getIconForGroup(activity.group_name, groups)}
                                        >
                                            {activity.name}
                                        </Button>
                                    ))}
                                    {/* 設定アイコンの表示 */}
                                    {!state.activityDialogOpen && !stopwatchVisible && (
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
                                {remainingActivities.length > 0 && (
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
                                        onClick={() => setShowRemaining((prev) => !prev)}
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
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0 }}>
                                        {remainingActivities.map(activity => (
                                            <Button
                                                key={activity.id}
                                                variant="outlined"
                                                color="primary"
                                                onClick={() => onStart(activity)}
                                                onContextMenu={(e) => handleContextMenu(e, activity)}
                                                sx={{
                                                    display: 'flex',
                                                    textTransform: 'none',
                                                    borderRadius: 5,
                                                    boxShadow: 2,
                                                }}
                                                startIcon={getIconForGroup(activity.group_name, groups)}
                                            >
                                                {activity.name}
                                            </Button>
                                        ))}
                                    </Box>
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
                />
            </Box>
        </>
    );
}

export default ActivityStart;