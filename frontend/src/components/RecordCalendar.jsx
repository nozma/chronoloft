import React, { useState, useEffect, useMemo } from 'react';

import { Calendar, Views } from 'react-big-calendar';

import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendarOverrides.css';

import { useGroups } from '../contexts/GroupContext';
import { Box, Typography, Collapse, Tooltip } from '@mui/material';
import { useUI } from '../contexts/UIContext';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import AddRecordDialog from './AddRecordDialog';
import { updateRecord, deleteRecord } from '../services/api';
import { useRecords } from '../contexts/RecordContext';

const DragAndDropCalendar = withDragAndDrop(Calendar);

const localizer = luxonLocalizer(DateTime);

/**
 * month / agenda ビュー用に1日のイベントを合計する
 */
function aggregateEventsForMonth(events) {
    const aggregated = {};

    events.forEach((event) => {
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
        title: `(${Math.floor(agg.totalValue / 60)}:${String(Math.round(agg.totalValue % 60)).padStart(2, '0')}) ${agg.activityName}`,
        // All-day event for the aggregated day
        start: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate()),
        end: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate() + 1),
        allDay: true,
        groupColor: agg.groupColor,
        totalValue: agg.totalValue,
    }));

    // Sort descending by total time
    aggregatedArray.sort((a, b) => b.totalValue - a.totalValue);
    return aggregatedArray;
}

