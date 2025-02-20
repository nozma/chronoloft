import React, { useState } from 'react';
import {
    Autocomplete,
    Button,
    Box,
    TextField,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [shortcutGroupFilter, setShortcutGroupFilter] = useState('');
    const groups = useGroups();

    const handleGroupFilterChange = (event, newGroup) => {
        // null にならないようにチェック
        if (newGroup !== null) {
            setShortcutGroupFilter(newGroup);
        }
    };

    // グループフィルターが設定されていれば、そのグループに属するアクティビティのみ抽出
    const filteredActivities = shortcutGroupFilter
        ? activities.filter((act) => act.category_group === shortcutGroupFilter)
        : activities;

    // 最近使用した項目を取得
    const recentActivities = filteredActivities.slice(0, 7);
    const remainingActivities = filteredActivities.slice(7);

    const handleAutocompleteChange = (event, newValue) => {
        if (newValue) {
            onStart(newValue);
            setShowAutocomplete(false);
        }
    };

    return (
        <>
            <Box sx={{ mb: 3 }}>
                <ToggleButtonGroup
                    value={shortcutGroupFilter}
                    exclusive
                    size='small'
                    onChange={handleGroupFilterChange}
                    aria-label="Group filter"
                    sx={{ mb: 2 }}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
 
            </Box>
        </>
    );
}

export default ActivityStart;