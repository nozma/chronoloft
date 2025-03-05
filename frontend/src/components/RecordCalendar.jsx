import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'react-big-calendar';
import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendarOverrides.css';
import { useGroups } from '../contexts/GroupContext';
import CustomEvent from './CalendarCustomEvent';
import { Box, Typography, Collapse } from '@mui/material';
import { useUI } from '../contexts/UIContext';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AddRecordDialog from './AddRecordDialog';
import { updateRecord, deleteRecord } from '../services/api';
import { useRecords } from '../contexts/RecordContext';

const localizer = luxonLocalizer(DateTime);

function aggregateEventsForMonth(events) {
    // month, agenda表示用の集計（同じ日のイベントをまとめる）
    const aggregated = {};

    events.forEach((event) => {
        // 同じ日の同じイベントのvalue（経過時間）を合計する
        const dayStr = event.start.toDateString();
        const key = `${dayStr}_${event.activityName}`;
        if (!aggregated[key]) {
            aggregated[key] = { ...event, totalValue: 0 };
        }
        aggregated[key].totalValue += Number(event.value) || 0;
    });

    const aggregatedArray = Object.values(aggregated).map((agg) => ({
        id: `${agg.id}-${agg.activityName}-${agg.start.toDateString()}`,
        activityName: agg.activityName,
        title: `(${Math.floor(Number(agg.totalValue / 60).toFixed(0))}:${String(Math.round(agg.totalValue % 60)).padStart(2, 0)}) ${agg.activityName}`,
        // 全日イベントとして扱う
        start: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate()),
        end: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate() + 1),
        allDay: true,
        groupColor: agg.groupColor,
        totalValue: agg.totalValue,
    }));

    // totalValue降順でソートする
    aggregatedArray.sort((a, b) => b.totalValue - a.totalValue);

    return aggregatedArray;
}

function RecordCalendar() {
    const { groups } = useGroups();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [currentView, setCurrentView] = useState('week');
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { records, refreshRecords: onRecordUpdate } = useRecords();

    useEffect(() => {
        // 記録単位が「分」のレコードだけを対象にする
        const minuteRecords = records.filter(rec => rec.unit === 'minutes');
        let eventsData = [];
        minuteRecords.forEach(rec => {
            // 終了時刻は record.created_at を UTC として解釈し、ローカルに変換
            const endDT = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            // 開始時刻は終了時刻から rec.value 分を引く
            const startDT = endDT.minus({ minutes: rec.value });
            // Retrieve group color from groups context using rec.activity_group (group name)
            let groupColor = null;
            if (rec.activity_group && groups && groups.length > 0) {
                const groupObj = groups.find(g => g.name === rec.activity_group);
                if (groupObj && groupObj.icon_color) {
                    groupColor = groupObj.icon_color;
                }
            }
            const hours = Math.floor(rec.value / 60);
            const minutes = Math.round(rec.value % 60);
            const formattedTime = `${String(hours)}:${String(minutes).padStart(2, '0')}`;
            const event = {
                id: rec.id,
                activityName: rec.activity_name,
                value: rec.value,
                title: `(${formattedTime}) ${rec.activity_name}`,
                start: startDT.toJSDate(),
                end: endDT.toJSDate(),
                allDay: false,
                groupColor
            };
            // 複数日にまたがる場合は分割
            if (startDT.toJSDate().toDateString() !== endDT.toJSDate().toDateString()) {
                eventsData = eventsData.concat(splitEvent(event));
            } else {
                eventsData.push(event);
            }
        });
        if (currentView === 'month' | currentView === 'agenda') {
            setEvents(aggregateEventsForMonth(eventsData));
        } else {
            setEvents(eventsData);
        }
    }, [records, groups, currentView]);

    // ダブルクリック時に呼ばれるハンドラ
    const handleDoubleClickEvent = (event) => {
        setRecordToEdit(event);
    }
    // レコードSubmit後の処理
    const handleEditRecordSubmit = async (updatedRecord) => {
        try {
            await updateRecord(recordToEdit.id, updatedRecord);
            onRecordUpdate();
            setRecordToEdit(null);
        } catch (error) {
            console.error("Failed to update record:", error);
        }
    }
    const handleDeleteRecord = async () => {
        if (!recordToEdit || !recordToEdit.id) return;
        try {
            await deleteRecord(recordToEdit.id);
            onRecordUpdate();
            setRecordToEdit(null);
        } catch (err) {
            console.error("Failed to delete record:", err);
        }
    };

    // 日付等の表示フォーマット定義
    const formats = useMemo(() => ({
        dayHeaderFormat: 'yyyy/MM/dd (EEE)',
        monthHeaderFormat: 'yyyy/M',
        dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
            localizer.format(start, 'M/d') +
            ' - ' +
            localizer.format(end, 'M/d'),
        agendaDateFormat: 'M/d(EEE)',
        eventTimeRangeFormat: () => ''
    }), [])

    return (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant='caption'
                color='#cccccc'
                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                onClick={() => uiDispatch({ type: 'SET_CALENDAR_OPEN', payload: !uiState.calendarOpen })}
            >
                Calendar
                <KeyboardArrowRightIcon
                    fontSize='small'
                    sx={{
                        transition: 'transform 0.15s linear',
                        transform: uiState.calendarOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        marginLeft: '4px'
                    }}
                />
            </Typography>
            <Collapse in={uiState.calendarOpen}>
                <Box sx={{ height: '800px', m: 2 }}>
                    <Calendar
                        localizer={localizer}
                        events={events}
                        date={currentDate}
                        view={currentView}
                        onNavigate={(date) => setCurrentDate(date)}
                        onView={(view) => setCurrentView(view)}
                        startAccessor="start"
                        endAccessor="end"
                        views={['day', 'week', 'month', 'agenda']}
                        step={30}
                        timeslots={2}
                        style={{ height: 800 }}
                        titleAccessor="title"
                        formats={formats}
                        onDoubleClickEvent={handleDoubleClickEvent}
                        components={{ eventWrapper: CustomEvent }}
                        dayLayoutAlgorithm={'no-overlap'}
                        showAllEvents
                        culture='ja'
                        eventPropGetter={(event) => ({
                            style: {
                                backgroundColor: event.groupColor || '#3174ad', // fallback color
                                borderRadius: '5px',
                                opacity: 0.8,
                                color: 'white',
                                fontSize: '0.75em',
                            },
                        })}
                    />
                </Box>
            </Collapse>
            {recordToEdit && (
                <AddRecordDialog
                    open={true}
                    onClose={() => setRecordToEdit(null)}
                    onSubmit={handleEditRecordSubmit}
                    activity={recordToEdit}
                    initialValue={recordToEdit.value}
                    initialDate={recordToEdit.created_at}
                    onDelete={handleDeleteRecord}
                    isEdit={true}
                />
            )}
        </Box>
    );
}

export default RecordCalendar;