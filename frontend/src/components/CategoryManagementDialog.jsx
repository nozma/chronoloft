import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { fetchCategories, addCategory, updateCategory, deleteCategory } from '../services/api';

function CategoryManagementDialog({ open, onClose }) {
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryGroup, setNewCategoryGroup] = useState('');
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryGroup, setEditCategoryGroup] = useState('');

  // カテゴリ一覧を取得する
  useEffect(() => {
    if (open) {
      fetchCategories()
        .then(data => setCategories(data))
        .catch(err => console.error("Failed to fetch categories:", err));
    }
  }, [open]);

  const handleAdd = async () => {
    try {
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>カテゴリの管理</DialogTitle>
      <DialogContent>
        {/* 追加フォーム */}
        <div style={{ marginBottom: '16px' }}>
          <TextField
            label="カテゴリ名"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={{ marginRight: '16px' }}
          />
          <TextField
            label="グループ"
            value={newCategoryGroup}
            onChange={(e) => setNewCategoryGroup(e.target.value)}
            style={{ marginRight: '16px' }}
          />
          <Button variant="contained" color="primary" onClick={handleAdd}>
            追加
          </Button>
        </div>
        {/* カテゴリ一覧のテーブル */}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>カテゴリ名</TableCell>
              <TableCell>グループ</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>{cat.id}</TableCell>
                <TableCell>
                  {editCategoryId === cat.id ? (
                    <TextField
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
                      value={editCategoryGroup}
                      onChange={(e) => setEditCategoryGroup(e.target.value)}
                    />
                  ) : (
                    cat.group
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