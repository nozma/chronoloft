export function clearUiSettings() {
    const PREFIXES = [
        'uiState',      // UI の開閉状態
        'filterState',  // フィルタ
        'chart.',       // Chart*
        'calendar.',    // Calendar*
    ];

    Object.keys(localStorage).forEach((key) => {
        // バージョンキー (":v") も同じ接頭辞なので一緒に削除
        if (PREFIXES.some((p) => key.startsWith(p))) {
            localStorage.removeItem(key);
        }
    });
}