import React, { useState, useEffect, useRef } from 'react';
import { Button, Typography, Box } from '@mui/material';

function Stopwatch({ onComplete, onCancel }) {
    // 計測開始時刻、経過時間、停止状態を管理する
    const [elapsed, setElapsed] = useState(0); // 経過秒数
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const timerRef = useRef(null);

    // ストップウォッチの開始
    const handleStart = () => {
        setIsRunning(true);
        setIsPaused(false);
        // タイマー開始（1秒ごとに更新）
        timerRef.current = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);
    };

    // 一時停止／再開
    const handleTogglePause = () => {
        if (isPaused) {
            // 再開
            setIsPaused(false);
            timerRef.current = setInterval(() => {
                setElapsed((prev) => prev + 1);
            }, 1000);
        } else {
            // 一時停止
            setIsPaused(true);
            clearInterval(timerRef.current);
        }
    };

    // 完了：経過時間を分単位に換算して onComplete コールバックに渡す
    const handleComplete = () => {
        clearInterval(timerRef.current);
        setIsRunning(false);
        // 経過秒数を分に変換（小数点以下も必要なら調整可能）
        const minutes = elapsed / 60;
        onComplete(minutes);
    };

    // キャンセル：タイマー停止し onCancel を呼ぶ
    const handleCancel = () => {
        clearInterval(timerRef.current);
        setIsRunning(false);
        setElapsed(0);
        onCancel();
    };

    // コンポーネントがアンマウントされた場合のクリーンアップ
    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    // 表示用に経過時間を「h時間m分s秒」に変換する例
    const formatTime = (sec) => {
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec % 3600) / 60);
        const seconds = sec % 60;
        return `${hours}時間${minutes}分${seconds}秒`;
    };

    return (
        <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h6">ストップウォッチ</Typography>
            <Typography variant="h4">{formatTime(elapsed)}</Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!isRunning ? (
                    <Button variant="contained" color="primary" onClick={handleStart}>
                        Start
                    </Button>
                ) : (
                    <>
                        <Button variant="contained" onClick={handleTogglePause}>
                            {isPaused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button variant="contained" color="primary" onClick={() => {
                            console.log("Stopwatch: 完了ボタンがクリックされました"); handleComplete();
                        }}>
                            完了
                        </Button>
                        <Button variant="outlined" color="error" onClick={handleCancel}>
                            キャンセル
                        </Button>
                    </>
                )}
            </Box>
        </Box>
    );
}

export default Stopwatch;