import React, { useState, useReducer } from 'react';
import {
    Autocomplete,
    Button,
    Box,
    TextField,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import GroupManagementDialog from './GroupManagementDialog';
import CategoryManagementDialog from './CategoryManagementDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useCategories } from '../contexts/CategoryContext';
import { initialUIState, uiReducer } from '../reducers/uiReducer';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [shortcutGroupFilter, setShortcutGroupFilter] = useState('');
    const [shortcutCategoryFilter, setShortcutCategoryFilter] = useState('');
    const groups = useGroups();
    const { categories } = useCategories();
    const [uiState, dispatch] = useReducer(uiReducer, initialUIState);
    const { categoryDialogOpen, groupDialogOpen } = uiState;


    const handleGroupFilterChange = (event, newGroup) => {
        if (newGroup !== null) {
            setShortcutGroupFilter(newGroup);
        }
    };

    const handleCategoryFilterChange = (event, newCategory) => {
        if (newCategory !== null) {
            setShortcutCategoryFilter(newCategory);
        }
    };

    // カテゴリーに対するフィルターの適用
    const filterdCategories = shortcutGroupFilter
        ? categories.filter((category) => category.group_name === shortcutGroupFilter)
        : categories

    // アクティビティに対するフィルターの適用
    const groupFilteredActivities = shortcutGroupFilter
        ? activities.filter((act) => act.category_group === shortcutGroupFilter)
        : activities;
    const filteredActivities = shortcutCategoryFilter
        ? groupFilteredActivities.filter((act) => act.category_name === shortcutCategoryFilter)
        : groupFilteredActivities


    // 最近使用した項目を取得
    const recentActivities = filteredActivities.slice(0, 5);
    const remainingActivities = filteredActivities.slice(5);

    const handleAutocompleteChange = (event, newValue) => {
        if (newValue) {
            onStart(newValue);
            setShowAutocomplete(false);
        }
    };

    return (
        <>
            <Box sx={{ mb: 3 }}>
                <Box>
                    <ToggleButtonGroup
                        value={shortcutGroupFilter}
                        exclusive
                        size='small'
                        onChange={handleGroupFilterChange}
                        aria-label="Group filter"
                        sx={{ mb: 2, mr: 2 }}
                    >
                        <ToggleButton value="" aria-label="すべて">
                            すべて
                        </ToggleButton>
                        {groups.map((group) => (
                            <ToggleButton key={group.id} value={group.name} aria-label={group.name}>
                                {getIconForGroup(group.name, groups)}
                                {group.name}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Button variant="contained" onClick={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: true })}>
                        グループの管理
                    </Button>
                </Box>
                <Box>
                    <GroupManagementDialog open={groupDialogOpen} onClose={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: false })} />
                    <ToggleButtonGroup
                        value={shortcutCategoryFilter}
                        exclusive
                        size='small'
                        onChange={handleCategoryFilterChange}
                        aria-label="Group filter"
                        sx={{ mb: 2, mr: 2 }}
                    >
                        <ToggleButton value="" aria-label="すべて">
                            すべて
                        </ToggleButton>
                        {filterdCategories.map((category) => (
                            <ToggleButton key={category.id} value={category.name} aria-label={category.name}>
                                {category.name}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <Button variant="contained" onClick={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: true })}>
                        カテゴリの管理
                    </Button>
                </Box>
                <Box>
                    <CategoryManagementDialog open={categoryDialogOpen} onClose={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: false })} />
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
                                startIcon={getIconForGroup(activity.category_group, groups)}
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
                                        {getIconForGroup(option.category_group, groups)}
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
                    </Box>
                </Box>
            </Box>
        </>
    );
}

export default ActivityStart;