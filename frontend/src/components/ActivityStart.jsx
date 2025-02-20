import React, { useState, useReducer } from 'react';
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
import CategoryManagementDialog from './CategoryManagementDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useCategories } from '../contexts/CategoryContext';
import { useUI } from '../contexts/UIContext';
import SettingsIcon from '@mui/icons-material/Settings';
import { styled } from '@mui/material/styles';

function ActivityStart({ activities, onStart }) {
    const [shortcutGroupFilter, setShortcutGroupFilter] = useState('');
    const [shortcutCategoryFilter, setShortcutCategoryFilter] = useState('');
    const groups = useGroups();
    const { categories } = useCategories();
    const { state, dispatch } = useUI();

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
                <Typography variant='caption' color='#cccccc'>Group</Typography>
                <Box>
                    <ToggleButtonGroup
                        value={shortcutGroupFilter}
                        exclusive
                        size='medium'
                        onChange={handleGroupFilterChange}
                        aria-label="Group filter"
                        sx={{ mb: 1, mr: 1 }}
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
                    <IconButton
                        onClick={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: true })}
                        sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            '&:hover': { opacity: 1 },
                        }}>
                        <SettingsIcon />
                    </IconButton>
                    <GroupManagementDialog open={state.groupDialogOpen} onClose={() => dispatch({ type: 'SET_GROUP_DIALOG', payload: false })} />
                </Box>
                <Typography variant='caption' color='#cccccc'>Category</Typography>
                <Box>
                    <StyledToggleButtonGroup
                        value={shortcutCategoryFilter}
                        exclusive
                        size='small'
                        onChange={handleCategoryFilterChange}
                        aria-label="Group filter"
                        sx={{ mb: 1, mr: 1 }}
                    >
                        <ToggleButton value="" aria-label="すべて">
                            すべて
                        </ToggleButton>
                        {filterdCategories.map((category) => (
                            <ToggleButton key={category.id} value={category.name} aria-label={category.name}>
                                {category.name}
                            </ToggleButton>
                        ))}
                    </StyledToggleButtonGroup>
                    <IconButton
                        variant="contained" onClick={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: true })}
                        sx={{
                            opacity: 0,
                            transition: 'opacity 0.3s',
                            '&:hover': { opacity: 1 },
                        }}
                    >
                        <SettingsIcon />
                    </IconButton>
                </Box>
                <Typography variant='caption' color='#cccccc'>Activity (Click to start recording)</Typography>
                <Box>
                    <CategoryManagementDialog open={state.categoryDialogOpen} onClose={() => dispatch({ type: 'SET_CATEGORY_DIALOG', payload: false })} />
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
                    </Box>
                </Box>
            </Box>
        </>
    );
}

export default ActivityStart;