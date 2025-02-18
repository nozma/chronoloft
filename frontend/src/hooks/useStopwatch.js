import { useState, useEffect, useRef } from 'react';
import { startDiscordPresence, stopDiscordPresence } from '../services/api';

const STORAGE_KEY = 'stopwatchState';

/**
 * useStopwatch
 * @param {Object} discordData - Discord連携用データ（例: { group, ... }）
 * @param {Object} callbacks - { onComplete, onCancel } コールバック
 * @returns {Object} - { displayTime, isRunning, isPaused, start, togglePause, complete, cancel }
 */
function useStopwatch(discordData, { onComplete, onCancel }) {
  const [displayTime, setDisplayTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [restored, setRestored] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const offsetRef = useRef(0);

  // 最新の isRunning を保持する ref
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // ローカルストレージから状態を復元。なければ自動スタート
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState);
      startTimeRef.current = state.startTime;
      offsetRef.current = state.offset;
      setDisplayTime(state.displayTime);
      setIsRunning(state.isRunning);
      setIsPaused(state.isPaused);
    } else {
      start();
    }
    setRestored(true);
  }, []);

  // 復元後、状態変化時にローカルストレージへ保存
  useEffect(() => {
    if (!restored) return;
    const state = {
      startTime: startTimeRef.current,
      offset: offsetRef.current,
      displayTime,
      isRunning,
      isPaused,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [displayTime, isRunning, isPaused, restored]);

  // タイマー処理（setInterval）の管理
  useEffect(() => {
    if (isRunning && !timerRef.current) {
      timerRef.current = setInterval(updateDisplayTime, 1000);
    }
    if (!isRunning && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]);

  const updateDisplayTime = () => {
    if (!isRunningRef.current) return;
    if (startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current + offsetRef.current;
      setDisplayTime(elapsed);
    }
  };

  const start = async () => {
    if (startTimeRef.current) return; // 既に開始済みなら何もしない
    const now = Date.now();
    startTimeRef.current = now;
    offsetRef.current = 0;
    setIsRunning(true);
    setIsPaused(false);
    try {
      await startDiscordPresence(discordData);
      console.log('Discord presence started');
    } catch (error) {
      console.error('Failed to start Discord presence:', error);
    }
    timerRef.current = setInterval(updateDisplayTime, 1000);
  };

  const togglePause = () => {
    if (isPaused) {
      // 再開: 現在時刻を新たな startTime とする
      startTimeRef.current = Date.now();
      setIsPaused(false);
      setIsRunning(true);
      timerRef.current = setInterval(updateDisplayTime, 1000);
    } else {
      // 一時停止: 現在時刻との差分を offset に追加しタイマー停止
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (startTimeRef.current !== null) {
        const elapsed = Date.now() - startTimeRef.current;
        offsetRef.current += elapsed;
      }
      setIsPaused(true);
      setIsRunning(false);
    }
  };

  const complete = async () => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    try {
      await stopDiscordPresence({ group: discordData.group });
      console.log('Discord presence stopped');
    } catch (error) {
      console.error('Failed to stop Discord presence:', error);
    }
    let totalElapsed = offsetRef.current;
    if (startTimeRef.current !== null && isRunning) {
      totalElapsed += Date.now() - startTimeRef.current;
    }
    localStorage.removeItem(STORAGE_KEY);
    if (onComplete) onComplete(totalElapsed / 60000); // 分単位に換算
  };

  const cancel = async () => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    try {
      await stopDiscordPresence({ group: discordData.group });
      console.log('Discord presence stopped on cancel');
    } catch (error) {
      console.error('Failed to stop Discord presence:', error);
    }
    offsetRef.current = 0;
    startTimeRef.current = null;
    setDisplayTime(0);
    localStorage.removeItem(STORAGE_KEY);
    if (onCancel) onCancel();
  };

  return { displayTime, isRunning, isPaused, start, togglePause, complete, cancel };
}

export default useStopwatch;