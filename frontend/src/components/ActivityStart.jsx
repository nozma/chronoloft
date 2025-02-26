import {
    Autocomplete,
    Button,
    Box,
    IconButton,
    TextField,
    ToggleButton,
    Typography,
    Collapse
} from '@mui/material';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import GroupManagementDialog from './GroupManagementDialog';
import TagManagementDialog from './TagManagementDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useFilter } from '../contexts/FilterContext';
import { useUI } from '../contexts/UIContext';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { styled } from '@mui/material/styles';
import { useMemo } from 'react';

function ActivityStart({ activities, onStart, stopwatchVisible }) {
    const { groups } = useGroups();
    const { state, dispatch } = useUI();
    const { filterState, setFilterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;

    const handleAutocompleteChange = (event, newValue) => {
        if (newValue) {
            onStart(newValue);
            setShowAutocomplete(false);
        }
    };

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
    const filteredTags = useMemo(() => {
        const encountered = new Set();
        const result = [];

        for (const act of filteredActivities) {
            if (!act.tags) continue;
            for (const t of act.tags) {
                // 初めて出現したタグだけ追加 => 先頭のアクティビティほど最近
                if (!encountered.has(t.name)) {
                    encountered.add(t.name);
                    result.push(t.name);
                }
            }
        }
        return result;
    }, [filteredActivities]);


    // 最近使用した項目を取得
    const recentActivities = filteredActivities.slice(0, 5);
    const remainingActivities = filteredActivities.slice(5);

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
                            onChange={(e) => {
                                setFilterState({
                                    groupFilter: e.target.value,
                                    activityNameFilter: ``,
                                });
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
                        {!state.showGrid && !stopwatchVisible && (
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
                            sx={{ mb: 1, mr: 1 }}
                        >
                            <ToggleButton value="" aria-label="All">
                                All
                            </ToggleButton>
                            {filteredTags.map(tagName => (
                                <ToggleButton key={tagName} value={tagName}>
                                    {tagName}
                                </ToggleButton>
                            ))}
                        </StyledToggleButtonGroup>
                        {!state.showGrid && !stopwatchVisible && (
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
                        <TagManagementDialog open={state.tagDialogOpen} onClose={() => dispatch({ type: 'SET_TAG_DIALOG', payload: false })} />
                    </Box>
                </Collapse>
                {/* アクティビティ表示 */}
                {!state.showGrid && (
                    <>
                        <Typography variant='caption' color='#cccccc'>Activity (Click to start recording)</Typography>
                        <Box>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                {recentActivities.map(activity => (
                                    <Button
                                        key={activity.id}
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => onStart(activity)}
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
                                {remainingActivities.length > 0 && (
                                    <Autocomplete
                                        options={remainingActivities}
                                        getOptionLabel={(option) => option.name}
                                        onChange={handleAutocompleteChange}
                                        renderOption={(props, option) => (
                                            <li {...props}>
                                                {getIconForGroup(option.group_name, groups)}
                                                {option.name}
                                            </li>
                                        )}
                                        renderInput={(params) => (
                                            <TextField {...params} label="その他" variant="outlined" />
                                        )}
                                        sx={{ minWidth: 200 }}
                                        size='small'
                                    />
                                )}
                                {!state.showGrid && !stopwatchVisible && (
                                    <IconButton
                                        variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_GRID', payload: true })}
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
                        </Box>
                    </>
                )}
            </Box>
        </>
    );
}

export default ActivityStart;