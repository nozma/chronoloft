import React, { useState, useEffect, useMemo } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

import { Calendar, Views } from 'react-big-calendar';

import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import '../styles/calendarOverrides.css';

import { useGroups } from '../contexts/GroupContext';
import { Box, Typography, Collapse, Tooltip, ToggleButton, ToggleButtonGroup, IconButton, TextField, MenuItem } from '@mui/material';
import { useUI } from '../contexts/UIContext';
import { useFilter } from '../contexts/FilterContext';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import AddRecordDialog from './AddRecordDialog';
import { updateRecord, deleteRecord, createRecord } from '../services/api';
import { useRecords } from '../contexts/RecordContext';
import { useActivities } from '../contexts/ActivityContext';
import DescendingAgendaView from './DescendingAgendaView';

const DragAndDropCalendar = withDragAndDrop(Calendar);

const localizer = luxonLocalizer(DateTime);

function getEventGroupingTargets(event, groupBy) {
    if (groupBy === 'group') {
        const groupName = event.activityGroup || 'Unknown Group';
        return [{ key: groupName, label: groupName, color: event.groupColor }];
    }
    if (groupBy === 'tag') {
        if (event.tags && event.tags.length > 0) {
            return event.tags.map((tag) => ({
                key: tag.name,
                label: tag.name,
                color: null,
            }));
        }
        return [{ key: 'No Tag', label: 'No Tag', color: null }];
    }
    if (groupBy === 'activityMemo') {
        const activityName = event.activityName || 'Unknown Activity';
        const memoPart = event.memo ? ` / ${event.memo}` : '';
        const label = `${activityName}${memoPart}`;
        return [{ key: label, label, color: event.groupColor }];
    }
    const activityName = event.activityName || 'Unknown Activity';
    return [{ key: activityName, label: activityName, color: event.groupColor }];
}

/**
 * month / agenda ビュー用に1日のイベントを合計する
 * @param {Array} events 集計対象のイベント
 * @param {{ sortBy: 'value' | 'dateDesc', groupBy: 'group' | 'tag' | 'activity' | 'activityMemo' }} options
 */
function aggregateEventsForMonth(events, { sortBy = 'value', groupBy = 'activity' } = {}) {
    const aggregated = {};

    events.forEach((event) => {
        const dayStr = event.start.toDateString();
        const groupTargets = getEventGroupingTargets(event, groupBy);
        groupTargets.forEach((target) => {
            const key = `${dayStr}_${target.key}`;
            if (!aggregated[key]) {
                aggregated[key] = {
                    start: event.start,
                    groupKey: target.key,
                    activityName: target.label,
                    groupColor: target.color || event.groupColor,
                    totalValue: 0,
                };
            }
            aggregated[key].totalValue += Number(event.value) || 0;
        });
    });

    const aggregatedArray = Object.values(aggregated).map((agg) => ({
        id: `${agg.groupKey}-${agg.start.toDateString()}`,
        activityName: agg.activityName,
        title: `(${Math.floor(agg.totalValue / 60)}:${String(Math.round(agg.totalValue % 60)).padStart(2, '0')}) ${agg.activityName}`,
        // All-day event for the aggregated day
        start: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate()),
        end: new Date(agg.start.getFullYear(), agg.start.getMonth(), agg.start.getDate() + 1),
        allDay: true,
        groupColor: agg.groupColor,
        totalValue: agg.totalValue,
    }));

    if (sortBy === 'dateDesc') {
        aggregatedArray.sort((a, b) => {
            const byDate = b.start.getTime() - a.start.getTime();
            if (byDate !== 0) return byDate;
            return b.totalValue - a.totalValue;
        });
    } else {
        // Sort descending by total time (default)
        aggregatedArray.sort((a, b) => {
            const byValue = b.totalValue - a.totalValue;
            if (byValue !== 0) return byValue;
            return b.start.getTime() - a.start.getTime();
        });
    }
    return aggregatedArray;
}

