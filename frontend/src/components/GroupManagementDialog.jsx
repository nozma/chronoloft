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
  const [editGroupId, setEditGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editClientId, setEditClientId] = useState('');

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
      await addActivityGroup({ name: newGroupName, client_id: newClientId });
      const updated = await fetchActivityGroups();
      setGroups(updated);
      setNewGroupName('');
      setNewClientId('');
    } catch (err) {
      console.error('Failed to add group:', err);
    }
  };

  const handleEdit = (group) => {
    setEditGroupId(group.id);
    setEditGroupName(group.name);
    setEditClientId(group.client_id || '');
  };

  const handleUpdate = async () => {
    try {
      await updateActivityGroup(editGroupId, { name: editGroupName, client_id: editClientId });
      const updated = await fetchActivityGroups();
      setGroups(updated);
      setEditGroupId(null);
      setEditGroupName('');
      setEditClientId('');
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