import { useI18n } from '../i18n/I18nContext';
import { Tooltip } from '@mui/material';
import { DateTime } from 'luxon';

const CustomEventWrapper = ({ event, children }) => {
    const { t } = useI18n();
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
                <div>{t("Start")}: {start}</div>
                <div>{t("End")}: {end}</div>
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