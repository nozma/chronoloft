import { useI18n } from '../i18n/I18nContext';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

function ConfirmDialog({ open, title, content, onConfirm, onCancel }) {
    const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t("Cancel")}</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          {t("Confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;