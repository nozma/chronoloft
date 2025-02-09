import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

function AddActivityDialog({ open, onClose, onSubmit, categories }) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('count');
  const [assetKey, setAssetKey] = useState('');

  const handleSubmit = () => {
    if (!name || !categoryId) {
        alert("Name と Category は必須です。");
        return;
    }
    onSubmit({ name, category_id: parseInt(categoryId), unit, asset_key: assetKey });
    setName('');
    setCategoryId('');
    setUnit('count');
    setAssetKey('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add New Activity</DialogTitle>
      <DialogContent>
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
          <MenuItem value="">
            --Select Category--
          </MenuItem>
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