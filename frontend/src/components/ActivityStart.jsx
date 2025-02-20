import React, { useState } from 'react';
import { Autocomplete, TextField, Button, Box } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const allGroups = useGroups();
    const recentActivities = activities.slice(0, 7);

    return (
        <>
            <Box sx={{ mb: 3 }}>
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
                            startIcon={getIconForGroup(activity.category_group, allGroups)}
                        >
                            {activity.name}
                        </Button>
                    ))}
                </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Autocomplete
                    options={activities}
                    getOptionLabel={(option) => option.name}
                    renderOption={(props, option) => {
                        const { key, ...rest } = props;
                        return (
                            <li key={key} {...rest}>
                                {getIconForGroup(option.category_group, allGroups)}
                                {option.name}
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="すべてのアクティビティから選択"
                            variant="outlined"
                            slotProps={{
                                input: {
                                    ...params.InputProps,
                                    startAdornment: (
                                        <>
                                            {selectedActivity ? getIconForGroup(selectedActivity.category_group, allGroups) : null}
                                            {params.InputProps.startAdornment}
                                        </>
                                    ),
                                }
                            }}
                        />
                    )}
                    onChange={(event, value) => setSelectedActivity(value)}
                    sx={{ width: 300 }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => onStart(selectedActivity)}
                    disabled={!selectedActivity}
                >
                    Start
                </Button>
            </Box>
        </>
    );
}

export default ActivityStart;