import React, { useState, useEffect } from 'react';
import { Calendar } from 'react-big-calendar';
import { luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { splitEvent } from '../utils/splitEvent';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = luxonLocalizer(DateTime);

function RecordCalendar({ records }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);

    useEffect(() => {
        // 記録単位が「分」のレコードだけを対象にする
        const minuteRecords = records.filter(rec => rec.unit === 'minutes');
        let eventsData = [];
        minuteRecords.forEach(rec => {
            // 終了時刻は record.created_at を UTC として解釈し、ローカルに変換
            const endDT = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            // 開始時刻は終了時刻から rec.value 分を引く
            const startDT = endDT.minus({ minutes: rec.value });
            const event = {
                id: rec.id,
                title: `${rec.activity_name} (${rec.value}分)`,
                start: startDT.toJSDate(),
                end: endDT.toJSDate(),
                allDay: false,
            };
            // 複数日にまたがる場合は分割
            if (startDT.toJSDate().toDateString() !== endDT.toJSDate().toDateString()) {
                eventsData = eventsData.concat(splitEvent(event));
            } else {
                eventsData.push(event);
            }
        });
        setEvents(eventsData);
    }, [records]);

    return (
        <div style={{ height: '600px', margin: '20px' }}>
            <Calendar
                localizer={localizer}
                events={events}
                date={currentDate}
                onNavigate={(date, view, action) => {
                    setCurrentDate(date);
                }}
                startAccessor="start"
                endAccessor="end"
                defaultView="day"
                views={['day', 'week']}
                style={{ height: 600 }}
                titleAccessor="title"
            />
        </div>
    );
}

export default RecordCalendar;