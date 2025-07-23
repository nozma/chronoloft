export const DEFAULT_HISTORY_ORDER = [
    'chart',
    'heatmap',
    'trend',
    'calendar',
    'records',
];

export const initialUIState = {
    showGrid: false,
    groupDialogOpen: false,
    editDialogOpen: false,
    confirmDialogOpen: false,
    recordDialogOpen: false,
    tagDialogOpen: false,
    groupOpen: true,
    tagOpen: true,
    activityOpen: true,
    chartOpen: true,
    heatmapOpen: true,
    calendarOpen: true,
    recordsOpen: true,
    trendOpen: true,
    showChart: true,
    showHeatmap: true,
    showCalendar: true,
    showRecords: true,
    showTrend: true,
    historyOrder: [...DEFAULT_HISTORY_ORDER],
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
        // Activity選択UI部分の開閉状態
        case 'SET_GROUP_OPEN':
            return { ...state, groupOpen: action.payload };
        case 'SET_TAG_OPEN':
            return { ...state, tagOpen: action.payload };
        case 'SET_ACTIVITY_OPEN':
            return { ...state, activityOpen: action.payload};
        // History項目の開閉状態
        case 'SET_CHART_OPEN':
            return { ...state, chartOpen: action.payload };
        case 'SET_HEATMAP_OPEN':
            return { ...state, heatmapOpen: action.payload };
        case 'SET_CALENDAR_OPEN':
            return { ...state, calendarOpen: action.payload };
        case 'SET_RECORDS_OPEN':
            return { ...state, recordsOpen: action.payload };
        case 'SET_TREND_OPEN':
            return { ...state, trendOpen: action.payload };
        // History項目の表示有無
        case 'SET_SHOW_CHART':
            return { ...state, showChart: action.payload };
        case 'SET_SHOW_HEATMAP':
            return { ...state, showHeatmap: action.payload };
        case 'SET_SHOW_CALENDAR':
            return { ...state, showCalendar: action.payload };
        case 'SET_SHOW_RECORDS':
            return { ...state, showRecords: action.payload };
        case 'SET_SHOW_TREND':
            return { ...state, showTrend: action.payload };
        case 'SET_HISTORY_ORDER':
            return { ...state, historyOrder: action.payload };
        // 一括変更
        case 'UPDATE_UI':
            return { ...state, ...action.payload };
        default:
            return state;
    }
}