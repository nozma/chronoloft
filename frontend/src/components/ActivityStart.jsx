import React, { useState } from 'react';
import { Autocomplete, TextField, Button, Box } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import HomeWorkIcon from '@mui/icons-material/HomeWork';

function ActivityStart({ activities, onStart }) {
    const [selectedActivity, setSelectedActivity] = useState(null);

    // グループに応じたアイコンを設定
    const getGroupIcon = (groupName) => {
        switch (groupName) {
            case 'study':
                return <MenuBookIcon sx={{ mr: 1, color: 'skyblue' }} />;
            case 'game':
                return <SportsEsportsIcon sx={{ mr: 1, color: '#FF5722' }} />;
            case 'workout':
                return <FitnessCenterIcon sx={{ mr: 1, color: 'green' }} />;
            default:
                return <HomeWorkIcon sx={{ mr: 1, color: 'grey' }} />;
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Autocomplete
                options={activities}
                getOptionLabel={(option) => option.name}
                renderOption={(props, option) => (
                    <li {...props}>
                        {getGroupIcon(option.category_group)}
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
                                    {selectedActivity ? getGroupIcon(selectedActivity.category_group) : null}
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