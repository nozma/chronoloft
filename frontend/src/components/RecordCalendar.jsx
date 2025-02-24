import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'react-big-calendar';
import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendarOverrides.css';
import { useGroups } from '../contexts/GroupContext';
import CustomEvent from './CalendarCustomEvent';

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
        title: `${agg.activityName} (${Math.floor(Number(agg.totalValue/60).toFixed(0))}時間${Math.round(agg.totalValue%60)}分)`,
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

function RecordCalendar({ records }) {
    const { groups } = useGroups();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [currentView, setCurrentView] = useState('week');

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
            const event = {
                id: rec.id,
                activityName: rec.activity_name,
                value: rec.value,
                title: `${rec.activity_name} (${Math.floor(Number(rec.value/60).toFixed(0))}時間${Math.round(rec.value%60)}分)`,
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
        <div style={{ height: '800px', margin: '20px' }}>
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
        </div>
    );
}

export default RecordCalendar;