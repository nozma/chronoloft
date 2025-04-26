import { useReducer, useEffect } from 'react';

/**
 * Reducer ベースの state を localStorage に永続化するヘルパー。
 *
 * @param {Function} reducer
 * @param {*}        initialState
 * @param {string}   storageKey  localStorage のキー
 * @returns {[any, Function]}    [state, dispatch]
 */
export default function usePersistentReducer(reducer, initialState, storageKey) {
  // ─────────────── 初期化 ───────────────
  const init = () => {
    try {
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
    } catch (e) {
      console.error('Failed to persist UI state:', e);
    }
  }, [state, storageKey]);

  return [state, dispatch];
}
