import { DateTime } from 'luxon';

export function formatToLocal(isoDateString, options = DateTime.DATETIME_MED) {
  // 受け取ったISO 8601形式の日時をUTCとして解釈し、ローカルタイムに変換する
  return DateTime.fromISO(isoDateString, { zone: 'utc' })
    .setZone(DateTime.local().zoneName)
    .toLocaleString(options);
}