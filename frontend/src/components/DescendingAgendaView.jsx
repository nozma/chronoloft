import React, { useEffect, useRef } from 'react';
import addClass from 'dom-helpers/addClass';
import removeClass from 'dom-helpers/removeClass';
import width from 'dom-helpers/width';
import scrollbarSize from 'dom-helpers/scrollbarSize';

import { navigate } from 'react-big-calendar/lib/utils/constants';
import { inRange } from 'react-big-calendar/lib/utils/eventLevels';
import { isSelected } from 'react-big-calendar/lib/utils/selection';

const DEFAULT_LENGTH = 30;

function DescendingAgenda(props) {
    const {
        accessors,
        components = {},
        date,
        events,
        getters,
        length = DEFAULT_LENGTH,
        localizer,
        onDoubleClickEvent,
        onSelectEvent,
        selected,
    } = props;

    const headerRef = useRef(null);
    const dateColRef = useRef(null);
    const timeColRef = useRef(null);
    const contentRef = useRef(null);
    const tbodyRef = useRef(null);

    useEffect(() => {
        adjustHeader();
    });

    const renderDay = (day, eventsForDay, dayKey) => {
        const Event = components.event;
        const AgendaDate = components.date;
        const dateLabel = localizer.format(day, 'agendaDateFormat');

        return eventsForDay.map((event, idx) => {
            const title = accessors.title(event);
            const end = accessors.end(event);
            const start = accessors.start(event);
            const userProps = getters.eventProp(
                event,
                start,
                end,
                isSelected(event, selected)
            );

            const first = idx === 0 ? (
                <td rowSpan={eventsForDay.length} className="rbc-agenda-date-cell">
                    {AgendaDate ? <AgendaDate day={day} label={dateLabel} /> : dateLabel}
                </td>
            ) : false;

            return (
                <tr key={`${dayKey}_${idx}`} className={userProps.className} style={userProps.style}>
                    {first}
                    <td className="rbc-agenda-time-cell">
                        {timeRangeLabel(day, event)}
                    </td>
                    <td
                        className="rbc-agenda-event-cell"
                        onClick={(e) => onSelectEvent && onSelectEvent(event, e)}
                        onDoubleClick={(e) => onDoubleClickEvent && onDoubleClickEvent(event, e)}
                    >
                        {Event ? <Event event={event} title={title} /> : title}
                    </td>
                </tr>
            );
        });
    };

    const timeRangeLabel = (day, event) => {
        let labelClass = '';
        const TimeComponent = components.time;
        let label = localizer.messages.allDay;

        const end = accessors.end(event);
        const start = accessors.start(event);

        if (!accessors.allDay(event)) {
            if (localizer.eq(start, end)) {
                label = localizer.format(start, 'agendaTimeFormat');
            } else if (localizer.isSameDate(start, end)) {
                label = localizer.format({ start, end }, 'agendaTimeRangeFormat');
            } else if (localizer.isSameDate(day, start)) {
                label = localizer.format(start, 'agendaTimeFormat');
            } else if (localizer.isSameDate(day, end)) {
                label = localizer.format(end, 'agendaTimeFormat');
            }
        }

        if (localizer.gt(day, start, 'day')) labelClass = 'rbc-continues-prior';
        if (localizer.lt(day, end, 'day')) labelClass += ' rbc-continues-after';

        return (
            <span className={labelClass.trim()}>
                {TimeComponent ? (
                    <TimeComponent event={event} day={day} label={label} />
                ) : (
                    label
                )}
            </span>
        );
    };

    const adjustHeader = () => {
        if (!tbodyRef.current) return;
        const header = headerRef.current;
        const firstRow = tbodyRef.current.firstChild;
        if (!firstRow) return;

        const isOverflowing =
            contentRef.current.scrollHeight > contentRef.current.clientHeight;
        const widths = [width(firstRow.children[0]), width(firstRow.children[1])];

        if (
            dateColRef.current.style.width !== `${widths[0]}px` ||
            timeColRef.current.style.width !== `${widths[1]}px`
        ) {
            dateColRef.current.style.width = `${widths[0]}px`;
            timeColRef.current.style.width = `${widths[1]}px`;
        }

        if (isOverflowing) {
            addClass(header, 'rbc-header-overflowing');
            header.style.marginRight = `${scrollbarSize()}px`;
        } else {
            removeClass(header, 'rbc-header-overflowing');
            header.style.marginRight = '';
        }
    };

    const messages = localizer.messages;
    const end = localizer.add(date, length, 'day');
    const range = localizer.range(date, end, 'day').reverse();

    const inRangeEvents = events.filter((event) =>
        inRange(event, localizer.startOf(date, 'day'), localizer.endOf(end, 'day'), accessors, localizer)
    );

    return (
        <div className="rbc-agenda-view">
            {inRangeEvents.length !== 0 ? (
                <>
                    <table ref={headerRef} className="rbc-agenda-table">
                        <thead>
                            <tr>
                                <th className="rbc-header" ref={dateColRef}>
                                    {messages.date}
                                </th>
                                <th className="rbc-header" ref={timeColRef}>
                                    {messages.time}
                                </th>
                                <th className="rbc-header">{messages.event}</th>
                            </tr>
                        </thead>
                    </table>
                    <div className="rbc-agenda-content" ref={contentRef}>
                        <table className="rbc-agenda-table">
                            <tbody ref={tbodyRef}>
                                {range.map((day, idx) => {
                                    const eventsForDay = inRangeEvents.filter((event) =>
                                        inRange(
                                            event,
                                            localizer.startOf(day, 'day'),
                                            localizer.endOf(day, 'day'),
                                            accessors,
                                            localizer
                                        )
                                    );

                                    if (!eventsForDay.length) {
                                        return null;
                                    }

                                    return renderDay(day, eventsForDay, idx);
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <span className="rbc-agenda-empty">{messages.noEventsInRange}</span>
            )}
        </div>
    );
}

DescendingAgenda.range = (start, { length = DEFAULT_LENGTH, localizer }) => {
    const end = localizer.add(start, length, 'day');
    return {
        start,
        end,
    };
};

DescendingAgenda.navigate = (date, action, { length = DEFAULT_LENGTH, localizer }) => {
    switch (action) {
        case navigate.PREVIOUS:
            return localizer.add(date, -length, 'day');
        case navigate.NEXT:
            return localizer.add(date, length, 'day');
        default:
            return date;
    }
};

DescendingAgenda.title = (start, { length = DEFAULT_LENGTH, localizer }) => {
    const end = localizer.add(start, length, 'day');
    return localizer.format({ start, end }, 'agendaHeaderFormat');
};

export default DescendingAgenda;
