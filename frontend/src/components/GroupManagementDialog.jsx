import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton, MenuItem, Box
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    fetchActivityGroups,
    addActivityGroup,
    updateActivityGroup,
    deleteActivityGroup
} from '../services/api';
import iconMapping from '../utils/iconMapping';

function GroupManagementDialog({ open, onClose }) {
    const [groups, setGroups] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newClientId, setNewClientId] = useState('');
    const [newIconName, setNewIconName] = useState('');
    const [newIconColor, setNewIconColor] = useState('');
    const [editGroupId, setEditGroupId] = useState(null);
    const [editGroupName, setEditGroupName] = useState('');
    const [editClientId, setEditClientId] = useState('');
    const [editIconName, setEditIconName] = useState('');
    const [editIconColor, setEditIconColor] = useState('');

    // ActivityGroup の一覧を取得する
    useEffect(() => {
        if (open) {
            fetchActivityGroups()
                .then(data => setGroups(data))
                .catch(err => console.error('Error fetching groups:', err));
        }
    }, [open]);

    const handleAdd = async () => {
        try {
            await addActivityGroup({
                name: newGroupName,
                client_id: newClientId,
                icon_name: newIconName,    // 追加
                icon_color: newIconColor,  // 追加
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
                            <TableCell>ID</TableCell>
                            <TableCell>グループ名</TableCell>
                            <TableCell>Discord Client ID</TableCell>
                            <TableCell>アイコン</TableCell>
                            <TableCell>アイコン色</TableCell>
                            <TableCell align="right">操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {groups.map((group) => (
                            <TableRow key={group.id}>
                                <TableCell>{group.id}</TableCell>
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
                                        // 表示用：getIconForGroup を利用して、アイコンプレビューを表示
                                        group.icon_name ? (
                                            // ここでは直接 iconMapping を使って表示する
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
                                <TableCell align="right">
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