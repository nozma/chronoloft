import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { updateRecord, deleteRecord, fetchActivityGroups } from '../services/api';
import ConfirmDialog from './ConfirmDialog';
import { Box, Button, Collapse, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RecordFilter from './RecordFilter';
import RecordHeatmap from './RecordHeatmap';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import AddRecordDialog from './AddRecordDialog';
import { formatToLocal } from '../utils/dateUtils';
import useRecordListState from '../hooks/useRecordListState';

function RecordList({ records, categories, onRecordUpdate }) {
    // ----------------------------
    // 状態管理
    // ----------------------------
    const { activeActivity } = useActiveActivity();
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [error, setError] = useState(null);
    // useRecordListState で一元管理する
    const { state, dispatch } = useRecordListState();
    const { filterCriteria, confirmDialogOpen, selectedRecordId, showRecords } = state;
    const [recordToEdit, setRecordToEdit] = useState(null);
    
    // ----------------------------
    // Ref の宣言
    // ----------------------------
    const dataGridRef = useRef(null);
    const containerRef = useRef(null);

    // ----------------------------
    // 副作用（useEffect）
    // ----------------------------
    // groups を API から取得する
    const [groups, setGroups] = useState([]);
    useEffect(() => {
        fetchActivityGroups()
            .then(data => setGroups(data))
            .catch(err => {
                console.error("Failed to fetch groups:", err);
                setError("グループの取得に失敗しました。");
            });
    }, []);

    // filterCriteria に応じて records をフィルタリングする
    useEffect(() => {
        const { group, category, activityName } = filterCriteria;
        let filtered = records.filter((record) => {
            const groupMatch = group ? record.activity_group === group : true;
            const categoryMatch = category ? String(record.activity_category_id) === category : true;
            const nameMatch = activityName
                ? record.activity_name.toLowerCase() === activityName.toLowerCase()
                : true;
            return groupMatch && categoryMatch && nameMatch;
        });
        setFilteredRecords(filtered);
    }, [filterCriteria, records, activeActivity]);

    // ----------------------------
    // イベントハンドラ
    // ----------------------------
    // 削除確認ダイアログ用
    const handleDeleteRecordClick = (recordId) => {
        dispatch({ type: 'SET_SELECTED_RECORD_ID', payload: recordId });
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: true });
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteRecord(selectedRecordId);
            onRecordUpdate();
        } catch (err) {
            console.error("Failed to delete record:", err);
        }
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        dispatch({ type: 'SET_SELECTED_RECORD_ID', payload: null });
    };

    const handleCancelDelete = () => {
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        dispatch({ type: 'SET_SELECTED_RECORD_ID', payload: null });
    };

    const handleEditRecordClick = (record) => {
        setRecordToEdit(record);
    };

    const handleEditRecordSubmit = async (updatedData) => {
        try {
            await updateRecord(recordToEdit.id, updatedData);
            onRecordUpdate();
            setRecordToEdit(null);
        } catch (error) {
            console.error("Failed to update record:", error);
        }
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

    const handleFilterChange = useCallback((newCriteria) => {
        dispatch({ type: 'SET_FILTER_CRITERIA', payload: newCriteria });
    }, [dispatch]);

    // ----------------------------
    // DataGrid の列定義
    // ----------------------------
    const columns = [
        {
            field: 'created_at',
            headerName: '記録日時',
            width: 200,
            valueFormatter: (params) => formatToLocal(params)
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
                const val = params.row.value;
                const unit = params.row.unit;
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
            width: 240,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <>
                    <IconButton onClick={() => handleEditRecordClick(params.row)}>
                        <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteRecordClick(params.row.id)}>
                        <DeleteIcon />
                    </IconButton>
                </>
            )
        }
    ];

    // ----------------------------
    // レンダリング部
    // ----------------------------
    return (
        <Box ref={containerRef} sx={{ mb: 2 }}>
            {error && <div>Error: {error}</div>}
            <div style={{ width: '100%' }}>
                <RecordFilter
                    groups={groups}
                    categories={categories}
                    onFilterChange={handleFilterChange}
                    records={records}
                />
                <RecordHeatmap
                    records={filteredRecords}
                    groups={groups}
                    categories={categories}
                    unitFilter={filterCriteria.unit}
                />
                {showRecords ? (
                    <Button variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_RECORDS', payload: false })} sx={{ mb: 2 }}>
                        閉じる
                    </Button>
                ) : (
                    <Button variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_RECORDS', payload: true })} sx={{ mb: 2 }}>
                        すべてのレコードを表示
                    </Button>
                )}
                <Collapse
                    in={showRecords}
                    timeout={{ enter: 0, exit: 200 }}
                    onEntered={() => {
                        if (dataGridRef.current) {
                            dataGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                    }}
                >
                    <Box ref={dataGridRef} sx={{ height: 400, width: '100%', mb: 2 }}>
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
                    </Box>
                </Collapse>
            </div>
            <ConfirmDialog
                open={confirmDialogOpen}
                title="Confirm Deletion"
                content="Are you sure you want to delete this record?"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
            {/* 編集用ダイアログ */}
            {recordToEdit && (
                <AddRecordDialog
                    open={true}
                    onClose={() => setRecordToEdit(null)}
                    onSubmit={handleEditRecordSubmit}
                    activity={recordToEdit}  // recordToEdit自体を渡す
                    initialValue={recordToEdit.value}
                    // 追加：編集用の場合、登録日時（created_at）の編集フィールドを表示するため、初期値として recordToEdit.created_at を渡す
                    initialDate={recordToEdit.created_at}
                    // ここで isEdit フラグを渡すなど、ダイアログ側で編集モードと判断できるようにする
                    isEdit={true}
                />
            )}
        </Box>
    );
}

export default RecordList;