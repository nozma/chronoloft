/**
 * イベントを日付で分割する関数
 * イベントが複数日にまたがる場合、各日のイベントを生成する
 * @param {Object} event - { id, title, start: Date, end: Date, ... }
 * @returns {Array} 分割されたイベントの配列
 */
export function splitEvent(event) {
    const { id, title, start, end, ...rest } = event;
    const events = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
  
    // 同じ日ならそのまま返す
    if (startDate.toDateString() === endDate.toDateString()) {
      return [event];
    }
  
    let currentStart = new Date(startDate);
    while (currentStart < endDate) {
      // 終了日は当日の終わり（23:59:59.999）か、実際の終了時刻のうち早い方
      const currentEnd = new Date(currentStart);
      currentEnd.setHours(23, 59, 59, 999);
      if (currentEnd > endDate) {
        currentEnd.setTime(endDate.getTime());
      }
  
      events.push({
        id: `${id}-${currentStart.toDateString()}`, // 各イベントを一意にするため日付を付与
        title,
        start: new Date(currentStart),
        end: new Date(currentEnd),
        allDay: false,
        ...rest,
      });
  
      // 次の日の0:00に設定
      currentStart.setDate(currentStart.getDate() + 1);
      currentStart.setHours(0, 0, 0, 0);
    }
  
    return events;
  }