import { useI18n } from '../i18n/I18nContext';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

function ConfirmDialog({ open, title, content, onConfirm, onCancel, confirmLabel }) {
    const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onCancel || onConfirm}>
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        {onCancel && <Button onClick={onCancel}>{t("Cancel")}</Button>}
        <Button onClick={onConfirm} variant="contained" color="primary">
          {confirmLabel ?? t("Confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
