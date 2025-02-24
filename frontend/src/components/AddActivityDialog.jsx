import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { useGroups } from '../contexts/GroupContext';

function AddActivityDialog({ open, onClose, onSubmit, initialData }) {
    const { groups } = useGroups();
    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState('');
    const [unit, setUnit] = useState('count');
    const [assetKey, setAssetKey] = useState('');
    const [isActive, setIsActive] = useState(true);

    // ダイアログが開いたとき、または initialData が更新されたときにフォームフィールドを初期化する
    useEffect(() => {
        if (initialData) {
            setGroupId(initialData.group_id || '');
            setName(initialData.name || '');
            setUnit(initialData.unit || '');
            setAssetKey(initialData.asset_key || '');
            setIsActive(String(initialData.is_active) || '');
        } else {
            // 新規登録の場合は初期値にリセット
            setGroupId('');
            setName('');
            setUnit('minutes');
            setAssetKey('');
            setIsActive(true);
        }
    }, [initialData, open]);

    const handleSubmit = () => {
        if (!name || !groupId) {
            alert("Group と Name は必須です。");
            return;
        }
        onSubmit({ name: name, group_id: groupId, unit: unit, asset_key: assetKey, is_active: (isActive === 'true') });
        setName('');
        setGroupId('');
        setUnit('minutes');
        setAssetKey('');
        setIsActive(true);
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
                    onChange={(e) => setIsActive(e.target.value)}
                >
                    <MenuItem key="true" value="true" >Active</MenuItem>
                    <MenuItem key="false" value="false" >Inactive</MenuItem>
                </TextField>
                <TextField
                    select
                    margin="dense"
                    label="Group"
                    fullWidth
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                >
                    {groups.map((g) => (
                        <MenuItem key={g.id} value={g.id}>
                            {g.name}
                        </MenuItem>
                    ))}
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