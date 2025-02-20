// frontend/src/components/CategoryManagementDialog.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuItem from '@mui/material/MenuItem';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { fetchCategories, addCategory, updateCategory, deleteCategory, fetchActivityGroups } from '../services/api';
import { useCategories } from '../contexts/CategoryContext';
import { useGroups } from '../contexts/GroupContext';
import getIconForGroup from '../utils/getIconForGroup';

function CategoryManagementDialog({ open, onClose }) {
    const { categories, setCategories } = useCategories();
    const { groups, setGroups } = useGroups();

    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryGroup, setNewCategoryGroup] = useState('');
    const [editCategoryId, setEditCategoryId] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [editCategoryGroup, setEditCategoryGroup] = useState('');

    useEffect(() => {
        if (open) {
            fetchActivityGroups()
                .then(data => setGroups(data))
                .catch(err => console.error('Error fetching groups:', err));
        }
    }, [open]);

    const handleAdd = async () => {
        try {
            // ここでは、新規追加時にグループとしてグループ名を渡す前提
            await addCategory({ name: newCategoryName, group: newCategoryGroup });
            const updated = await fetchCategories();
            setCategories(updated);
            setNewCategoryName('');
            setNewCategoryGroup('');
        } catch (err) {
            console.error("Failed to add category:", err);
        }
    };

    const handleEdit = (category) => {
        setEditCategoryId(category.id);
        setEditCategoryName(category.name);
        // ここで、APIから返されるカテゴリ情報内のグループがどのプロパティか確認する。
        // 例として、category.group がグループ名ならそのままで、そうでなければ category.group_name に変更
        setEditCategoryGroup(category.group);
    };

    const handleUpdate = async () => {
        try {
            await updateCategory(editCategoryId, { name: editCategoryName, group: editCategoryGroup });
            const updated = await fetchCategories();
            setCategories(updated);
            setEditCategoryId(null);
            setEditCategoryName('');
            setEditCategoryGroup('');
        } catch (err) {
            console.error("Failed to update category:", err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteCategory(id);
            const updated = await fetchCategories();
            setCategories(updated);
        } catch (err) {
            console.error("Failed to delete category:", err);
        }
    };


    // 位置を上に移動するハンドラー
    const handleMoveUp = async (category, index) => {
        if (index === 0) return; // すでに最上位の場合は何もしない
        const newCats = [...categories];
        // index を利用して、対象と前の要素の position を入れ替え
        const prev = newCats[index - 1];
        const current = newCats[index];
        const temp = current.position;
        current.position = prev.position;
        prev.position = temp;
        // 新しい順序でソート
        newCats.sort((a, b) => a.position - b.position);
        setCategories(newCats);
        // バックエンド更新（エラーハンドリングは適宜追加）
        await updateCategory(current.id, { position: current.position });
        await updateCategory(prev.id, { position: prev.position });
    };

    // 位置を下に移動するハンドラー
    const handleMoveDown = async (category, index) => {
        if (index === categories.length - 1) return; // 最下位の場合は何もしない
        const newCats = [...categories];
        const next = newCats[index + 1];
        const current = newCats[index];
        const temp = current.position;
        current.position = next.position;
        next.position = temp;
        newCats.sort((a, b) => a.position - b.position);
        setCategories(newCats);
        await updateCategory(current.id, { position: current.position });
        await updateCategory(next.id, { position: next.position });
    };


    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogContent>
                {/* 追加フォーム */}
                <div style={{ marginBottom: '16px' }}>
                    <TextField
                        label="Category Name"
                        size='small'
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        style={{ marginRight: '16px' }}
                    />
                    <TextField
                        label="Group"
                        select
                        size='small'
                        value={newCategoryGroup}
                        onChange={(e) => setNewCategoryGroup(e.target.value)}
                        style={{ marginRight: '16px', width: '160px' }}
                    >
                        <MenuItem value="">All</MenuItem>
                        {groups.map((g) => (
                            <MenuItem key={g.id} value={g.name}>
                                {getIconForGroup(g.name, groups)}
                                {g.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Button variant="contained" color="primary" onClick={handleAdd}>
                        追加
                    </Button>
                </div>
                {/* カテゴリ一覧のテーブル */}
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>カテゴリ名</TableCell>
                            <TableCell>グループ</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {categories.map((cat, index) => (
                            <TableRow key={cat.id}>
                                <TableCell>
                                    {editCategoryId === cat.id ? (
                                        <TextField
                                            size='small'
                                            value={editCategoryName}
                                            onChange={(e) => setEditCategoryName(e.target.value)}
                                        />
                                    ) : (
                                        cat.name
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editCategoryId === cat.id ? (
                                        <TextField
                                            label="グループ"
                                            select
                                            size='small'
                                            value={editCategoryGroup}
                                            onChange={(e) => setEditCategoryGroup(e.target.value)}
                                            style={{ marginRight: '16px', width: '160px' }}
                                        >
                                            {groups.map((g) => (
                                                <MenuItem key={g.id} value={g.name}>
                                                    {getIconForGroup(g.name, groups)}
                                                    {g.name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    ) : (
                                        <>
                                        {getIconForGroup(cat.group_name, groups)}
                                        {cat.group_name}
                                        </>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    {editCategoryId === cat.id ? (
                                        <>
                                            <Button onClick={handleUpdate} color="primary">
                                                更新
                                            </Button>
                                            <Button onClick={() => setEditCategoryId(null)}>
                                                キャンセル
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <IconButton onClick={() => handleEdit(cat)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton onClick={() => handleDelete(cat.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleMoveUp(cat, index)}
                                                disabled={index === 0}
                                            >
                                                <ArrowUpwardIcon />
                                            </IconButton>
                                            <IconButton
                                                onClick={() => handleMoveDown(cat, index)}
                                                disabled={index === categories.length - 1}
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

export default CategoryManagementDialog;