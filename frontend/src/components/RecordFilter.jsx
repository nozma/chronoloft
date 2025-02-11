// frontend/src/components/RecordFilter.jsx
import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { fetchActivityGroups } from '../services/api';

function RecordFilter({ categories, onFilterChange }) {
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [activityName, setActivityName] = useState('');

    useEffect(() => {
        fetchActivityGroups()
            .then(data => setGroups(data))
            .catch(err => console.error(err));
    }, []);

    const handleFilter = () => {
        onFilterChange({
            group: selectedGroup,
            category: selectedCategory,
            activityName,
        });
    };

    return (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '16px' }}>
            <TextField
                label="グループ"
                select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{ minWidth: 120 }}
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
                style={{ minWidth: 120 }}
            >
                <MenuItem value="">All</MenuItem>
                {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="項目名"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                style={{ minWidth: 150 }}
            />
            <Button variant="contained" color="primary" onClick={handleFilter}>
                Filter
            </Button>
        </div>
    );
}

export default RecordFilter;