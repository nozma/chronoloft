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
    const [currentStartTime, setCurrentStartTime] = useState(null);
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
            setCurrentStartTime(state.startTime);
        } else {
            handleStart();
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

    const handleStart = async () => {
        if (startTimeRef.current) return; // 既に開始済みなら何もしない
        const now = Date.now();
        startTimeRef.current = now;
        offsetRef.current = 0;
        setIsRunning(true);
        setIsPaused(false);
        setCurrentStartTime(now);
        try {
            await startDiscordPresence(discordData);
            console.log('Discord presence started');
        } catch (error) {
            console.error('Failed to start Discord presence:', error);
        }
        timerRef.current = setInterval(updateDisplayTime, 1000);
    };

    const handleTogglePause = () => {
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
        startTimeRef.current = null;
        offsetRef.current = 0;
        setDisplayTime(0);
        if (onComplete) onComplete(totalElapsed / 60000); // 分単位に換算
    };

    // 完了して別のストップウォッチを開始する
    const finishAndReset = async (newDiscordData) => {
        // タイマーを停止する前に、現在の isRunning 状態を保持
        const wasRunning = isRunning;
        clearInterval(timerRef.current);

        // 経過時間の計算は、isRunning 状態が変更される前に行う
        let totalElapsed = offsetRef.current;
        if (startTimeRef.current !== null && wasRunning) {
            totalElapsed += Date.now() - startTimeRef.current;
        }

        // Discord の接続を一度だけ切断
        try {
            await stopDiscordPresence({ group: discordData.group });
            console.log('Discord presence stopped');
        } catch (error) {
            console.error('Failed to stop Discord presence:', error);
        }

        const minutes = totalElapsed / 60000;
        // 状態をリセットして新規記録に備える
        startTimeRef.current = Date.now();
        offsetRef.current = 0;
        setDisplayTime(0);
        setIsRunning(true);
        timerRef.current = setInterval(updateDisplayTime, 1000);
        // 新しいアクティビティデータでDisord presenceを再起動
        try {
            await startDiscordPresence(newDiscordData);
            console.log('Discord presence restarted with new data');
        } catch (error) {
            console.error('Failed to restart Discord presence:', error);
        }

        return minutes;
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

    // 開始時刻を更新する関数
    const updateStartTime = (newStartTime) => {
        if (newStartTime > Date.now()) {
            throw new Error("Start time cannot be in the future");
        }
        startTimeRef.current = newStartTime;
        setCurrentStartTime(newStartTime);
        const elapsed = Date.now() - newStartTime + offsetRef.current;
        setDisplayTime(elapsed);
    };

    return {
        displayTime,
        isRunning,
        isPaused,
        start: handleStart,
        togglePause: handleTogglePause,
        complete,
        cancel,
        updateStartTime,
        currentStartTime,
        finishAndReset
    };
}

export default useStopwatch;