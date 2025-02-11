import React, { useEffect, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { fetchRecords, updateRecord, deleteRecord, fetchCategories } from '../services/api';
import ConfirmDialog from './ConfirmDialog';
import Button from '@mui/material/Button';
import RecordFilter from './RecordFilter';


function RecordList({ records, categories, onRecordUpdate }) {
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [error, setError] = useState(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [filterCriteria, setFilterCriteria] = useState({
        group: '',
        category: '',
        activityName: '',
    });
    const groups = ['study', 'game', 'workout'];

    useEffect(() => {
        const { group, category, activityName } = filterCriteria;
        const filtered = records.filter((record) => {
          const groupMatch = group ? record.activity_group === group : true;
          // もしバックエンドが activity_category_id を返していない場合は、activity_category だけで判定する
          const categoryMatch = category ? record.activity_category_id === category : true;
          const nameMatch = activityName
            ? record.activity_name && record.activity_name.toLowerCase().includes(activityName.toLowerCase())
            : true;
          return groupMatch && categoryMatch && nameMatch;
        });
        setFilteredRecords(filtered);
      }, [filterCriteria, records]);


    // 削除確認用のハンドラー
    const handleDeleteRecordClick = (recordId) => {
        setSelectedRecordId(recordId);
        setConfirmDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteRecord(selectedRecordId);
            onRecordUpdate();
        } catch (err) {
            console.error("Failed to delete record:", err);
        }
        setConfirmDialogOpen(false);
        setSelectedRecordId(null);
    };

    const handleCancelDelete = () => {
        setConfirmDialogOpen(false);
        setSelectedRecordId(null);
    };

    const processRowUpdate = async (newRow, oldRow) => {
        try {
            await updateRecord(newRow.id, newRow);
            return newRow;
        } catch (error) {
            console.error("Failed to update record:", error);
            throw error;
        }
    };

    const columns = [
        { field: 'id', headerName: 'ID', width: 70 },
        {
            field: 'created_at',
            headerName: '記録日',
            width: 200,
            valueFormatter: (params) => {
                // params.value は ISO 8601 形式の文字列として受け取る前提
                const date = new Date(params);
                const year = date.getFullYear();
                const month = ("0" + (date.getMonth() + 1)).slice(-2);
                const day = ("0" + date.getDate()).slice(-2);
                return `${year}年${month}月${day}日`;
            }
        },
        {
            field: 'activity_category',
            headerName: 'カテゴリ',
            width: 150,
        },
        {
            field: 'activity_name',
            headerName: '項目名',
            width: 150,
        },
        {
            field: 'value',
            headerName: '記録',
            width: 150,
            editable: true,
            renderCell: (params) => {
                const val = params.row.value; // 数値（例: 10, 75など）
                const unit = params.row.unit; // "count" または "minutes"
                if (unit === 'count') {
                    return `${val}回`;
                } else if (unit === 'minutes') {
                    const hours = Math.floor(val / 60);
                    const minutes = Math.floor(val % 60);
                    return `${hours}時間${minutes}分`;
                }
                return val;
            },
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 120,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => handleDeleteRecordClick(params.row.id)}
                >
                    Delete
                </Button>
            )
        }
    ];

    return (
        <div>
            {error && <div>Error: {error}</div>}
            <div style={{ height: 400, width: '100%' }}>
                <RecordFilter
                    groups={groups}
                    categories={categories}
                    onFilterChange={setFilterCriteria}
                />
                <DataGrid
                    rows={filteredRecords}
                    columns={columns}
                    pageSize={5}
                    rowsPerPageOptions={[5]}
                    disableSelectionOnClick
                    processRowUpdate={processRowUpdate}
                    initialState={{
                        sorting: {
                            sortModel: [{ field: 'created_at', sort: 'desc' }],
                        },
                    }}
                />
            </div>
            <ConfirmDialog
                open={confirmDialogOpen}
                title="Confirm Deletion"
                content="Are you sure you want to delete this record?"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
}

export default RecordList;