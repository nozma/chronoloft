import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';

export default function useLocalDay() {
    const [today, setToday] = useState(() => DateTime.now().startOf('day'));

    useEffect(() => {
        let midnightTimer;
        const checkDay = () => {
            const now = DateTime.now();
            const nextDay = now.startOf('day');
            setToday(previous => previous.toMillis() === nextDay.toMillis()
                && previous.zoneName === nextDay.zoneName ? previous : nextDay);
            clearTimeout(midnightTimer);
            midnightTimer = setTimeout(checkDay, nextDay.plus({ days: 1 }).toMillis() - now.toMillis());
        };

        // 日付境界で更新し、スリープやバックグラウンドからの復帰時にも再確認する。
        checkDay();
        const interval = setInterval(checkDay, 60000);
        window.addEventListener('focus', checkDay);
        window.addEventListener('pageshow', checkDay);
        document.addEventListener('visibilitychange', checkDay);
        return () => {
            clearTimeout(midnightTimer);
            clearInterval(interval);
            window.removeEventListener('focus', checkDay);
            window.removeEventListener('pageshow', checkDay);
            document.removeEventListener('visibilitychange', checkDay);
        };
    }, []);

    return today;
}
