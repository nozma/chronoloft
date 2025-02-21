import React, { useEffect, useMemo } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import { useFilter } from '../contexts/FilterContext';
import getIconForGroup from '../utils/getIconForGroup';

function RecordFilter({ groups, categories, onFilterChange, records }) {
  const { filterState, setFilterState } = useFilter();
  const { groupFilter, categoryFilter, activityNameFilter } = filterState;

  // グループ選択に応じたカテゴリの選択肢
  const filteredCategories = groupFilter
    ? categories.filter(cat => cat.group_name === groupFilter)
    : categories;

  // カテゴリ選択に応じた項目の選択肢
  const filteredActivityNames = useMemo(() => {
    let recs;
    if (categoryFilter) {
      // カテゴリが選択されている場合は、そのカテゴリに属するレコードを抽出
      recs = records.filter(rec => String(rec.activity_category_id) === categoryFilter);
    } else if (groupFilter) {
      // グループが選択されている場合は、
      // categories から selectedGroup に属するカテゴリのIDリストを作成し、
      // そのIDに含まれるレコードを抽出する
      const groupCategoryIds = categories
        .filter(cat => cat.group_name === groupFilter)
        .map(cat => String(cat.id));
      recs = records.filter(rec => groupCategoryIds.includes(String(rec.activity_category_id)));
    } else {
      recs = records;
    }
    // records からユニークな activity_name を抽出
    let names = Array.from(new Set(recs.map(rec => rec.activity_name)));
    // 現在の activityNameFilter が空でなく、リストに含まれていなければ追加する
    if (activityNameFilter && !names.includes(activityNameFilter)) {
      names.push(activityNameFilter);
    }
    return names;
  }, [records, categoryFilter, groupFilter, categories, activityNameFilter]);

  // フィルター状態の変更を onFilterChange に通知
  useEffect(() => {
    onFilterChange(filterState);
  }, [filterState, onFilterChange]);

  // activityNameFilter の変更時に、対応するカテゴリとグループを自動セット
  useEffect(() => {
    if (activityNameFilter) {
      const rec = records.find(r => r.activity_name === activityNameFilter);
      if (rec) {
        if (String(rec.activity_category_id) !== categoryFilter) {
          setFilterState(prev => ({ ...prev, categoryFilter: String(rec.activity_category_id) }));
        }
        if (rec.activity_group !== groupFilter) {
          setFilterState(prev => ({ ...prev, groupFilter: rec.activity_group }));
        }
      }
    }
  }, [activityNameFilter, records, categoryFilter, groupFilter, setFilterState]);

  // リセットボタン用のハンドラー
  const handleReset = () => {
    setFilterState({
      groupFilter: ``,
      categoryFilter: ``,
      activityNameFilter: ``,
    });
  };

  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '16px' }}>
      <TextField
        label="グループ"
        select
        size='small'
        value={groupFilter || ``}
        onChange={(e) => {
          setFilterState({
            groupFilter: e.target.value || ``,
            categoryFilter: ``,
            activityNameFilter: ``,
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
        size='small'
        value={categoryFilter || ``}
        onChange={(e) => {
          const newCatId = e.target.value;
          setFilterState(prev => ({ ...prev, categoryFilter: newCatId, activityNameFilter: `` }));
          const cat = categories.find(cat => String(cat.id) === newCatId);
          if (cat && cat.group_name) {
            setFilterState(prev => ({ ...prev, groupFilter: cat.group_name }));
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
        size='small'
        value={activityNameFilter}
        onChange={(e) => {
          setFilterState(prev => ({ ...prev, activityNameFilter: e.target.value }));
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