import { useReducer } from 'react';

const initialState = {
  filterCriteria: {
    groupFilter: '',
    categoryFilter: '',
    unit: '',
    activityNameFilter: '',
  },
  confirmDialogOpen: false,
  selectedRecordId: null,
  showRecords: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FILTER_CRITERIA':
      return { ...state, filterCriteria: action.payload };
    case 'UPDATE_FILTER_CRITERIA':
      return { ...state, filterCriteria: { ...state.filterCriteria, ...action.payload } };
    case 'SET_CONFIRM_DIALOG':
      return { ...state, confirmDialogOpen: action.payload };
    case 'SET_SELECTED_RECORD_ID':
      return { ...state, selectedRecordId: action.payload };
    case 'SET_SHOW_RECORDS':
      return { ...state, showRecords: action.payload };
    default:
      return state;
  }
}

export default function useRecordListState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch };
}