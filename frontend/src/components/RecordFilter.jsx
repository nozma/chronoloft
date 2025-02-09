// frontend/src/components/RecordFilter.jsx
import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';

function RecordFilter({ groups, categories, onFilterChange }) {
  // groups: 例 ['study', 'game', 'workout'] (Activity Group の識別子)
  // categories: 例 [{ id: 1, name: '英語' }, { id: 2, name: '数学' }]
  // onFilterChange: フィルタ条件を渡すコールバック関数
  const [group, setGroup] = useState('');
  const [category, setCategory] = useState('');
  const [activityName, setActivityName] = useState('');

  const handleFilter = () => {
    onFilterChange({
      group,         // 例: 'study'
      category,      // 例: カテゴリのID（文字列か数値）
      activityName,  // 例: 部分一致する文字列
    });
  };

  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '16px' }}>
      <TextField
        label="グループ"
        select
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        style={{ minWidth: 120 }}
      >
        <MenuItem value="">All</MenuItem>
        {groups.map((g) => (
          <MenuItem key={g} value={g}>
            {g === 'study'
              ? '勉強'
              : g === 'game'
              ? 'ゲーム'
              : g === 'workout'
              ? '運動'
              : g}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="カテゴリ"
        select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
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