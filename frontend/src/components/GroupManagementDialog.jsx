import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton, MenuItem, Box, Switch
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import {
    fetchActivityGroups,
    addActivityGroup,
    updateActivityGroup,
    deleteActivityGroup
} from '../services/api';
import iconMapping from '../utils/iconMapping';
import { useGroups } from '../contexts/GroupContext';

function GroupManagementDialog({ open, onClose }) {
    const { groups, setGroups, isGroupExcluded, setGroupExcluded } = useGroups();
    const [newGroupName, setNewGroupName] = useState('');
    const [newClientId, setNewClientId] = useState('');
    const [newIconName, setNewIconName] = useState('');
    const [newIconColor, setNewIconColor] = useState('');
    const [editGroupId, setEditGroupId] = useState(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editClientId, setEditClientId] = useState('');
    const [editIconName, setEditIconName] = useState('');
    const [editIconColor, setEditIconColor] = useState('');

    const handleAdd = async () => {
        try {
            await addActivityGroup({
                name: newGroupName,
                client_id: newClientId,
                icon_name: newIconName,
                icon_color: newIconColor,
            });
            const updated = await fetchActivityGroups();
            setGroups(updated);
            setNewGroupName('');
            setNewClientId('');
            setNewIconName('');
            setNewIconColor('');
        } catch (err) {
            console.error('Failed to add group:', err);
        }
    };

    const handleEdit = (group) => {
        setEditGroupId(group.id);
        setEditGroupName(group.name);
        setEditClientId(group.client_id || '');
        setEditIconName(group.icon_name || '');
        setEditIconColor(group.icon_color || '');
    };

    const handleUpdate = async () => {
        try {
            await updateActivityGroup(editGroupId, {
                name: editGroupName,
                client_id: editClientId,
                icon_name: editIconName,    // 追加
                icon_color: editIconColor,  // 追加
            });
            const updated = await fetchActivityGroups();
            setGroups(updated);
            setEditGroupId(null);
            setEditGroupName('');
            setEditClientId('');
            setEditIconName('');
            setEditIconColor('');
        } catch (err) {
            console.error('Failed to update group:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteActivityGroup(id);
            const updated = await fetchActivityGroups();
            setGroups(updated);
        } catch (err) {
            console.error('Failed to delete group:', err);
        }
    };

    // グループを上に移動するハンドラー
    const handleMoveUp = async (group, index) => {
        if (index === 0) return; // 最上位なら何もしない

        // コピーを作成
        const newGroups = [...groups];
        // 上のアイテムとスワップ
        const prev = newGroups[index - 1];
        const current = newGroups[index];
        const temp = current.position;
        current.position = prev.position;
        prev.position = temp;
        // 新しい順序でソート
        newGroups.sort((a, b) => a.position - b.position);
        setGroups(newGroups);

        await updateActivityGroup(current.id, { position: current.position });
        await updateActivityGroup(prev.id, { position: prev.position });
    };

    // グループを下に移動するハンドラー
    const handleMoveDown = async (group, index) => {
        if (index === groups.length - 1) return; // 最下位なら何もしない

        const newGroups = [...groups];
        const next = newGroups[index + 1];
        const current = newGroups[index];
        const temp = current.position;
        current.position = next.position;
        next.position = temp;
        newGroups.sort((a, b) => a.position - b.position);
        setGroups(newGroups);

        await updateActivityGroup(current.id, { position: current.position });
        await updateActivityGroup(next.id, { position: next.position });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>グループの管理</DialogTitle>
            <DialogContent>
                {/* グループ追加フォーム */}
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <TextField
                        label="グループ名"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        style={{ marginRight: '16px' }}
                    />
                    <TextField
                        label="Discord Client ID"
                        value={newClientId}
                        onChange={(e) => setNewClientId(e.target.value)}
                        style={{ marginRight: '16px' }}
                    />
                    <TextField
                        label="アイコン"
                        select
                        value={newIconName}
                        onChange={(e) => setNewIconName(e.target.value)}
                        style={{ marginRight: '16px', minWidth: '120px' }}
                    >
                        <MenuItem value="">--デフォルト--</MenuItem>
                        {Object.keys(iconMapping).map((key) => {
                            const IconComponent = iconMapping[key];
                            return (
                                <MenuItem key={key} value={key}>
                                    <IconComponent sx={{ mr: 1 }} />
                                </MenuItem>
                            );
                        })}
                    </TextField>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                        <input
                            id="new-icon-color"
                            type="color"
                            value={newIconColor}
                            onChange={(e) => setNewIconColor(e.target.value)}
                            style={{ width: 40, height: 40, border: 'none', padding: 0 }}
                        />
                        <span>{newIconColor}</span>
                    </Box>
                    <Button variant="contained" color="primary" onClick={handleAdd}>
                        追加
                    </Button>
                </Box>
                {/* グループ一覧のテーブル */}
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>グループ名</TableCell>
                            <TableCell>Discord Client ID</TableCell>
                            <TableCell>アイコン</TableCell>
                            <TableCell>アイコン色</TableCell>
                            <TableCell>集計除外</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {groups.map((group, index) => (
                            <TableRow key={group.id}>
                                <TableCell>
                                    {editGroupId === group.id ? (
                                        <TextField
                                            value={editGroupName}
                                            onChange={(e) => setEditGroupName(e.target.value)}
                                        />
                                    ) : (
                                        group.name
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editGroupId === group.id ? (
                                        <TextField
                                            value={editClientId}
                                            onChange={(e) => setEditClientId(e.target.value)}
                                        />
                                    ) : (
                                        group.client_id
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editGroupId === group.id ? (
                                        <TextField
                                            select
                                            label="アイコン"
                                            value={editIconName}
                                            onChange={(e) => setEditIconName(e.target.value)}
                                            style={{ minWidth: '120px' }}
                                        >
                                            <MenuItem value="">--デフォルト--</MenuItem>
                                            {Object.keys(iconMapping).map((key) => {
                                                const IconComponent = iconMapping[key];
                                                return (
                                                    <MenuItem key={key} value={key}>
                                                        <IconComponent sx={{ mr: 1 }} />
                                                    </MenuItem>
                                                );
                                            })}
                                        </TextField>
                                    ) : (
                                        group.icon_name ? (
                                            (() => {
                                                const IconComponent = iconMapping[group.icon_name] || iconMapping.HomeWorkIcon;
                                                return <IconComponent sx={{ mr: 1, color: group.icon_color || 'gray' }} />;
                                            })()
                                        ) : (
                                            ""
                                        )
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editGroupId === group.id ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <input
                                                id="edit-icon-color"
                                                type="color"
                                                value={editIconColor}
                                                onChange={(e) => setEditIconColor(e.target.value)}
                                                style={{ width: 40, height: 40, border: 'none', padding: 0 }}
                                            />
                                            <span>{editIconColor}</span>
                                        </Box>
                                    ) : (
                                        group.icon_color ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        backgroundColor: group.icon_color,
                                                        border: '1px solid #ccc',
                                                        borderRadius: 1
                                                    }}
                                                />
                                                <span>{group.icon_color}</span>
                                            </Box>
                                        ) : (
                                            ''
                                        )
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        size="small"
                                        checked={isGroupExcluded(group.id)}
                                        onChange={(e) => setGroupExcluded(group.id, e.target.checked)}
                                        inputProps={{ 'aria-label': '集計除外' }}
                                    />
                                </TableCell>
                                <TableCell align="left">
                                    {editGroupId === group.id ? (
                                        <>
                                            <Button onClick={handleUpdate} color="primary">
                                                更新
                                            </Button>
                                            <Button onClick={() => setEditGroupId(null)}>
                                                キャンセル
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <IconButton onClick={() => handleEdit(group)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(group.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleMoveUp(group, index)}
                                                disabled={index === 0}
                                            >
                                                <ArrowUpwardIcon />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleMoveDown(group, index)}
                                                disabled={index === groups.length - 1}
                                            >
                                                <ArrowDownwardIcon />
                                            </IconButton>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>閉じる</Button>
            </DialogActions>
        </Dialog>
    );
}

export default GroupManagementDialog;
