import { useI18n } from '../i18n/I18nContext';
import { normalizeDetails } from '../utils/recordDetails';
import { useState, useRef, useMemo } from 'react';
import { DataGrid, gridClasses } from '@mui/x-data-grid';
import ConfirmDialog from './ConfirmDialog'
import { Box, Collapse, IconButton, Typography } from '@mui/material';
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

    // ----------------------------
    // DataGrid の列定義
    // ----------------------------
    const columns = [
        {
            field: 'created_at',
            headerName: t("Recorded at"),
            width: 220,
            cellClassName: 'record-date',
            valueFormatter: (params) => formatToLocal(params, undefined, language)
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
            field: 'activity_name',
            headerName: t("Activity name"),
            width: 160,
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
            field: 'memo',
            headerName: t("Details"),
            width: 200,
            renderCell: (params) => (
                <Typography
                    variant='body2'
                    noWrap
                    title={normalizeDetails(params.value)}
                >
                    {normalizeDetails(params.value)}
                </Typography>
            )
        },
        {
            field: 'actions',
            headerName: t("Delete"),
            width: 100,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <IconButton
                    onClick={() => handleDeleteRecordClick(params.row.id)}
                    onDoubleClick={(event) => event.stopPropagation()}
                >
                    <DeleteIcon />
                </IconButton>
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
                            onRowDoubleClick={(params) => handleEditRecordClick(params.row)}
                            getRowHeight={() => 'auto'}
                            sx={{
                                '& .record-date': { whiteSpace: 'nowrap' },
                                [`& .${gridClasses.cell}:focus, & .${gridClasses.cell}:focus-within`]: {
                                    outline: 'none',
                                },
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
