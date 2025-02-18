export const initialUIState = {
    showGrid: false,
    categoryDialogOpen: false,
    groupDialogOpen: false,
    editDialogOpen: false,
    confirmDialogOpen: false,
    recordDialogOpen: false,
  };
  
  export function uiReducer(state, action) {
    switch (action.type) {
      case 'SET_SHOW_GRID':
        return { ...state, showGrid: action.payload };
      case 'SET_CATEGORY_DIALOG':
        return { ...state, categoryDialogOpen: action.payload };
      case 'SET_GROUP_DIALOG':
        return { ...state, groupDialogOpen: action.payload };
      case 'SET_EDIT_DIALOG':
        return { ...state, editDialogOpen: action.payload };
      case 'SET_CONFIRM_DIALOG':
        return { ...state, confirmDialogOpen: action.payload };
      case 'SET_RECORD_DIALOG':
        return { ...state, recordDialogOpen: action.payload };
      default:
        return state;
    }
  }