// frontend/src/components/Stopwatch.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { startDiscordPresence, stopDiscordPresence } from '../services/api';
import getIconForGroup from '../utils/getIconForGroup';

function Stopwatch({ onComplete, onCancel, discordData, activityName, activityGroup }) {
    const [displayTime, setDisplayTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [restored, setRestored] = useState(false);
    const timerRef = useRef(null);

    // startTime と offset を useRef で管理する
    const startTimeRef = useRef(null);
    const offsetRef = useRef(0);

    // ローカルストレージから状態を復元し、保存状態がなければ自動開始する
    useEffect(() => {
        const savedState = localStorage.getItem('stopwatchState');
        if (savedState) {
            const state = JSON.parse(savedState);
            startTimeRef.current = state.startTime;
            offsetRef.current = state.offset;
            setDisplayTime(state.displayTime);
            setIsRunning(state.isRunning);
            setIsPaused(state.isPaused);
        } else {
            handleStart();
        }
        setRestored(true);
    }, []);

    // 復元が完了してから状態が変化するたびに localStorage に保存する
    useEffect(() => {
        if (!restored) return; // 復元前は保存しない
        const state = {
            startTime: startTimeRef.current,
            offset: offsetRef.current,
            displayTime,
            isRunning,
            isPaused,
        };
        localStorage.setItem('stopwatchState', JSON.stringify(state));
    }, [displayTime, isRunning, isPaused, restored]);

    useEffect(() => {
        if (isRunning && !timerRef.current) {
            // すでにタイマーが動作していなければ setInterval を開始
            timerRef.current = setInterval(updateDisplayTime, 1000);
        }
        // isRunning が false になった場合はタイマーをクリア
        if (!isRunning && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        // クリーンアップ: コンポーネントアンマウント時にタイマーをクリア
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRunning]);

    // 現在時刻と startTime の差分に offset を加えて displayTime を更新
    const updateDisplayTime = () => {
        if (startTimeRef.current !== null) {
            const elapsed = Date.now() - startTimeRef.current + offsetRef.current;
            setDisplayTime(elapsed);
        }
    };

    const handleStart = async () => {
        if (startTimeRef.current) { return; } // 二重に起動しない
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
        timerRef.current = setInterval(updateDisplayTime, 1000); // 1s ごとに更新
    };

    const handleTogglePause = () => {
        if (isPaused) {
            // Resume: 再開する際、startTime を更新
            startTimeRef.current = Date.now();
            setIsPaused(false);
            setIsRunning(true);
            timerRef.current = setInterval(updateDisplayTime, 1000);
        } else {
            // Pause: 現在時刻との差分を offset に加算し、タイマーを停止
            clearInterval(timerRef.current);
            if (startTimeRef.current !== null) {
                const elapsed = Date.now() - startTimeRef.current;
                offsetRef.current += elapsed;
            }
            setIsPaused(true);
            setIsRunning(false);
        }
    };

    const handleComplete = async () => {
        clearInterval(timerRef.current);
        setIsRunning(false);
        try {
            await stopDiscordPresence({ group: discordData.group });
            console.log('Discord presence stopped');
        } catch (error) {
            console.error('Failed to stop Discord presence:', error);
        }
        // 完了時は offset と (もし動作中なら) 現在時刻との差分の合計を分単位に換算して渡す
        let totalElapsed = offsetRef.current;
        if (startTimeRef.current !== null && isRunning) {
            totalElapsed += Date.now() - startTimeRef.current;
        }
        localStorage.removeItem('stopwatchState');
        onComplete(totalElapsed / 60000);
    };

    const handleCancel = async () => {
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
        localStorage.removeItem('stopwatchState');
        onCancel();
    };

    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}時間${minutes}分${seconds}秒`;
    };

    return (
        <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {getIconForGroup(activityGroup)}
                {activityName}
            </Typography>
            <Typography variant="h4">{formatTime(displayTime)}</Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button variant="contained" onClick={handleTogglePause}>
                    {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="contained" color="primary" onClick={handleComplete}>
                    完了
                </Button>
                <Button variant="outlined" color="error" onClick={handleCancel}>
                    キャンセル
                </Button>
            </Box>
        </Box>
    );
}

export default Stopwatch;