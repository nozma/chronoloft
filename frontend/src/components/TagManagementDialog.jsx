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

/**
 * タグ管理ダイアログ
 * 
 * - タグ名、色を設定できる
 * - 一覧がテーブル表示され、編集/削除が可能
 */
function TagManagementDialog({ open, onClose }) {
    // useTags() で tags, setTags を共有しているならここで使う
    const { tags, setTags } = useTags();

    // 新規登録用フィールド
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#ffffff');

    // 編集用フィールド
    const [editTagId, setEditTagId] = useState(null);
    const [editTagName, setEditTagName] = useState('');
    const [editTagColor, setEditTagColor] = useState('#ffffff');

    // ---------- 新規タグ追加 ----------
    const handleAdd = async () => {
        try {
            await createTag({
                name: newTagName,
                color: newTagColor
            });
            const updated = await fetchTags();
            setTags(updated);
            setNewTagName('');
            setNewTagColor('#ffffff');
        } catch (err) {
            console.error('Failed to create tag:', err);
        }
    };

    // ---------- 編集モード切り替え ----------
    const handleEdit = (tag) => {
        setEditTagId(tag.id);
        setEditTagName(tag.name);
        setEditTagColor(tag.color || '#ffffff');
    };

    // ---------- 編集保存 ----------
    const handleUpdate = async () => {
        try {
            await updateTag(editTagId, {
                name: editTagName,
                color: editTagColor
            });
            const updated = await fetchTags();
            setTags(updated);
            setEditTagId(null);
            setEditTagName('');
            setEditTagColor('#ffffff');
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
        } catch (err) {
            console.error('Failed to delete tag:', err);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
                    {/* 色の設定 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                        <input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            style={{ width: 40, height: 40, border: 'none', padding: 0 }}
                        />
                        <span>{newTagColor}</span>
                    </Box>
                    <Button variant="contained" color="primary" onClick={handleAdd}>
                        追加
                    </Button>
                </Box>

                {/* タグ一覧のテーブル */}
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>タグ名</TableCell>
                            <TableCell>色</TableCell>
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
                                <TableCell>
                                    {editTagId === tag.id ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <input
                                                type="color"
                                                value={editTagColor}
                                                onChange={(e) => setEditTagColor(e.target.value)}
                                                style={{ width: 40, height: 40, border: 'none', padding: 0 }}
                                            />
                                            <span>{editTagColor}</span>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    backgroundColor: tag.color || '#ffffff',
                                                    border: '1px solid #ccc',
                                                    borderRadius: 1
                                                }}
                                            />
                                            <span>{tag.color || ''}</span>
                                        </Box>
                                    )}
                                </TableCell>
                                <TableCell align="left">
                                    {editTagId === tag.id ? (
                                        <>
                                            <Button onClick={handleUpdate} color="primary">更新</Button>
                                            <Button onClick={() => {
                                                setEditTagId(null);
                                                setEditTagName('');
                                                setEditTagColor('#ffffff');
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