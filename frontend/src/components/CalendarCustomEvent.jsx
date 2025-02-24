import React from 'react';
import { Tooltip } from '@mui/material';
import { DateTime } from 'luxon';

const CustomEventWrapper = ({ event, children }) => {
    // 開始・終了時刻をフォーマット
    let tooltipContent;
    if(event.allDay) {
        tooltipContent =(
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
            <div>{children}</div>
        </Tooltip>
    );
};

export default CustomEventWrapper;