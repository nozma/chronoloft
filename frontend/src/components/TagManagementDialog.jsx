import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton, Box
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import { useTags } from '../contexts/TagContext';
import { fetchTags, createTag, updateTag, deleteTag } from '../services/api';
import { useActivities } from '../contexts/ActivityContext';

/**
 * タグ管理ダイアログ
 * 
 * - タグ名、色を設定できる
 * - 一覧がテーブル表示され、編集/削除が可能
 */
function TagManagementDialog({ open, onClose }) {
    const { tags, setTags } = useTags();
    const { refreshActivities } = useActivities();

    // 新規登録用フィールド
    const [newTagName, setNewTagName] = useState('');

    // 編集用フィールド
    const [editTagId, setEditTagId] = useState(null);
    const [editTagName, setEditTagName] = useState('');

    // ---------- 新規タグ追加 ----------
    const handleAdd = async () => {
        try {
            await createTag({
                name: newTagName,
                color: '#ffffff'
            });
            const updated = await fetchTags();
            setTags(updated);
            await refreshActivities();
            setNewTagName('');
        } catch (err) {
            console.error('Failed to create tag:', err);
        }
    };

    // ---------- 編集モード切り替え ----------
    const handleEdit = (tag) => {
        setEditTagId(tag.id);
        setEditTagName(tag.name);
    };

    // ---------- 編集保存 ----------
    const handleUpdate = async () => {
        try {
            await updateTag(editTagId, {
                name: editTagName
            });
            const updated = await fetchTags();
            setTags(updated);
            await refreshActivities();
            setEditTagId(null);
            setEditTagName('');
        } catch (err) {
            console.error('Failed to update tag:', err);
        }
    };

    // ---------- タグ削除 ----------
    const handleDelete = async (id) => {
        try {
            await deleteTag(id);
            const updated = await fetchTags();
            setTags(updated);
            await refreshActivities();
        } catch (err) {
            console.error('Failed to delete tag:', err);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { width: '66%' } }}
        >
            <DialogTitle>タグの管理</DialogTitle>
            <DialogContent>
                {/* タグ追加フォーム */}
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <TextField
                        label="タグ名"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        style={{ marginRight: '16px' }}
                    />
                    <Button variant="contained" color="primary" onClick={handleAdd}>
                        追加
                    </Button>
                </Box>

                {/* タグ一覧のテーブル */}
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>タグ名</TableCell>
                            <TableCell align="left"></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tags.map((tag) => (
                            <TableRow key={tag.id}>
                                <TableCell>
                                    {editTagId === tag.id ? (
                                        <TextField
                                            value={editTagName}
                                            onChange={(e) => setEditTagName(e.target.value)}
                                        />
                                    ) : (
                                        tag.name
                                    )}
                                </TableCell>
                                <TableCell align="left">
                                    {editTagId === tag.id ? (
                                        <>
                                            <Button onClick={handleUpdate} color="primary">更新</Button>
                                            <Button onClick={() => {
                                                setEditTagId(null);
                                                setEditTagName('');
                                            }}>
                                                キャンセル
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <IconButton onClick={() => handleEdit(tag)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(tag.id)}>
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

export default TagManagementDialog;