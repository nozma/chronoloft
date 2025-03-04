import React, { useState, useRef } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { updateRecord, deleteRecord } from '../services/api';
import ConfirmDialog from './ConfirmDialog';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import RecordHeatmap from './RecordHeatmap';
import AddRecordDialog from './AddRecordDialog';
import { formatToLocal } from '../utils/dateUtils';
import useRecordListState from '../hooks/useRecordListState';
import RecordCalendar from './RecordCalendar';
import { useGroups } from '../contexts/GroupContext';
import { useUI } from '../contexts/UIContext';

function RecordList({ records, onRecordUpdate }) {
    // ----------------------------
    // 状態管理
    // ----------------------------
    const [error] = useState(null);
    // useRecordListState で一元管理する
    const { state, dispatch } = useRecordListState();
    const { filterCriteria, confirmDialogOpen, selectedRecordId, showRecords } = state;
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { groups } = useGroups();
    const { state: uiState, dispatch: uiDispatch } = useUI();

    // ----------------------------
    // Ref の宣言
    // ----------------------------
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
            field: 'group_name',
            headerName: 'グループ',
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
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                    <Typography
                        variant='caption'
                        color='#ccc'
                        onClick={() =>
                            uiDispatch({
                                type: 'UPDATE_UI',
                                payload: {
                                    recordsOpen: true,
                                    heatmapOpen: true,
                                    calendarOpen: true,
                                }
                            })
                        }
                        sx={{cursor: 'pointer'}}
                    >
                        Open All
                    </Typography>
                    <Typography
                        variant='caption'
                        color='#ccc'
                        onClick={() =>
                            uiDispatch({
                                type: 'UPDATE_UI',
                                payload: {
                                    recordsOpen: false,
                                    heatmapOpen: false,
                                    calendarOpen: false,
                                }
                            })
                        }
                        sx={{cursor: 'pointer'}}
                    >
                        Close All
                    </Typography>
                </Box>
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
                    <Box ref={dataGridRef} sx={{ height: 800, m: 2 }}>
                        <DataGrid
                            rows={records}
                            columns={columns}
                            pageSize={5}
                            rowsPerPageOptions={[5]}
                            disableSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            rowHeight={38}
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
                    activity={recordToEdit}
                    initialValue={recordToEdit.value}
                    initialDate={recordToEdit.created_at}
                    isEdit={true}
                />
            )}
        </Box>
    );
}

export default RecordList;