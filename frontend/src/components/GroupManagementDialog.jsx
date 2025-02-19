import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    fetchActivityGroups,
    addActivityGroup,
    updateActivityGroup,
    deleteActivityGroup
} from '../services/api';

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
                <div style={{ marginBottom: '16px' }}>
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
                    {/* 追加: アイコン名選択（候補をドロップダウンなどで選ぶか、自由入力） */}
                    <TextField
                        label="アイコン名"
                        value={newIconName}
                        onChange={(e) => setNewIconName(e.target.value)}
                        style={{ marginRight: '16px' }}
                    />
                    {/* 追加: アイコン色（テキスト入力またはカラーピッカー） */}
                    <TextField
                        label="アイコン色"
                        value={newIconColor}
                        onChange={(e) => setNewIconColor(e.target.value)}
                        style={{ marginRight: '16px', width: '120px' }}
                    />
                    <Button variant="contained" color="primary" onClick={handleAdd}>
                        追加
                    </Button>
                </div>
                {/* グループ一覧のテーブル */}
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>グループ名</TableCell>
                            <TableCell>Discord Client ID</TableCell>
                            <TableCell>アイコン名</TableCell>
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
                                            value={editIconName}
                                            onChange={(e) => setEditIconName(e.target.value)}
                                        />
                                    ) : (
                                        group.icon_name || ''
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editGroupId === group.id ? (
                                        <TextField
                                            value={editIconColor}
                                            onChange={(e) => setEditIconColor(e.target.value)}
                                        />
                                    ) : (
                                        group.icon_color || ''
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