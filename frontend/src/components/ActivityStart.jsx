import React, { useState } from 'react';
import { Autocomplete, TextField, Button, Box } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const allGroups = useGroups();

    return (
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
                        label="アクティビティを選択"
                        variant="outlined"
                        slotProps={{
                            input:{
                            ...params.InputProps,
                            startAdornment: (
                                <>
                                    {selectedActivity ? getIconForGroup(selectedActivity.category_group, allGroups) : null}
                                    {params.InputProps.startAdornment}
                                </>
                            ),
                        }}}
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
    );
}

export default ActivityStart;