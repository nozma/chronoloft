import { useReducer, useEffect } from 'react';

/**
 * Reducer ベースの state を localStorage に永続化するヘルパー。
 *
 * @param {Function} reducer
 * @param {*}        initialState
 * @param {string}   storageKey  localStorage のキー
 * @returns {[any, Function]}    [state, dispatch]
 */
const SCHEMA_VERSION = 1; // 保存されるデータスキーマに変更があった場合、バージョンを更新する
export default function usePersistentReducer(reducer, initialState, storageKey) {
    // ─────────────── 初期化 ───────────────
    const init = () => {
        try {
            // バージョン不一致なら無視
            const ver = localStorage.getItem(`${storageKey}:v`);
            if (ver !== String(SCHEMA_VERSION)) throw new Error('version mismatch');

            const loaded = JSON.parse(localStorage.getItem(storageKey));
            return loaded ? { ...initialState, ...loaded } : initialState;
        } catch {
            return initialState;
        }
    };

    const [state, dispatch] = useReducer(reducer, initialState, init);

    // ─────────────── 保存 ───────────────
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
            localStorage.setItem(`${storageKey}:v`, SCHEMA_VERSION);  // ★ バージョン書き込み
        } catch (e) {
            console.error('Failed to persist UI state:', e);
        }
    }, [state, storageKey]);

    return [state, dispatch];
}
