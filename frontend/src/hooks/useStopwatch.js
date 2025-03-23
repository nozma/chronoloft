import { useState, useEffect, useRef } from 'react';
import { startDiscordPresence, stopDiscordPresence } from '../services/api';

/**
 * useStopwatch
 * @param {string} storageKey - localStorage 用のキー
 * @param {Object|null} discordData - Discord連携用データ（null可）
 * @param {Object} callbacks - { onComplete, onCancel }
 */
function useStopwatch(storageKey, discordData, { onComplete, onCancel }) {
    const [displayTime, setDisplayTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [restored, setRestored] = useState(false);
    const [currentStartTime, setCurrentStartTime] = useState(null);
    const [memo, setMemo] = useState('');
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const offsetRef = useRef(0);

    const isRunningRef = useRef(isRunning);
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            const state = JSON.parse(savedState);
            startTimeRef.current = state.startTime;
            offsetRef.current = state.offset;
            setDisplayTime(state.displayTime);
            setIsRunning(state.isRunning);
            setCurrentStartTime(state.startTime);
            if (typeof state.memo === 'string') {
                setMemo(state.memo);
            }
        } else {
            handleStart();
        }
        setRestored(true);
    }, [storageKey]);

    useEffect(() => {
        if (!restored) return;
        const state = {
            startTime: startTimeRef.current,
            offset: offsetRef.current,
            displayTime,
            isRunning,
            memo
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
    }, [displayTime, isRunning, restored, memo, storageKey]);

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
        if (startTimeRef.current) return;
        const now = Date.now();
        startTimeRef.current = now;
        offsetRef.current = 0;
        setIsRunning(true);
        setCurrentStartTime(now);
        if (discordData) {
            try {
                await startDiscordPresence(discordData);
                console.log('Discord presence started');
            } catch (error) {
                console.error('Failed to start Discord presence:', error);
            }
        }
        timerRef.current = setInterval(updateDisplayTime, 1000);
    };

    const complete = async (passedMemo) => {
        clearInterval(timerRef.current);
        setIsRunning(false);
        if (discordData) {
            try {
                await stopDiscordPresence({ group: discordData.group });
                console.log('Discord presence stopped');
            } catch (error) {
                console.error('Failed to stop Discord presence:', error);
            }
        }
        let totalElapsed = offsetRef.current;
        if (startTimeRef.current !== null && isRunning) {
            totalElapsed += Date.now() - startTimeRef.current;
        }
        localStorage.removeItem(storageKey);
        startTimeRef.current = null;
        offsetRef.current = 0;
        setDisplayTime(0);
        setMemo('');
        if (onComplete) onComplete(totalElapsed / 60000, passedMemo);
    };

    const finishAndReset = async (newDiscordData) => {
        const wasRunning = isRunning;
        clearInterval(timerRef.current);

        let totalElapsed = offsetRef.current;
        if (startTimeRef.current !== null && wasRunning) {
            totalElapsed += Date.now() - startTimeRef.current;
        }

        if (discordData) {
            try {
                await stopDiscordPresence({ group: discordData.group });
                console.log('Discord presence stopped');
            } catch (error) {
                console.error('Failed to stop Discord presence:', error);
            }
        }

        const minutes = totalElapsed / 60000;
        startTimeRef.current = Date.now();
        offsetRef.current = 0;
        setDisplayTime(0);
        setMemo('');
        setIsRunning(true);
        timerRef.current = setInterval(updateDisplayTime, 1000);

        if (newDiscordData) {
            try {
                await startDiscordPresence(newDiscordData);
                console.log('Discord presence restarted with new data');
            } catch (error) {
                console.error('Failed to restart Discord presence:', error);
            }
        }

        return minutes;
    };

    const cancel = async () => {
        clearInterval(timerRef.current);
        setIsRunning(false);
        if (discordData) {
            try {
                await stopDiscordPresence({ group: discordData.group });
                console.log('Discord presence stopped on cancel');
            } catch (error) {
                console.error('Failed to stop Discord presence:', error);
            }
        }
        offsetRef.current = 0;
        startTimeRef.current = null;
        setDisplayTime(0);
        localStorage.removeItem(storageKey);
        if (onCancel) onCancel();
    };

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
        start: handleStart,
        complete,
        cancel,
        updateStartTime,
        currentStartTime,
        finishAndReset,
        memo,
        setMemo,
    };
}

export default useStopwatch;