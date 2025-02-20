import React, { useEffect, useMemo } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useFilter } from '../contexts/FilterContext';
import getIconForGroup from '../utils/getIconForGroup';

function RecordFilter({ groups, categories, onFilterChange, records }) {
  const { filterState, setFilterState } = useFilter();
  const { group, category, activityName } = filterState;

  // グループ選択に応じたカテゴリの選択肢
  const filteredCategories = group
    ? categories.filter(cat => cat.group_name === group)
    : categories;

  // カテゴリ選択に応じた項目の選択肢
  const filteredActivityNames = useMemo(() => {
    let recs;
    if (category) {
      // カテゴリが選択されている場合は、そのカテゴリに属するレコードを抽出
      recs = records.filter(rec => String(rec.activity_category_id) === category);
    } else if (group) {
      // グループが選択されている場合は、
      // categories から selectedGroup に属するカテゴリのIDリストを作成し、
      // そのIDに含まれるレコードを抽出する
      const groupCategoryIds = categories
        .filter(cat => cat.group_name === group)
        .map(cat => String(cat.id));
      recs = records.filter(rec => groupCategoryIds.includes(String(rec.activity_category_id)));
    } else {
      recs = records;
    }
    // records からユニークな activity_name を抽出
    let names = Array.from(new Set(recs.map(rec => rec.activity_name)));
    // 現在の activityName が空でなく、リストに含まれていなければ追加する
    if (activityName && !names.includes(activityName)) {
      names.push(activityName);
    }
    return names;
  }, [records, category, group, categories, activityName]);

  // フィルター状態の変更を onFilterChange に通知
  useEffect(() => {
    onFilterChange(filterState);
  }, [filterState, onFilterChange]);

  // activityName の変更時に、対応するカテゴリとグループを自動セット
  useEffect(() => {
    if (activityName) {
      const rec = records.find(r => r.activity_name === activityName);
      if (rec) {
        if (String(rec.activity_category_id) !== category) {
          setFilterState(prev => ({ ...prev, category: String(rec.activity_category_id) }));
        }
        if (rec.activity_group !== group) {
          setFilterState(prev => ({ ...prev, group: rec.activity_group }));
        }
      }
    }
  }, [activityName, records, category, group, setFilterState]);

  // リセットボタン用のハンドラー
  const handleReset = () => {
    setFilterState({
      group: '',
      category: '',
      activityName: '',
    });
  };

  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '16px' }}>
      <TextField
        label="グループ"
        select
        value={group}
        onChange={(e) => {
          setFilterState({
            group: e.target.value,
            category: '',
            activityName: '',
          });
        }}
        style={{ minWidth: 120 }}
      >
        <MenuItem value="">All</MenuItem>
        {groups.map((g) => (
          <MenuItem key={g.id} value={g.name}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {getIconForGroup(g.name, groups)}
              {g.name}
            </span>
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="カテゴリ"
        select
        value={category}
        onChange={(e) => {
          const newCatId = e.target.value;
          setFilterState(prev => ({ ...prev, category: newCatId, activityName: '' }));
          const cat = categories.find(cat => String(cat.id) === newCatId);
          if (cat && cat.group_name) {
            setFilterState(prev => ({ ...prev, group: cat.group_name }));
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
        value={activityName}
        onChange={(e) => {
          setFilterState(prev => ({ ...prev, activityName: e.target.value }));
        }}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">All</MenuItem>
        {filteredActivityNames.map((name, idx) => (
          <MenuItem key={idx} value={name}>
            {name}
          </MenuItem>
        ))}
      </TextField>
      <Button variant="outlined" color="secondary" onClick={handleReset}>
        Reset
      </Button>
    </div>
  );
}

export default RecordFilter;