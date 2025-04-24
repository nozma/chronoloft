import React, { useState, useRef } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// カスタムコンポーネント
import {
    Button,
    Box,
    IconButton,
    Chip
} from '@mui/material';
import CustomToolbar from './CustomToolbar';
import AddActivityDialog from './AddActivityDialog';
import ConfirmDialog from './ConfirmDialog';

// ユーティリティとコンテキスト
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useUI } from '../contexts/UIContext';
import { useActivities } from '../contexts/ActivityContext';
import { setActivityTags } from '../services/api';

// カスタムフック
import useLocalStorageState from '../hooks/useLocalStorageState';

// ---------------------------------------------------------------------
// ActivityList コンポーネント本体
// ---------------------------------------------------------------------
function ActivityList() {
    // 通常の状態管理
    const { groups } = useGroups();
    const { activities, createActivity, modifyActivity, removeActivity, refreshActivities } = useActivities();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);

    // ローカルストレージで管理する状態
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);

    // UI状態
    const { state, dispatch } = useUI();

    // -----------------------------------------------------------------
    // イベントハンドラ
    // -----------------------------------------------------------------
    const handleAddClick = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const handleActivityAdded = async (activityData) => {
        try {
            await createActivity(activityData);
        } catch (err) {
            console.error("Failed to add activity:", err);
        }
    };

    const handleDeleteButtonClick = (activityId) => {
        setSelectedActivityId(activityId);
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: true });
    };

    const handleConfirmDelete = async () => {
        try {
            await removeActivity(selectedActivityId);
        } catch (err) {
            console.error("Failed to delete activity:", err);
        }
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        setSelectedActivityId(null);
    };


    const handleCancelDelete = () => {
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: false });
        setSelectedActivityId(null);
    };

    const processRowUpdate = async (newRow, oldRow) => {
        try {
            await modifyActivity(newRow.id, newRow);
            return newRow;
        } catch (error) {
            console.error("Failed to update activity:", error);
            throw error;
        }
    };

    const handleEditActivity = (activity) => {
        setSelectedActivity(activity);
        dispatch({ type: 'SET_EDIT_DIALOG', payload: true });
    };

    // -----------------------------------------------------------------
    // データグリッドの列定義
    // -----------------------------------------------------------------
    const columns = [
        {
            field: 'is_active',
            headerName: 'State',
            valueFormatter: (params) => { return (params ? "Active" : "Inactive") }
        },
        {
            field: 'group_name',
            headerName: 'Group',
            renderCell: (params) => {
                const groupName = params.row.group_name;
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getIconForGroup(groupName, groups)}
                        <span>{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'name',
            headerName: 'Name',
            width: 200,
        },
        {
            field: 'unit',
            headerName: 'Unit',
            valueFormatter: (params) => {
                if (params === 'minutes') return "分";
                else if (params === 'count') return "回";
                else return params;
            }
        },
        { field: 'asset_key', headerName: 'Asset Key', width: 150 },
        {
            field: 'tags',
            headerName: 'Tags',
            width: 200,
            renderCell: (params) => {
                const tags = params.row.tags || [];
                if (!tags.length) return null;
                return (
                    <div>
                        {tags.map(tag => (
                            <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                sx={{
                                    backgroundColor: tag.color || '#ccc',
                                    color: '#fff',
                                    mr: 1
                                }}
                            />
                        ))}
                    </div>
                );
            }
        },
        {
            field: 'actions',
            headerName: 'Actions',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                return (
                    <>
                        <IconButton onClick={() => handleEditActivity(params.row)} >
                            <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteButtonClick(params.row.id)} >
                            <DeleteIcon />
                        </IconButton>
                    </>
                );
            }
        }
    ];


    return (
        <div>
            {/* グリッド表示または管理画面 */}
            {state.showGrid && (
                <>
                    <div style={{ height: 400, width: '100%' }}>
                        <DataGrid
                            rows={activities}
                            columns={columns}
                            pageSize={5}
                            rowsPerPageOptions={[5]}
                            disableSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            slots={{ toolbar: CustomToolbar }}
                            slotProps={{
                                toolbar: { addButtonLabel: 'Add Activity', onAddClick: handleAddClick }
                            }}
                        />
                    </div>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2, mt: 1 }}>
                        <Button variant="contained" onClick={() => dispatch({ type: 'SET_SHOW_GRID', payload: false })} sx={{ mb: 2 }}>
                            Close
                        </Button>
                    </Box>
                </>

            )}
            <AddActivityDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleActivityAdded}
            />
            <ConfirmDialog
                open={state.confirmDialogOpen}
                title="Confirm Deletion"
                content="Are you sure you want to delete this activity?"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
            {state.editDialogOpen && selectedActivity && (
                <AddActivityDialog
                    open={state.editDialogOpen}
                    onClose={() => dispatch({ type: 'SET_EDIT_DIALOG', payload: false })}
                    onSubmit={async (activityData) => {
                        try {
                            await modifyActivity(selectedActivity.id, {
                                name: activityData.name,
                                group_id: activityData.group_id,
                                unit: activityData.unit,
                                asset_key: activityData.asset_key,
                                is_active: activityData.is_active
                            });
                            if (activityData.tag_ids && activityData.tag_ids.length > 0) {
                                await setActivityTags(selectedActivity.id, activityData.tag_ids);
                              } else if (activityData.tag_ids && activityData.tag_ids.length === 0) {
                                // タグを空にしたい場合
                                await setActivityTags(selectedActivity.id, []);
                              }
                            await refreshActivities();
                            dispatch({ type: 'SET_EDIT_DIALOG', payload: false });
                            setSelectedActivity(null);
                        } catch (err) {
                            console.error("Failed to update activity:", err);
                        }
                    }}
                    initialData={selectedActivity}
                />
            )}
        </div>
    );
}

export default ActivityList;