import React, { useEffect, useMemo } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import { Box } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useFilter } from '../contexts/FilterContext';
import { useActivities } from '../contexts/ActivityContext';

function RecordFilter({ onFilterChange, records }) {
    const { activities } = useActivities();
    const { filterState, setFilterState } = useFilter();
    const { groupFilter, tagFilter, activityNameFilter } = filterState;

    // グループ選択に応じた項目の選択肢
    const filteredActivityNames = useMemo(() => {
        let recs = records;
        if (groupFilter) {
            // グループが選択されている場合は、そのグループに属するレコードを抽出
            recs = records.filter(rec => String(rec.activity_group) === groupFilter);
        }
        if (tagFilter) {
            recs = recs.filter(rec => {
                if (!rec.tags || rec.tags.length === 0) return false;
                return rec.tags.some(t => t.name === tagFilter);
            });
        }

        // records からユニークな activity_name を抽出
        let names = Array.from(new Set(recs.map(rec => rec.activity_name)));
        // 現在の activityNameFilter が空でなく、リストに含まれていなければ追加する
        if (activityNameFilter && !names.includes(activityNameFilter)) {
            names.push(activityNameFilter);
        }
        // activityの使用順でソートする
        const ordered = activities
            .map(act => act.name)
            .filter(name => names.includes(name));
        const others = names.filter(name => !ordered.includes(name));
        return [...ordered, ...others];
    }, [records, groupFilter, tagFilter, activityNameFilter, useActivities()]);

    // フィルター状態の変更を onFilterChange に通知
    useEffect(() => {
        onFilterChange(filterState);
    }, [filterState, onFilterChange]);

    // リセットボタン用のハンドラー
    const handleReset = () => {
        setFilterState(prev => ({
            ...prev,
            activityNameFilter: ``,
        }));
    };

    return (
        <Box sx={{ mt: 1 }}>
            <TextField
                label="Activity"
                select
                variant='outlined'
                size='small'
                color='primary'
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
            {activityNameFilter != `` && (
                <IconButton onClick={handleReset}>
                    <ClearIcon />
                </IconButton>
            )}
        </Box>
    );
}

export default RecordFilter;