/* ヘッダ部分のツールバーのカスタム定義 */
function CustomToolbar({ label, onNavigate, onView, view, calendarMode, setCalendarMode, summaryGroupBy, setSummaryGroupBy }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* ナビゲーション */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <IconButton
                        onClick={() => onNavigate('TODAY')}
                        size='small'
                        sx={{
                            borderRadius: 8,
                            padding: '12px'
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>Today</span>
                    </IconButton>
                    <IconButton onClick={() => onNavigate('PREV')}><KeyboardArrowLeftIcon /></IconButton>
                    <IconButton onClick={() => onNavigate('NEXT')}><KeyboardArrowRightIcon /></IconButton>
                </Box>
                {/* 期間ラベル */}
                {label}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* View切り替え */}
                <ToggleButtonGroup
                    value={view}
                    exclusive
                    onChange={(e, newView) => {
                        if (newView) onView(newView);
                    }}
                    size="small"
                >
                    <ToggleButton value="day">Day</ToggleButton>
                    <ToggleButton value="week">Week</ToggleButton>
                    <ToggleButton value="month">Month</ToggleButton>
                    <ToggleButton value="agenda">Summary</ToggleButton>
                </ToggleButtonGroup>
                {view === 'agenda' && (
                    <TextField
                        select
                        label="Grouping"
                        size="small"
                        value={summaryGroupBy}
                        onChange={(e) => setSummaryGroupBy(e.target.value)}
                        sx={{
                            minWidth: 140,
                            '& .MuiInputLabel-shrink': {
                                transform: 'translate(14px, -4px) scale(0.75)',
                            },
                        }}
                        InputLabelProps={{ shrink: true }}
                    >
                        <MenuItem value="group">Group</MenuItem>
                        <MenuItem value="tag">Tag</MenuItem>
                        <MenuItem value="activity">Activity</MenuItem>
                        <MenuItem value="activityMemo">Activity + Memo</MenuItem>
                    </TextField>
                )}
                {/* 表示モード切り替え */}
                <ToggleButtonGroup
                    value={calendarMode}
                    exclusive
                    onChange={(e, newMode) => {
                        if (newMode !== null) setCalendarMode(newMode);
                    }}
                    size="small"
                >
                    <ToggleButton value="short">Short</ToggleButton>
                    <ToggleButton value="long">Long</ToggleButton>
                </ToggleButtonGroup>
            </Box>
        </Box>
    );
}

