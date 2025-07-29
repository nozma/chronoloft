import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    IconButton,
    Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CustomToolbar from './CustomToolbar';
import AddActivityDialog from './AddActivityDialog';
import ConfirmDialog from './ConfirmDialog';
import getIconForGroup from '../utils/getIconForGroup';
import { useGroups } from '../contexts/GroupContext';
import { useUI } from '../contexts/UIContext';
import { useActivities } from '../contexts/ActivityContext';
import { useFilter } from '../contexts/FilterContext';
import { setActivityTags } from '../services/api';
import useLocalStorageState from '../hooks/useLocalStorageState';

function ActivityManagementDialog({ open, onClose, runningActivityIds = [] }) {
    const { groups } = useGroups();
    const { activities, createActivity, modifyActivity, removeActivity, refreshActivities } = useActivities();
    const { filterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const { state, dispatch } = useUI();
    const theme = useTheme();
    const tagColor = theme.palette.text.primary;

    const handleAddClick = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const handleActivityAdded = async (activityData) => {
        try {
            await createActivity(activityData);
        } catch (err) {
            console.error('Failed to add activity:', err);
        }
    };

    const handleDeleteButtonClick = (activityId) => {
        if (runningActivityIds.includes(activityId)) return;
        setSelectedActivityId(activityId);
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: true });
    };

    const handleConfirmDelete = async () => {
        try {
            await removeActivity(selectedActivityId);
        } catch (err) {
            console.error('Failed to delete activity:', err);
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
            console.error('Failed to update activity:', error);
            throw error;
        }
    };

    const handleEditActivity = (activity) => {
        if (runningActivityIds.includes(activity.id)) return;
        setSelectedActivity(activity);
        dispatch({ type: 'SET_EDIT_DIALOG', payload: true });
    };

    const filteredActivities = activities.filter(act => {
        if (groupFilter && act.group_name !== groupFilter) {
            return false;
        }
        if (tagFilter) {
            const tags = act.tags?.map(t => t.name) || [];
            return tags.includes(tagFilter);
        }
        return true;
    });

    const columns = [
        {
            field: 'is_active',
            headerName: 'State',
            valueFormatter: (params) => { return params ? 'Active' : 'Inactive'; }
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
        { field: 'name', headerName: 'Name', width: 200 },
        {
            field: 'unit',
            headerName: 'Unit',
            valueFormatter: (params) => {
                if (params === 'minutes') return '分';
                else if (params === 'count') return '回';
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
                                    size='small'
                                    sx={{
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${tagColor}`,
                                        color: tagColor,
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
                const disabled = runningActivityIds.includes(params.row.id);
                return (
                    <>
                        <IconButton onClick={() => handleEditActivity(params.row)} disabled={disabled}>
                            <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteButtonClick(params.row.id)} disabled={disabled}>
                            <DeleteIcon />
                        </IconButton>
                    </>
                );
            }
        }
    ];

    return (
        <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
            <DialogTitle>アクティビティの管理</DialogTitle>
            <DialogContent>
                <Box sx={{ width: '100%' }}>
                    <DataGrid
                        rows={filteredActivities}
                        columns={columns}
                        pageSize={5}
                        rowsPerPageOptions={[5]}
                        disableSelectionOnClick
                        autoHeight
                        processRowUpdate={processRowUpdate}
                        slots={{ toolbar: CustomToolbar }}
                        slotProps={{ toolbar: { addButtonLabel: 'Add Activity', onAddClick: handleAddClick } }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>閉じる</Button>
            </DialogActions>
            <AddActivityDialog open={dialogOpen} onClose={handleDialogClose} onSubmit={handleActivityAdded} />
            <ConfirmDialog
                open={state.confirmDialogOpen}
                title='Confirm Deletion'
                content='Are you sure you want to delete this activity?'
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
                                await setActivityTags(selectedActivity.id, []);
                            }
                            await refreshActivities();
                            dispatch({ type: 'SET_EDIT_DIALOG', payload: false });
                            setSelectedActivity(null);
                        } catch (err) {
                            console.error('Failed to update activity:', err);
                        }
                    }}
                    initialData={selectedActivity}
                />
            )}
        </Dialog>
    );
}

export default ActivityManagementDialog;
