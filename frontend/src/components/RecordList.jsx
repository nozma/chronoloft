import { useI18n } from '../i18n/I18nContext';
import { normalizeDetails, pasteDetails } from '../utils/recordDetails';
import React, { useState, useRef, useMemo } from 'react';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
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
import { useFilter } from '../contexts/FilterContext';

function RecordList() {
    const { t, language } = useI18n();
    const [error] = useState(null);
    const { state, dispatch } = useRecordListState();
    const { confirmDialogOpen, selectedRecordId } = state;
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { records, deleteRecord, updateRecord, refreshRecords } = useRecords();
    const { groups, excludedGroupIds } = useGroups();
    const { activities } = useActivities();
    const { filterState } = useFilter();
    const { groupFilter } = filterState;
    const selectedActivity = recordToEdit
        ? activities.find(a => a.id === recordToEdit.activity_id)
        : null;


    const dataGridRef = useRef(null);
    const containerRef = useRef(null);

    const visibleRecords = useMemo(() => {
        return records.filter(record => {
            if (record.activity_group_id === null || record.activity_group_id === undefined) return true;
            if (groupFilter && record.activity_group === groupFilter) return true;
            return !excludedGroupIds.has(Number(record.activity_group_id));
        });
    }, [records, excludedGroupIds, groupFilter]);


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
            headerName: t("Recorded at"),
            width: 160,
            valueFormatter: (params) => formatToLocal(params, undefined, language)
        },
        {
            field: 'activity_name',
            headerName: t("Activity name"),
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
            headerName: t("Record"),
            width: 60,
            renderCell: (params) => {
                const val = params.row.value;
                const unit = params.row.unit;
                let val_txt;
                if (unit === 'count') {
                    val_txt = t("{count} times", { count: val });
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
            headerName: t("Details"),
            width: 200,
            editable: true,
            renderCell: (params) => (
                <Typography
                    variant='body2'
                    noWrap
                    title={normalizeDetails(params.value)}
                >
                    {normalizeDetails(params.value)}
                </Typography>
            ),
            renderEditCell: (params) => (
                <TextField
                    size="small"
                    onPaste={(event) => pasteDetails(event, (value) =>
                        params.api.setEditCellValue({ id: params.id, field: params.field, value }, event)
                    )}
                    fullWidth
                    autoFocus
                    value={normalizeDetails(params.value)}
                    onChange={(e) =>
                        params.api.setEditCellValue(
                            { id: params.id, field: params.field, value: normalizeDetails(e.target.value) },
                            e
                        )
                    }
                />
            )
        },
        {
            field: 'actions',
            headerName: t("Actions"),
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
        <Box
            ref={containerRef}
            sx={(theme) => ({
                mb: 2,
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                backgroundColor:
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.03)',
            })}
        >
            {error && <div>{t("Error")}: {error}</div>}
            <div style={{ width: '100%' }}>
                <Typography
                    variant='caption'
                    color='#cccccc'
                    sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                    onClick={() => uiDispatch({ type: 'SET_RECORDS_OPEN', payload: !uiState.recordsOpen })}
                >
                    {t("Records")}
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
                            rows={visibleRecords}
                            columns={columns}
                            pageSize={5}
                            rowsPerPageOptions={[5]}
                            disableSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            getRowHeight={() => 'auto'}
                            sx={{
                                [`& .${gridClasses.cell}`]: {
                                  py: 0,
                                  alignContent: 'center'
                                },
                            }}
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
                title={t("Confirm Deletion")}
                content={t("Are you sure you want to delete this record?")}
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
