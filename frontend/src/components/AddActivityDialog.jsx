import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

function AddActivityDialog({ open, onClose, onSubmit, initialData, categories }) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [unit, setUnit] = useState('count');
    const [assetKey, setAssetKey] = useState('');
    const [isActive, setIsActive] = useState(true);

    // ダイアログが開いたとき、または initialData が更新されたときにフォームフィールドを初期化する
    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setCategoryId(initialData.category_id || '');
            setUnit(initialData.unit || '');
            setAssetKey(initialData.asset_key || '');
            setIsActive(String(initialData.is_active) || '');
        } else {
            // 新規登録の場合は初期値にリセット
            setName('');
            setCategoryId('');
            setUnit('minutes');
            setAssetKey('');
            setIsActive(true);
        }
    }, [initialData, open]);

    const handleSubmit = () => {
        if (!name || !categoryId) {
            alert("Name と Category は必須です。");
            return;
        }
        onSubmit({ name, category_id: parseInt(categoryId), unit, asset_key: assetKey, is_active: isActive });
        setName('');
        setCategoryId('');
        setUnit('minutes');
        setAssetKey('');
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent>
                <TextField
                    margin="dence"
                    label="State"
                    fullWidth
                    select
                    value={String(isActive)}
                    onChange={(e) => setIsActive(e.target.value === "true")}
                    >
                    <MenuItem key="true" value="true" >Active</MenuItem>
                    <MenuItem key="false" value="false" >Inactive</MenuItem>
                </TextField>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    select
                    margin="dense"
                    label="Category"
                    fullWidth
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                >
                    {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                            {cat.name}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    select
                    margin="dense"
                    label="Unit"
                    fullWidth
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                >
                    <MenuItem value="count">回</MenuItem>
                    <MenuItem value="minutes">分</MenuItem>
                </TextField>
                <TextField
                    margin="dense"
                    label="Asset Key"
                    fullWidth
                    value={assetKey}
                    onChange={(e) => setAssetKey(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default AddActivityDialog;