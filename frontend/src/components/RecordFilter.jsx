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
            recs = records.filter(rec => String(rec.activity_category_id) === selectedCategory);
        } else if (selectedGroup) {
            // グループが選択されている場合は、
            // categories から selectedGroup に属するカテゴリのIDリストを作成し、
            // そのIDに含まれるレコードを抽出する
            const groupCategoryIds = categories
                .filter(cat => cat.group_name === selectedGroup)
                .map(cat => String(cat.id));
            recs = records.filter(rec => groupCategoryIds.includes(String(rec.activity_category_id)));
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

    // selectedActivityName の変更時に、対応するカテゴリとグループを自動セット
    useEffect(() => {
        if (selectedActivityName) {
            const rec = records.find(r => r.activity_name === selectedActivityName);
            if (rec) {
                // 更新が必要な場合のみ実施
                if (String(rec.activity_category_id) !== selectedCategory) {
                    setSelectedCategory(String(rec.activity_category_id));
                }
                if (rec.activity_group !== selectedGroup) {
                    setSelectedGroup(rec.activity_group);
                }
            }
        }
    }, [selectedActivityName, records]);


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
                    const newCatId = e.target.value;
                    setSelectedCategory(newCatId);
                    // カテゴリ変更時、アクティビティはリセット
                    setSelectedActivityName('');
                    // ★ 自動更新: 選択したカテゴリに対応するグループを自動セット
                    const cat = categories.find(cat => String(cat.id) === newCatId);
                    if (cat && cat.group_name) {
                        setSelectedGroup(cat.group_name);
                    }
                }}
                sx={{ minWidth: 180 }}
            >
                <MenuItem value="">All</MenuItem>
                {filteredCategories.map((cat) => (
                    <MenuItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                    </MenuItem>
                ))}
            </TextField>
            <TextField
                label="アクティビティ"
                select
                value={selectedActivityName}
                onChange={(e) => {setSelectedActivityName(e.target.value);}}
                sx={{ minWidth: 180 }}
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