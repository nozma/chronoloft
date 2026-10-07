import { useI18n } from '../i18n/I18nContext';
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Switch,
    Stack,
    Box,
    IconButton,
} from '@mui/material';
import { useUI } from '../contexts/UIContext';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { DEFAULT_HISTORY_ORDER } from '../reducers/uiReducer';

const DEFAULT_VISIBILITY = {
    showChart: true,
    showHeatmap: true,
    showCalendar: true,
    showRecords: true,
    showTrend: true,
};

function HistoryDisplayDialog({ open, onClose }) {
    const { t } = useI18n();
    const { state: uiState, dispatch: uiDispatch } = useUI();

    const [tmpShowChart, setTmpShowChart] = useState(uiState.showChart);
    const [tmpShowHeatmap, setTmpShowHeatmap] = useState(uiState.showHeatmap);
    const [tmpShowCalendar, setTmpShowCalendar] = useState(uiState.showCalendar);
    const [tmpShowRecords, setTmpShowRecords] = useState(uiState.showRecords);
    const [tmpShowTrend, setTmpShowTrend] = useState(uiState.showTrend);
    const [tmpOrder, setTmpOrder] = useState(uiState.historyOrder);

    const labelMap = {
        chart: t("Chart"),
        heatmap: t("Heatmap"),
        trend: t("Trend"),
        calendar: t("Calendar"),
        records: t("Records"),
    };

    const visibilityMap = {
        chart: [tmpShowChart, setTmpShowChart],
        heatmap: [tmpShowHeatmap, setTmpShowHeatmap],
        trend: [tmpShowTrend, setTmpShowTrend],
        calendar: [tmpShowCalendar, setTmpShowCalendar],
        records: [tmpShowRecords, setTmpShowRecords],
    };

    const moveUp = (index) => {
        if (index === 0) return;
        setTmpOrder(prev => {
            const arr = [...prev];
            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            return arr;
        });
    };

    const moveDown = (index) => {
        if (index === tmpOrder.length - 1) return;
        setTmpOrder(prev => {
            const arr = [...prev];
            [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
            return arr;
        });
    };

    useEffect(() => {
        if (open) {
            setTmpShowChart(uiState.showChart);
            setTmpShowHeatmap(uiState.showHeatmap);
            setTmpShowCalendar(uiState.showCalendar);
            setTmpShowRecords(uiState.showRecords);
            setTmpShowTrend(uiState.showTrend);
            setTmpOrder(uiState.historyOrder);
        }
    }, [open, uiState]);

    const handleReset = () => {
        setTmpShowChart(DEFAULT_VISIBILITY.showChart);
        setTmpShowHeatmap(DEFAULT_VISIBILITY.showHeatmap);
        setTmpShowCalendar(DEFAULT_VISIBILITY.showCalendar);
        setTmpShowRecords(DEFAULT_VISIBILITY.showRecords);
        setTmpShowTrend(DEFAULT_VISIBILITY.showTrend);
        setTmpOrder([...DEFAULT_HISTORY_ORDER]);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle>{t("History Items")}</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={1}>
                    {tmpOrder.map((key, index) => {
                        const [checked, setter] = visibilityMap[key];
                        return (
                            <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <FormControlLabel
                                    control={<Switch checked={checked} onChange={e => setter(e.target.checked)} />}
                                    label={labelMap[key]}
                                />
                                <Box>
                                    <IconButton onClick={() => moveUp(index)} disabled={index === 0} size="small">
                                        <ArrowUpwardIcon fontSize="inherit" />
                                    </IconButton>
                                    <IconButton onClick={() => moveDown(index)} disabled={index === tmpOrder.length - 1} size="small">
                                        <ArrowDownwardIcon fontSize="inherit" />
                                    </IconButton>
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleReset} color="inherit" sx={{ mr: 'auto', textTransform: 'none' }}>
                    {t("Reset to Defaults")}
                </Button>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button onClick={onClose}>{t("Cancel")}</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            uiDispatch({
                                type: 'UPDATE_UI',
                                payload: {
                                    showChart: tmpShowChart,
                                    showHeatmap: tmpShowHeatmap,
                                    showCalendar: tmpShowCalendar,
                                    showRecords: tmpShowRecords,
                                    showTrend: tmpShowTrend,
                                    historyOrder: tmpOrder,
                                },
                            });
                            onClose();
                        }}
                    >
                        {t("Apply")}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

export default HistoryDisplayDialog;