function RecordCalendar() {
    const { groups } = useGroups();
    const [events, setEvents] = useState([]);
    const [currentView, setCurrentView] = useState(Views.WEEK);
    const [currentDate, setCurrentDate] = useState(new Date());
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { records, refreshRecords: onRecordUpdate } = useRecords();

    useEffect(() => {
        const minuteRecords = records.filter((rec) => rec.unit === 'minutes');
        let eventsData = [];

        minuteRecords.forEach((rec) => {
            // `created_at` is the end time (UTC) -> convert to local
            const endDT = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            // start = end - rec.value( minutes )
            const startDT = endDT.minus({ minutes: rec.value });

            // group color
            let groupColor = null;
            if (rec.activity_group && groups?.length > 0) {
                const groupObj = groups.find((g) => g.name === rec.activity_group);
                if (groupObj?.icon_color) {
                    groupColor = groupObj.icon_color;
                }
            }
            // label
            const hours = Math.floor(rec.value / 60);
            const mins = Math.round(rec.value % 60);
            const formattedTime = `${String(hours)}:${String(mins).padStart(2, '0')}`;

            const event = {
                id: rec.id,
                activityName: rec.activity_name,
                value: rec.value,
                title: `(${formattedTime}) ${rec.activity_name}`,
                start: startDT.toJSDate(),
                end: endDT.toJSDate(),
                allDay: false,
                groupColor,
                unit: rec.unit,
                created_at: rec.created_at,
            };

            // If it spans multiple days, split it
            if (startDT.toJSDate().toDateString() !== endDT.toJSDate().toDateString()) {
                eventsData = eventsData.concat(splitEvent(event));
            } else {
                eventsData.push(event);
            }
        });

        if (currentView === 'month' || currentView === 'agenda') {
            setEvents(aggregateEventsForMonth(eventsData));
        } else {
            setEvents(eventsData);
        }
    }, [records, groups, currentView]);

    const handleDoubleClickEvent = (event) => {
        setRecordToEdit(event);
    };

    const handleEditRecordSubmit = async (updatedRecord) => {
        try {
            await updateRecord(recordToEdit.id, updatedRecord);
            onRecordUpdate();
            setRecordToEdit(null);
        } catch (err) {
            console.error('Failed to update record:', err);
        }
    };

    const handleDeleteRecord = async () => {
        if (!recordToEdit?.id) return;
        try {
            await deleteRecord(recordToEdit.id);
            onRecordUpdate();
            setRecordToEdit(null);
        } catch (err) {
            console.error('Failed to delete record:', err);
        }
    };

    const handleEventDrop = async ({ event, start, end, isAllDay }) => {
        try {
            const startDT = DateTime.fromJSDate(start);
            const endDT = DateTime.fromJSDate(end);

            const newDuration = endDT.diff(startDT, 'minutes').minutes;
            const newCreatedAt = endDT.toUTC().toISO();

            await updateRecord(event.id, {
                value: newDuration,
                created_at: newCreatedAt,
            });
            onRecordUpdate();
        } catch (err) {
            console.error('Failed to update record by drag:', err);
        }
    };

    const handleEventResize = async ({ event, start, end }) => {
        try {
            const startDT = DateTime.fromJSDate(start);
            const endDT = DateTime.fromJSDate(end);

            const newDuration = endDT.diff(startDT, 'minutes').minutes;
            const newCreatedAt = endDT.toUTC().toISO();

            await updateRecord(event.id, {
                value: newDuration,
                created_at: newCreatedAt,
            });
            onRecordUpdate();
        } catch (err) {
            console.error('Failed to update record by resize:', err);
        }
    };

    const formats = useMemo(() => ({
        dayHeaderFormat: 'yyyy/MM/dd (EEE)',
        monthHeaderFormat: 'yyyy/M',
        dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
            localizer.format(start, 'M/d') + ' - ' + localizer.format(end, 'M/d'),
        agendaDateFormat: 'M/d(EEE)',
        eventTimeRangeFormat: () => '',
    }), []);

    // ツールチップ
    function CustomEvent(props) {
        const { event } = props;
        let tooltipContent;
        if (event.allDay) {
            tooltipContent = (
                <div><strong>{event.title}</strong></div>
            );
        } else {
            const start = DateTime.fromJSDate(event.start).toFormat("HH:mm");
            const end = DateTime.fromJSDate(event.end).toFormat("HH:mm");
            tooltipContent = (
                <div>
                    <div><strong>{event.title}</strong></div>
                    <div>開始: {start}</div>
                    <div>終了: {end}</div>
                </div>
            );
        }

        return (
            <Tooltip
                title={tooltipContent}
                arrow
                followCursor
                placement="top"
            >
                {event.title}
            </Tooltip>
        );
    }

    return (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant="caption"
                color="#cccccc"
                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                onClick={() =>
                    uiDispatch({ type: 'SET_CALENDAR_OPEN', payload: !uiState.calendarOpen })
                }
            >
                Calendar
                <KeyboardArrowRightIcon
                    fontSize="small"
                    sx={{
                        transition: 'transform 0.15s linear',
                        transform: uiState.calendarOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        marginLeft: '4px',
                    }}
                />
            </Typography>

            <Collapse in={uiState.calendarOpen}>
                <Box sx={{ height: '800px', m: 2 }}>
                    <DragAndDropCalendar
                        // Basic RBC setup
                        localizer={localizer}
                        events={events}
                        view={currentView}
                        onView={(view) => setCurrentView(view)}
                        views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]} // array-based views
                        date={currentDate}
                        onNavigate={(newDate) => setCurrentDate(newDate)}

                        // Layout
                        startAccessor="start"
                        endAccessor="end"
                        step={30}
                        timeslots={2}
                        style={{ height: 800 }}
                        titleAccessor="title"
                        formats={formats}
                        components={{ event: CustomEvent }}
                        dayLayoutAlgorithm="no-overlap"
                        showAllEvents
                        culture="ja"

                        // Drag & Drop
                        onEventDrop={handleEventDrop}
                        onEventResize={handleEventResize}
                        resizable
                        // Make all events draggable (or define a function returning bool)
                        draggableAccessor={() => true}
                        selectable // optional, you can remove if you don't need slot selection

                        // Double-click -> open edit
                        onDoubleClickEvent={handleDoubleClickEvent}

                        eventPropGetter={(event) => ({
                            style: {
                                backgroundColor: event.groupColor || '#3174ad',
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