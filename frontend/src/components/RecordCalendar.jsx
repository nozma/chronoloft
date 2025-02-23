import React, { useState, useEffect } from 'react';
import { Calendar } from 'react-big-calendar';
import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useGroups } from '../contexts/GroupContext';
import CustomEvent from './CalendarCustomEvent';

const localizer = luxonLocalizer(DateTime);

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
                title: `${rec.activity_name} (${rec.value.toFixed(0)}分)`,
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
        setEvents(eventsData);
    }, [records, groups]);

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
                views={['day', 'week']}
                step={15}
                timeslots={2}
                style={{ height: 800 }}
                titleAccessor="title"
                components={{ eventWrapper: CustomEvent }}
                dayLayoutAlgorithm={'no-overlap'}
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