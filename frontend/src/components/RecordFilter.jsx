import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';

function RecordFilter({ groups, categories, onFilterChange, records }) {
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedActivityName, setSelectedActivityName] = useState('');

    // グループ選択に応じたカテゴリの選択肢
    const filteredCategories = selectedGroup
        ? categories.filter(cat => {
            return cat.group_name === selectedGroup;
        })
        : categories;


    // カテゴリ選択に応じた項目の選択肢
    const filteredActivityNames = React.useMemo(() => {
        let recs;
        if (selectedCategory) {
            // カテゴリが選択されている場合は、そのカテゴリに属するレコードを抽出
            recs = records.filter(rec => rec.activity_category_id === selectedCategory);
        } else if (selectedGroup) {
            // **変更箇所: カテゴリが未選択でも、グループが選択されている場合は、
            // categories から selectedGroup に属するカテゴリのIDリストを作成し、
            // そのIDに含まれるレコードを抽出する**
            const groupCategoryIds = categories
                .filter(cat => cat.group_name === selectedGroup)
                .map(cat => cat.id);
            recs = records.filter(rec => groupCategoryIds.includes(rec.activity_category_id));
        } else {
            // どちらも未選択なら全レコードを利用
            recs = records;
        }
        return Array.from(new Set(recs.map(rec => rec.activity_name)));
    }, [records, selectedCategory, selectedGroup, categories]);

    useEffect(() => {
        onFilterChange({
            group: selectedGroup,
            category: selectedCategory,
            activityName: selectedActivityName,
        });
    }, [selectedGroup, selectedCategory, selectedActivityName, onFilterChange]);


    return (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '16px' }}>
            <TextField
                label="グループ"
                select
                value={selectedGroup}
                onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    // グループ変更時、カテゴリと項目名はリセットする
                    setSelectedCategory('');
                    setSelectedActivityName('');
                }}
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
                onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    // カテゴリ変更時、項目名はリセットする
                    setSelectedActivityName('');
                }}
                style={{ minWidth: 180 }}
            >
                <MenuItem value="">All</MenuItem>
                {filteredCategories.map((cat) => (
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
                {filteredActivityNames.map((name, idx) => (
                    <MenuItem key={idx} value={name}>
                        {name}
                    </MenuItem>
                ))}
            </TextField>
        </div>
    );
}

export default RecordFilter;