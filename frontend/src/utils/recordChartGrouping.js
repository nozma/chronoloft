// 表示名の区切り文字に依存せず、アクティビティと詳細を識別する。
export function getActivityMemoKey(record) {
    return `activityMemo:${JSON.stringify([
        record.activity_id ?? null,
        record.activity_id == null ? record.activity_name || '' : null,
        record.memo || '',
    ])}`;
}
