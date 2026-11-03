import { createActivitySearchPredicate, isValidReading } from '../utils/activitySearch';
import { useI18n } from '../i18n/I18nContext';
import { useMemo, useRef, useState } from 'react';
import {
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    IconButton,
    Chip,
    Switch,
    Select,
    MenuItem,
    TextField
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DataGrid, getGridStringOperators, useGridApiContext } from '@mui/x-data-grid';
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
import { useTags } from '../contexts/TagContext';
import { setActivityTags } from '../services/api';
import { useSharedStopwatches } from '../services/stopwatches';
import useLocalStorageState from '../hooks/useLocalStorageState';

function ActivityTagsEditCell({ id, field, value, options }) {
    const apiRef = useGridApiContext();
    return <Select
        multiple
        autoFocus
        fullWidth
        size="small"
        MenuProps={{ disablePortal: true }}
        value={(value || []).map(tag => tag.id)}
        onChange={event => apiRef.current.setEditCellValue({
            id, field, value: options.filter(tag => event.target.value.includes(tag.id)),
        })}
        renderValue={ids => options.filter(tag => ids.includes(tag.id)).map(tag => tag.name).join(', ')}
    >
        {options.map(tag => <MenuItem key={tag.id} value={tag.id}>{tag.name}</MenuItem>)}
    </Select>;
}

