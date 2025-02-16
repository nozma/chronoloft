// frontend/src/components/RecordFilter.jsx
import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';

function RecordFilter({ groups, categories, onFilterChange, records }) {
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedActivityName, setSelectedActivityName] = useState('');
    const [activityNames, setActivityNames] = useState([]);

    // records prop から activityNames を自動計算**
    useEffect(() => {
        if (records && records.length > 0) {
            const names = Array.from(new Set(records.map(rec => rec.activity_name)));
            setActivityNames(names);
        } else {
            setActivityNames([]);
        }
    }, [records]);


    const handleFilter = () => {
        onFilterChange({
            group: selectedGroup,
            category: selectedCategory,
            activityName: selectedActivityName,
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
                style={{ minWidth: 180 }}
            >
                <MenuItem value="">All</MenuItem>
                {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="アクティビティ"
                select
                value={selectedActivityName}
                onChange={(e) => setSelectedActivityName(e.target.value)}
                style={{ minWidth: 180 }}
            >
                <MenuItem value="">All</MenuItem>
                {activityNames.map((name, idx) => (
                    <MenuItem key={idx} value={name}>
                        {name}
                    </MenuItem>
                ))}
            </TextField>
            <Button variant="contained" color="primary" onClick={handleFilter}>
                Filter
            </Button>
        </div>
    );
}

export default RecordFilter;