import React from 'react';
import { 
    GridToolbarContainer, 
    GridToolbarColumnsButton,
    GridToolbarFilterButton
} from '@mui/x-data-grid';import Button from '@mui/material/Button';
function CustomToolbar({ addButtonLabel = 'Add', onAddClick }) {
    return (
        <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <Button color="primary" onClick={onAddClick}>
                {addButtonLabel}
            </Button>
        </GridToolbarContainer>
    );
}

export default CustomToolbar;