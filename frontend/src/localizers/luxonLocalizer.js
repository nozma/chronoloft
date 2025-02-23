import { DateTime } from 'luxon';

const luxonLocalizer = {
  formats: {
    dateFormat: 'dd',
    dayFormat: 'ccc dd',
    weekdayFormat: 'cccc',
    timeGutterFormat: 't',
    monthHeaderFormat: 'MMMM yyyy',
    dayHeaderFormat: 'cccc, MMM dd, yyyy',
    dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
      `${localizer.format(start, 'MMMM dd', culture)} — ${localizer.format(end, 'MMMM dd', culture)}`,
  },
  // 入力値（ISO 8601 形式など）を Date オブジェクトに変換
  parse: (value, culture) => {
    const dt = DateTime.fromISO(value);
    return dt.isValid ? dt.toJSDate() : null;
  },
  // Date オブジェクトを指定のフォーマットに変換
  format: (date, format, culture) => {
    return DateTime.fromJSDate(date).toFormat(format);
  },
  // 週の開始日（0: Sunday、1: Monday など）を返す。ここでは Sunday を指定
  startOfWeek: () => 0,
  // 指定した日付の曜日を返す（0: Sunday～6: Saturday）
  getDay: (date) => {
    // Luxon の weekday は 1 (Monday) ～ 7 (Sunday) なので、変換する
    const weekday = DateTime.fromJSDate(date).weekday;
    return weekday % 7; // Sunday (7) becomes 0, Monday (1) becomes 1, etc.
  },
};

export default luxonLocalizer;