import { useI18n } from '../i18n/I18nContext';
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Autocomplete,
    Chip,
    MenuItem
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useGroups } from '../contexts/GroupContext';
import { useTags } from '../contexts/TagContext';

function AddActivityDialog({ open, onClose, onSubmit, initialData, defaultGroupId, defaultTags }) {
    const { t } = useI18n();
    const { groups } = useGroups();
    const { tags } = useTags();
    const theme = useTheme();
    const tagColor = theme.palette.text.primary;
    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState('');
    const [unit, setUnit] = useState('count');
    const [assetKey, setAssetKey] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [selectedTags, setSelectedTags] = useState([]);

    // ダイアログが開いたとき、または initialData が更新されたときにフォームフィールドを初期化する
    useEffect(() => {
        if (initialData) {
            console.log(initialData);
            setGroupId(initialData.group_id || '');
            setName(initialData.name || '');
            setUnit(initialData.unit || '');
            setAssetKey(initialData.asset_key || '');
            setIsActive(String(initialData.is_active) || '');
            setSelectedTags(initialData.tags || []);
        } else {
            // 新規登録の場合は初期値にリセット
            setGroupId(defaultGroupId || '');
            setName('');
            setUnit('minutes');
            setAssetKey('');
            setIsActive(true);
            setSelectedTags(defaultTags || []);
        }
    }, [initialData, open, defaultGroupId, defaultTags]);

    const handleSubmit = () => {
        if (!name || !groupId) {
            alert(t("Group and name are required."));
            return;
        }
        const tagIds = selectedTags.map(t => t.id);
        onSubmit({
            name: name,
            group_id: groupId,
            unit: unit,
            asset_key: assetKey,
            is_active: (isActive === 'true'),
            tag_ids: tagIds,
        });
        console.log(tagIds);
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
                    margin="dense"
                    label={t("State")}
                    fullWidth
                    select
                    value={String(isActive)}
                    onChange={(e) => setIsActive(e.target.value)}
                >
                    <MenuItem key="true" value="true" >{t("Active")}</MenuItem>
                    <MenuItem key="false" value="false" >{t("Inactive")}</MenuItem>
                </TextField>
                <TextField
                    select
                    margin="dense"
                    label={t("Group")}
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
                    label={t("Name")}
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    select
                    margin="dense"
                    label={t("Unit")}
                    fullWidth
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                >
                    <MenuItem value="count">{t("Times")}</MenuItem>
                    <MenuItem value="minutes">{t("Minutes")}</MenuItem>
                </TextField>
                <TextField
                    margin="dense"
                    label={t("Asset Key")}
                    fullWidth
                    value={assetKey}
                    onChange={(e) => setAssetKey(e.target.value)}
                />
                <Autocomplete
                    multiple
                    options={tags}
                    getOptionLabel={(option) => option.name}
                    value={selectedTags}
                    onChange={(event, newValue) => {
                        setSelectedTags(newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                            const tagProps = getTagProps({ index });
                            const { key, ...other } = tagProps;
                            return (
                                <Chip
                                    key={option.id}
                                    {...other}
                                    label={option.name}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: `1px solid ${tagColor}`,
                                        color: tagColor
                                    }}
                                />
                            );
                        })
                    }
                    renderInput={(params) => (
                        <TextField {...params} variant="outlined" label={t("Tags")} placeholder={t("Select multiple tags")} />
                    )}
                    sx={{ mt: 2 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t("Cancel")}</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    {t("Submit")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default AddActivityDialog;
