export const initialUIState = {
    showGrid: false,
    groupDialogOpen: false,
    editDialogOpen: false,
    confirmDialogOpen: false,
    recordDialogOpen: false,
    tagDialogOpen: false,
    heatmapOpen: true,
    calendarOpen: true,
    recordsOpen: true,
};

export function uiReducer(state, action) {
    switch (action.type) {
        case 'SET_SHOW_GRID':
            return { ...state, showGrid: action.payload };
        case 'SET_GROUP_DIALOG':
            return { ...state, groupDialogOpen: action.payload };
        case 'SET_TAG_DIALOG':
            return { ...state, tagDialogOpen: action.payload };
        case 'SET_EDIT_DIALOG':
            return { ...state, editDialogOpen: action.payload };
        case 'SET_CONFIRM_DIALOG':
            return { ...state, confirmDialogOpen: action.payload };
        case 'SET_RECORD_DIALOG':
            return { ...state, recordDialogOpen: action.payload };
        case 'SET_HEATMAP_OPEN':
            return { ...state, heatmapOpen: action.payload };
        case 'SET_CALENDAR_OPEN':
            return { ...state, calendarOpen: action.payload };
        case 'SET_RECORDS_OPEN':
            return { ...state, recordsOpen: action.payload};
        default:
            return state;
    }
}