/**
 * 指定したアクティビティIDに対する累計時間の詳細を計算する関数
 * @param {number} activityId - 対象のアクティビティID
 * @param {Array} records - 全レコードの配列
 * @returns {string} - 「30日間の累計時間 / 30日 (合計全体の時間)」の形式の文字列
 */
export function calculateTimeDetails(activityId, records) {
    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    // activity_idが一致するレコードを抽出
    const activityRecords = records.filter(rec => rec.activity_id === activityId);
    const totalOverall = activityRecords.reduce((sum, rec) => sum + rec.value, 0);
    const totalLast30Days = activityRecords
        .filter(rec => new Date(rec.created_at) >= last30Days)
        .reduce((sum, rec) => sum + rec.value, 0);

    // 時間表示をフォーマットするヘルパー
    const formatTime30Days = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hrs}時間${mins}分`;
    };
    const formatTimeTotal = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        return `${hrs}時間`;
    };

    return `${formatTime30Days(totalLast30Days)}/30日 (合計${formatTimeTotal(totalOverall)})`;
}