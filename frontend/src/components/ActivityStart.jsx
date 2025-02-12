import React, { useState } from 'react';
import { Autocomplete, TextField, Button, Box } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Autocomplete
                options={activities}
                getOptionLabel={(option) => option.name}
                renderOption={(props, option) => (
                    <li {...props}>
                        {getIconForGroup(option.category_group)}
                        {option.name}
                    </li>
                )}
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
                                    {selectedActivity ? getIconForGroup(selectedActivity.category_group) : null}
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