import { useI18n } from '../i18n/I18nContext';
import { 
    GridToolbarContainer, 
    GridToolbarColumnsButton,
    GridToolbarFilterButton
} from '@mui/x-data-grid';import Button from '@mui/material/Button';
function CustomToolbar({ addButtonLabel, onAddClick }) {
    const { t } = useI18n();
    return (
        <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <Button color="primary" onClick={onAddClick}>
                {addButtonLabel ?? t("Add")}
            </Button>
        </GridToolbarContainer>
    );
}

export default CustomToolbar;