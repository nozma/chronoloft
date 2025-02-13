import React, { useState, useEffect } from 'react';
import { TextField, MenuItem, Button, Box } from '@mui/material';
import { fetchActivityGroups } from '../services/api';

function RecordFilter({ categories, onFilterChange }) {
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [activityName, setActivityName] = useState('');
    const [unit, setUnit] = useState('');

    useEffect(() => {
        fetchActivityGroups()
            .then(data => setGroups(data))
            .catch(err => console.error(err));
    }, []);

    const handleFilter = () => {
        onFilterChange({
            unit,            // "count" または "minutes"
            group: selectedGroup,
            category: selectedCategory,
            activityName,
        });
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TextField
                label="グループ"
                select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                sx={{ minWidth: 120 }}
            >
                <MenuItem value="">All</MenuItem>
                {groups.map((g) => (
                    <MenuItem key={g.id} value={g.name}>
                        {g.name}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="カテゴリ"
                select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                sx={{ minWidth: 120 }}
            >
                <MenuItem value="">All</MenuItem>
                {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="記録単位"
                select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                sx={{ minWidth: 120 }}
            >
                <MenuItem value="">全て</MenuItem>
                <MenuItem value="count">回</MenuItem>
                <MenuItem value="minutes">分</MenuItem>
            </TextField>
            <TextField
                label="項目名"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                sx={{ minWidth: 150 }}
            />
            <Button variant="contained" color="primary" onClick={handleFilter}>
                Filter
            </Button>
        </Box>
    );
}

export default RecordFilter;