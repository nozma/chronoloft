import {
    Autocomplete,
    Button,
    Box,
    IconButton,
    TextField,
    ToggleButton,
    Typography
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
import { useTags } from '../contexts/TagContext';
import SettingsIcon from '@mui/icons-material/Settings';
import { styled } from '@mui/material/styles';

function ActivityStart({ activities, onStart, stopwatchVisible }) {
    const { groups } = useGroups();
    const { tags } = useTags();
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
        // タグフィルタ: activity に紐づくタグのIDが一つでも tagFilter に含まれていれば表示
        if (tagFilter && tagFilter.length > 0) {
            if (!act.tags || act.tags.length === 0) {
                return false;
            }
            // act.tags は [{id, name, color}, ...] の想定
            const activityTagIds = act.tags.map(t => t.id);
            // OR条件: tagFilterのいずれかがactivityTagIdsに含まれていればtrue
            const matches = tagFilter.some(tagId => activityTagIds.includes(tagId));
            return matches;
        }
        return true;
    });
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
                <Typography variant='caption' color='#cccccc'>Group</Typography>
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

                {/* タグフィルタ */}
                <Typography variant='caption' color='#cccccc'>Tags</Typography>
                <Box>
                    <StyledToggleButtonGroup
                        value={tagFilter}
                        exclusive
                        size='small'
                        onChange={(e) => {
                            const tagFilter = e.currentTarget.value;
                            setFilterState(prev => ({
                                ...prev,
                                tagFilter: tagFilter || [],
                            }));
                        }}
                        multiple
                        sx={{ mb: 1, mr: 1 }}
                    >
                        <ToggleButton value="" aria-label="All">
                            All
                        </ToggleButton>
                        {tags.map(tag => (
                            <ToggleButton key={tag.id} value={tag.id}>
                                {tag.name}
                            </ToggleButton>
                        ))}
                    </StyledToggleButtonGroup>
                    {!state.showGrid && !stopwatchVisible && (
                        <IconButton
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