import { useState, useEffect } from 'react';

/**
 * 指定したキーのローカルストレージの値を状態として管理するカスタムフック
 * @param {string} key - ローカルストレージのキー
 * @param {*} defaultValue - 初期値
 * @returns {[any, Function]} - 現在の状態と状態を更新する関数
 */
function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error(`Error parsing localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      if (state === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}

export default useLocalStorageState;