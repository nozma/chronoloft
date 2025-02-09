import React, { useEffect, useState } from 'react';
import { fetchActivities } from '../services/api';
import { DataGrid } from '@mui/x-data-grid';

function ActivityList() {
    const [activities, setActivities] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchActivities()
            .then(data => setActivities(data))
            .catch(err => setError(err.message));
    }, []);

    if (error) {
        return <div>Error: {error}</div>;
    }

    const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'category_group',
            headerName: 'グループ',
            width: 150,
            valueFormatter: (params) => {
                if (params === 'study') return "勉強";
                else if (params === 'game') return "ゲーム";
                else if (params === 'workout') return "運動";
                else return params;
            }
        },
        { field: 'category_name', headerName: 'カテゴリ', width: 150 },
        { field: 'name', headerName: '項目名', width: 150 },
        {
            field: 'unit',
            headerName: '記録単位',
            width: 100,
            valueFormatter: (params) => {
                if (params === 'minutes') return "分";
                else if (params === 'count') return "回";
                else return params;
            }
        },
        { field: 'asset_key', headerName: 'Asset Key', width: 150 },
        {
            field: 'created_at',
            headerName: '登録日',
            width: 200,
            valueFormatter: (params) => {
                const date = new Date(params);
                const year = date.getFullYear();
                const month = ("0" + (date.getMonth() + 1)).slice(-2);
                const day = ("0" + date.getDate()).slice(-2);
                return `${year}年${month}月${day}日`;
            }
        }
    ];

    return (
        <div style={{ height: 400, width: '100%' }}>
            <DataGrid
                rows={activities}
                columns={columns}
                pageSize={5}
                rowsPerPageOptions={[5]}
                disableSelectionOnClick
            />
        </div>
    );
}

export default ActivityList;