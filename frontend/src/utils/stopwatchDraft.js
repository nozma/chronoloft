// 自端末の変更を画面に即時反映し、保存時は詳細と開始時刻をまとめて送る。
export function createStopwatchDraft(save, onChange) {
    let changes = {};
    let base = null;
    let saving = null;
    return {
        get changes() { return changes; },
        update(item, patch) {
            if (!Object.keys(changes).length && !saving) base = item;
            changes = { ...changes, ...patch };
            onChange();
        },
        async flush(item) {
            if (saving) return saving;
            if (!Object.keys(changes).length) return item;
            saving = (async () => {
                while (Object.keys(changes).length) {
                    const sent = changes;
                    const result = await save(base, sent);
                    base = result.item;
                    // 通信中に追加された操作は消さず、更新後のリビジョンで続けて保存する。
                    changes = Object.fromEntries(Object.entries(changes).filter(([key, value]) => value !== sent[key]));
                    onChange();
                }
                return base;
            })();
            try { return await saving; }
            finally { saving = null; }
        },
    };
}