function RecordCalendar() {
    const { groups, excludedGroupIds } = useGroups();
    const { activities, excludedActivityIds } = useActivities();
    const { filterState } = useFilter();
    const { groupFilter } = filterState;
    const [events, setEvents] = useState([]);
    const [currentView, setCurrentView] = useLocalStorageState('calendar.view', Views.WEEK);
    const [currentDate, setCurrentDate] = useState(new Date());
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const [recordToEdit, setRecordToEdit] = useState(null);
    const { recordsWithLive: records, refreshRecords: onRecordUpdate } = useRecords();
    const selectedActivity = recordToEdit
        ? activities.find((a) => a.id === recordToEdit.activity_id)
        : null;
    const [calendarMode, setCalendarMode] = useLocalStorageState('calendar.mode', 'short');
    const [summaryGroupBy, setSummaryGroupBy] = useLocalStorageState('calendar.summaryGroupBy', 'activity');
    const [newRecordSlot, setNewRecordSlot] = useState(null);
    const defaultActivity = useMemo(
        () => activities.find((a) => a.unit === 'minutes') || activities[0],
        [activities]
    );

    const visibleRecords = useMemo(() => {
        return records.filter(rec => {
            if (rec.activity_group_id === null || rec.activity_group_id === undefined) return true;
            if (groupFilter && rec.activity_group === groupFilter) return true;
            return !excludedGroupIds.has(Number(rec.activity_group_id));
        });
    }, [records, excludedGroupIds, groupFilter]);

    const visibleRecordsByActivity = useMemo(() => {
        return visibleRecords.filter(rec => {
            if (rec.activity_id === null || rec.activity_id === undefined) return true;
            return !excludedActivityIds.has(Number(rec.activity_id));
        });
    }, [visibleRecords, excludedActivityIds]);

    useEffect(() => {
        const minuteRecords = visibleRecordsByActivity.filter((rec) => rec.unit === 'minutes');
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
            const min_round = Math.round(rec.value)
            const hours = Math.floor(min_round / 60);
            const mins = Math.round(min_round % 60);
            const formattedTime = `${String(hours)}:${String(mins).padStart(2, '0')}`;

            const event = {
                id: rec.id,
                activity_id: rec.activity_id,
                activityName: rec.activity_name,
                activityGroup: rec.activity_group,
                value: rec.value,
                title: `${rec.activity_name} (${formattedTime})`,
                start: startDT.toJSDate(),
                end: endDT.toJSDate(),
                allDay: false,
                groupColor,
                unit: rec.unit,
                created_at: rec.created_at,
                memo: rec.memo,
                tags: rec.tags,
                is_live: rec.is_live === true,
            };

            // If it spans multiple days, split it
            if (startDT.toJSDate().toDateString() !== endDT.toJSDate().toDateString()) {
                eventsData = eventsData.concat(splitEvent(event));
            } else {
                eventsData.push(event);
            }
        });

        if (currentView === 'month') {
            setEvents(aggregateEventsForMonth(eventsData));
        } else if (currentView === 'agenda') {
            setEvents(aggregateEventsForMonth(eventsData, { sortBy: 'dateDesc', groupBy: summaryGroupBy }));
        } else {
            setEvents(eventsData);
        }
    }, [visibleRecordsByActivity, groups, currentView, summaryGroupBy]);

    const handleDoubleClickEvent = (event) => {
        if (event.is_live) return;
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
        if (event.is_live) return;
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
        if (event.is_live) return;
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

    const handleSelectSlot = ({ start, end, action }) => {
        if (action === 'select') {
            setNewRecordSlot({ start, end });
        }
    };

    const handleCreateRecord = async (recordData) => {
        try {
            await createRecord(recordData);
            onRecordUpdate();
            setNewRecordSlot(null);
        } catch (err) {
            console.error('Failed to create record:', err);
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
                    <div>{event.memo}</div>
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
                <Box sx={{ height: '100%' }}>
                    <Box>{event.title}</Box>
                    <Box>{event.memo}</Box>
                </Box>
            </Tooltip>
        );
    }

    const calendarViews = useMemo(() => ({
        day: true,
        week: true,
        month: true,
        agenda: DescendingAgendaView,
    }), []);
    const calendarMessages = useMemo(() => ({
        agenda: 'Summary',
    }), []);

    const isAgendaView = currentView === 'agenda';
    const calendarMaxHeight = calendarMode === 'short' ? 500 : 800;
    const calendarStyle = isAgendaView
        ? { height: 'auto', maxHeight: calendarMaxHeight, overflowY: 'auto' }
        : { height: calendarMaxHeight };
    const calendarClassName = isAgendaView ? 'calendar-summary-auto' : undefined;

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
                <Box sx={{ mb: 2 }}>
                    <DragAndDropCalendar
                        // Basic RBC setup
                        localizer={localizer}
                        events={events}
                        view={currentView}
                        onView={(view) => {
                            if (view === 'agenda') {
                                // 月曜始まりにしたい場合
                                const weekStart = DateTime.fromJSDate(currentDate).startOf('week').plus({ days: -1 });
                                setCurrentDate(weekStart.toJSDate());
                            }
                            setCurrentView(view);
                        }}
                        length={7}
                        views={calendarViews}
                        date={currentDate}
                        onNavigate={(newDate) => setCurrentDate(newDate)}
                        tooltipAccessor={() => ''}  // ブラウザ標準のtooltipを表示しない
                        min={new Date(1972, 0, 1, 4, 0, 0, 0)}
                        messages={calendarMessages}

                        // Layout
                        startAccessor="start"
                        endAccessor="end"
                        step={60}
                        timeslots={calendarMode === "short" ? 2 : 1}
                        style={calendarStyle}
                        className={calendarClassName}
                        titleAccessor="title"
                        formats={formats}
                        components={{
                            event: CustomEvent,
                            toolbar: (toolbarProps) => (
                                <CustomToolbar
                                    {...toolbarProps}
                                    calendarMode={calendarMode}
                                    setCalendarMode={setCalendarMode}
                                    summaryGroupBy={summaryGroupBy}
                                    setSummaryGroupBy={setSummaryGroupBy}
                                />
                            )
                        }}
                        dayLayoutAlgorithm="no-overlap"
                        showAllEvents
                        culture="ja"

                        // Drag & Drop
                        onEventDrop={handleEventDrop}
                        onEventResize={handleEventResize}
                        resizable
                        resizableAccessor={(event) => !event.is_live}
                        // Make all events draggable (or define a function returning bool)
                        draggableAccessor={(event) => !event.is_live}
                        selectable // optional, you can remove if you don't need slot selection
                        onSelectSlot={handleSelectSlot}

                        // Double-click -> open edit
                        onDoubleClickEvent={handleDoubleClickEvent}

                        eventPropGetter={(event) => ({
                            style: {
                                backgroundColor: event.groupColor || '#3174ad',
                                borderRadius: '5px',
                                opacity: 0.8,
                                color: 'white',
                                fontSize: '0.5em',
                            },
                        })}
                    />
                </Box>
            </Collapse>
            {newRecordSlot && defaultActivity && (
                <AddRecordDialog
                    open={true}
                    onClose={() => setNewRecordSlot(null)}
                    onSubmit={handleCreateRecord}
                    activity={defaultActivity}
                    initialValue={
                        DateTime.fromJSDate(newRecordSlot.end)
                            .diff(DateTime.fromJSDate(newRecordSlot.start), 'minutes')
                            .toObject().minutes
                    }
                    initialDate={DateTime.fromJSDate(newRecordSlot.end).toUTC().toISO()}
                />
            )}

            {recordToEdit && (
                <AddRecordDialog
                    open={true}
                    onClose={() => setRecordToEdit(null)}
                    onSubmit={handleEditRecordSubmit}
                    activity={selectedActivity}
                    initialValue={recordToEdit.value}
                    initialDate={recordToEdit.created_at}
                    initialMemo={recordToEdit.memo}
                    onDelete={handleDeleteRecord}
                    isEdit={true}
                />
            )}
        </Box>
    );
}

export default RecordCalendar;