function ActivityManagementDialog({ open, onClose, runningActivityIds = [] }) {
    const { t } = useI18n();
    const shared = useSharedStopwatches();
    const protectedActivityIds = [...new Set([
        ...runningActivityIds,
        ...shared.items.filter(item => ['running', 'confirming'].includes(item.status)).map(item => item.activity_id),
    ])];
    const { groups } = useGroups();
    const { tags } = useTags();
    const {
        activities,
        createActivity,
        modifyActivity,
        removeActivity,
        refreshActivities,
        isActivityExcluded,
        setActivityExcluded,
    } = useActivities();
    const { filterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;
    const cellEscape = useRef(false);
    const [saveError, setSaveError] = useState('');
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [selectedActivity, setSelectedActivity] = useLocalStorageState('selectedActivity', null);
    const { state, dispatch } = useUI();
    const theme = useTheme();
    const tagColor = theme.palette.text.primary;

    const handleAddClick = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const defaultGroupId = useMemo(() => {
        if (!groupFilter) return '';
        const matchedGroup = groups.find((group) => group.name === groupFilter);
        return matchedGroup?.id || '';
    }, [groupFilter, groups]);

    const defaultTags = useMemo(() => {
        if (!tagFilter) return [];
        const matchedTag = tags.find((tag) => tag.name === tagFilter);
        return matchedTag ? [matchedTag] : [];
    }, [tagFilter, tags]);

    const handleActivityAdded = async (activityData) => {
        try {
            await createActivity(activityData);
        } catch (err) {
            console.error('Failed to add activity:', err);
        }
    };

    const handleDeleteButtonClick = (activityId) => {
        if (protectedActivityIds.includes(activityId)) return;
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
        if (protectedActivityIds.includes(newRow.id)) throw new Error(t("This activity is being timed and cannot be edited."));
        const changes = Object.fromEntries(['name', 'reading', 'group_id', 'unit', 'asset_key']
            .filter(key => newRow[key] !== oldRow[key]).map(key => [key, newRow[key]]));
        setSaveError('');
        if (Object.keys(changes).length) await modifyActivity(newRow.id, changes);
        if (newRow.tags !== oldRow.tags) {
            await setActivityTags(newRow.id, (newRow.tags || []).map(tag => tag.id));
            await refreshActivities();
        }
        return newRow;
    };

    const handleEditActivity = (activity) => {
        if (protectedActivityIds.includes(activity.id)) return;
        setSelectedActivity(activity);
        dispatch({ type: 'SET_EDIT_DIALOG', payload: true });
    };

    const handleStateChange = async (activityId, nextValue) => {
        if (protectedActivityIds.includes(activityId)) return;
        const isActive = nextValue === true || nextValue === 'true';
        try {
            await modifyActivity(activityId, { is_active: isActive });
        } catch (error) {
            console.error('Failed to update activity state:', error);
        }
    };

    const matchesSearch = useMemo(() => createActivitySearchPredicate(search), [search]);
    const filteredActivities = activities.filter(act => {
        if (!matchesSearch(act)) return false;
        if (groupFilter && act.group_name !== groupFilter) {
            return false;
        }
        if (tagFilter) {
            const tags = act.tags?.map(t => t.name) || [];
            return tags.includes(tagFilter);
        }
        return true;
    });

    // 名前の部分一致ではよみがなも対象にし、他の演算子の意味は維持する。
    const searchOperators = (readingOnly = false) => getGridStringOperators().map(operator => {
        if (!['contains', 'doesNotContain'].includes(operator.value)) return operator;
        return {
            ...operator,
            getApplyFilterFn: item => {
                if (!item.value) return null;
                const matches = createActivitySearchPredicate(String(item.value));
                return (value, row) => {
                    const result = matches(readingOnly ? { reading: value } : row);
                    return operator.value === 'doesNotContain' ? !result : result;
                };
            },
        };
    });

    const columns = [
        {
            field: 'is_active',
            headerName: t("State"),
            width: 125,
            renderCell: (params) => {
                const disabled = protectedActivityIds.includes(params.row.id);
                const value = params.row.is_active ? true : false;
                return (
                    <Select
                        size="small"
                        value={value}
                        disabled={disabled}
                        onChange={(event) => handleStateChange(params.row.id, event.target.value)}
                    >
                        <MenuItem value={true}>{t("Active")}</MenuItem>
                        <MenuItem value={false}>{t("Inactive")}</MenuItem>
                    </Select>
                );
            }
        },
        {
            field: 'group_id',
            headerName: t("Group"),
            editable: true,
            type: 'singleSelect',
            valueOptions: groups.map(group => ({ value: group.id, label: group.name })),
            valueSetter: (value, row) => ({ ...row, group_id: value, group_name: groups.find(group => group.id === value)?.name || '' }),
            renderCell: (params) => {
                const groupName = params.row.group_name;
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {getIconForGroup(groupName, groups)}
                        <span>{params.row.group_name}</span>
                    </div>
                );
            }
        },
        { field: 'name', headerName: t("Name"), width: 200, filterOperators: searchOperators(), editable: true,
            preProcessEditCellProps: ({ props }) => ({ ...props, error: !String(props.value ?? '').trim() || String(props.value).length > 80 }) },
        { field: 'reading', headerName: t("Reading"), width: 180, filterOperators: searchOperators(true), editable: true,
            preProcessEditCellProps: ({ props }) => ({ ...props, error: !isValidReading(props.value ?? '') }) },
        {
            field: 'excluded',
            headerName: t("Exclude from totals"),
            width: 110,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Switch
                    size="small"
                    checked={isActivityExcluded(params.row.id)}
                    onChange={(e) => setActivityExcluded(params.row.id, e.target.checked)}
                    inputProps={{ 'aria-label': t("Exclude from totals") }}
                />
            )
        },
        {
            field: 'unit',
            headerName: t("Unit"),
            editable: true,
            type: 'singleSelect',
            valueOptions: [{ value: 'minutes', label: t("Minutes") }, { value: 'count', label: t("Times") }],
            valueFormatter: (params) => {
                if (params === 'minutes') return t("Minutes");
                else if (params === 'count') return t("Times");
                else return params;
            }
        },
        { field: 'asset_key', headerName: t("Asset Key"), width: 150, editable: true,
            preProcessEditCellProps: ({ props }) => ({ ...props, error: String(props.value ?? '').length > 80 }) },
        {
            field: 'tags',
            headerName: t("Tags"),
            editable: true,
            renderEditCell: params => <ActivityTagsEditCell {...params} options={tags} />,
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
            headerName: t("Actions"),
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const disabled = protectedActivityIds.includes(params.row.id);
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

    const gridKey = protectedActivityIds.join('-');

    return (
        <Dialog open={open} onClose={(event, reason) => {
            if (reason === 'escapeKeyDown' && cellEscape.current) {
                cellEscape.current = false;
                return;
            }
            onClose();
        }} onKeyDownCapture={event => {
            // セル編集のEscは取り消しだけに使い、ダイアログは維持する。
            cellEscape.current = event.key === 'Escape' && Boolean(event.target.closest('[role="gridcell"]'));
        }} maxWidth='md' fullWidth>
            <DialogTitle>{t("Activity management")}</DialogTitle>
            <DialogContent>
                <Box sx={{ width: '100%' }}>
                    {saveError && <Alert severity="error" sx={{ mb: 1 }}>{saveError}</Alert>}
                    <TextField
                        fullWidth
                        size="small"
                        label={t("Search by name or reading")}
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <DataGrid
                        key={gridKey}
                        rows={filteredActivities}
                        columns={columns}
                        pageSize={5}
                        rowsPerPageOptions={[5]}
                        disableSelectionOnClick
                        autoHeight
                        getRowClassName={(params) => (params.row.is_active ? '' : 'inactive-row')}
                        sx={{
                            '& .inactive-row': {
                                opacity: 0.3,
                            },
                        }}
                        initialState={{
                            sorting: {
                                sortModel: [{ field: 'is_active', sort: 'desc' }],
                            },
                        }}
                        isCellEditable={params => !protectedActivityIds.includes(params.id)}
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={() => setSaveError(t("Could not save the activity. Check your input and try again."))}
                        slots={{ toolbar: CustomToolbar }}
                        slotProps={{ toolbar: { addButtonLabel: t("Add Activity"), onAddClick: handleAddClick } }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t("Close")}</Button>
            </DialogActions>
            <AddActivityDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleActivityAdded}
                defaultGroupId={defaultGroupId}
                defaultTags={defaultTags}
            />
            <ConfirmDialog
                open={state.confirmDialogOpen}
                title={t("Confirm Deletion")}
                content={t("Are you sure you want to delete this activity?")}
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
                                reading: activityData.reading,
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
