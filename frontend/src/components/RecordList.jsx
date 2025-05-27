import React, { useState, useRef } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import ConfirmDialog from './ConfirmDialog'
import { Box, Collapse, IconButton, Typography, TextField } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddRecordDialog from './AddRecordDialog';
import { formatToLocal } from '../utils/dateUtils';
import useRecordListState from '../hooks/useRecordListState';
import { useUI } from '../contexts/UIContext';
import { useRecords } from '../contexts/RecordContext';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useActivities } from '../contexts/ActivityContext';

function RecordList() {
    const [error] = useState(null);
    const { state, dispatch } = useRecordListState();
    const { confirmDialogOpen, selectedRecordId } = state;
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { records, deleteRecord, updateRecord, refreshRecords } = useRecords();
    const { groups } = useGroups();
    const { activities } = useActivities();
    const selectedActivity = recordToEdit
        ? activities.find(a => a.id === recordToEdit.activity_id)
        : null;


    const dataGridRef = useRef(null);
    const containerRef = useRef(null);

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
            refreshRecords();
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
            refreshRecords();
            setRecordToEdit(null);
        } catch (error) {
            console.error("Failed to update record:", error);
        }
    };

    const processRowUpdate = async (newRow, oldRow) => {
        try {
            // 変更が無ければ何もしない
            if (newRow.memo === oldRow.memo) return oldRow;
            // memo だけをパッチ更新
            await updateRecord(newRow.id, { memo: newRow.memo });
            // フロント側の行データは memo だけ差し替えて戻す
            return { ...oldRow, memo: newRow.memo };
        } catch (error) {
            console.error("Failed to update record:", error);
            throw error;
        }
    };

    // ----------------------------
    // DataGrid の列定義
    // ----------------------------
    const columns = [
        {
            field: 'created_at',
            headerName: '記録日時',
            width: 160,
            valueFormatter: (params) => formatToLocal(params)
        },
        {
            field: 'activity_name',
            headerName: '項目名',
            width: 240,
            renderCell: (params) => {
                const groupName = params.row.activity_group;
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getIconForGroup(groupName, groups)}
                        <Typography noWrap variant='body' title={params.value}>
                            {params.value}
                        </Typography>
                    </Box>
                );
            }
        },
        {
            field: 'value',
            headerName: '記録',
            width: 60,
            renderCell: (params) => {
                const val = params.row.value;
                const unit = params.row.unit;
                let val_txt;
                if (unit === 'count') {
                    val_txt = `${val}回`;
                } else if (unit === 'minutes') {
                    const minutes_round = Math.round(val)
                    const hours = Math.floor(minutes_round / 60);
                    const minutes = Math.round(minutes_round % 60);
                    val_txt = `${hours}:${String(minutes).padStart(2, "0")}`;
                }
                return (
                    <Typography noWrap variant='body' title={val_txt}>
                        {val_txt}
                    </Typography>
                );
            },
        },
        {
            field: 'memo',
            headerName: 'memo',
            width: 200,
            editable: true,
            renderCell: (params) => (
                <Typography
                    variant='body2'
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                    {params.value}
                </Typography>
            ),
            renderEditCell: (params) => (
                <TextField
                    multiline
                    minRows={3}
                    fullWidth
                    autoFocus
                    value={params.value || ''}
                    onChange={(e) =>
                        params.api.setEditCellValue(
                            { id: params.id, field: params.field, value: e.target.value },
                            e
                        )
                    }
                />
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 100,
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
                <Typography
                    variant='caption'
                    color='#cccccc'
                    sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                    onClick={() => uiDispatch({ type: 'SET_RECORDS_OPEN', payload: !uiState.recordsOpen })}
                >
                    Records
                    <KeyboardArrowRightIcon
                        fontSize='small'
                        sx={{
                            transition: 'transform 0.15s linear',
                            transform: uiState.recordsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            marginLeft: '4px'
                        }}
                    />
                </Typography>
                <Collapse
                    in={uiState.recordsOpen}
                    timeout={{ enter: 0, exit: 200 }}
                    onEntered={() => {
                        if (dataGridRef.current) {
                            dataGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                    }}
                >
                    <Box ref={dataGridRef} sx={{ height: 600, mb: 2 }}>
                        <DataGrid
                            rows={records}
                            columns={columns}
                            pageSize={5}
                            rowsPerPageOptions={[5]}
                            disableSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            getRowHeight={() => 'auto'}
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
                    activity={selectedActivity}
                    initialValue={recordToEdit.value}
                    initialDate={recordToEdit.created_at}
                    initialMemo={recordToEdit.memo}
                    isEdit={true}
                />
            )}
        </Box>
    );
}

export default RecordList;