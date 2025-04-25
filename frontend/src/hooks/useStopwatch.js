import { useState, useEffect, useRef } from 'react';
import { startDiscordPresence, stopDiscordPresence } from '../services/api';

/**
 * useStopwatch
 *
 * @param {string} storageKey - localStorage用のキー
 * @param {Object|null} discordData - Discord連携用データ（null可）
 * @param {Object} callbacks - { onComplete, onCancel }
 *
 * このカスタムフックではストップウォッチの管理を行う。
 * - 起動や停止、計測時間の更新
 * - Discord連携の開始・停止
 * - localStorageに計測状態を保存・復元
 */
function useStopwatch(storageKey, initialDiscordData, { onComplete, onCancel }) {

    const [displayTime, setDisplayTime] = useState(0); // ストップウォッチの経過時間(ms)
    const [restored, setRestored] = useState(false); // localStorageからの復元完了フラグ
    const [currentStartTime, setCurrentStartTime] = useState(null); // 開始時刻
    const [memo, setMemo] = useState(''); // メモ
    const [discordData, setDiscordData] = useState(initialDiscordData); // Discordデータ
    const [isDiscordBusy, setIsDiscordBusy] = useState(false); // DiscordAPI呼び出し中フラグ

    const timerRef = useRef(null); // setIntervalのID保持
    const discordLockRef = useRef(false); // Discord連係処理のリクエストが走っているかのRef

    // -----------------------------------------------
    // マウント時の処理： 
    //   localStorageから以前のストップウォッチ状態を復元（復元終了後、restored=true とする）
    //   なければ自動でhandleStart()（ストップウォッチを開始）
    // -----------------------------------------------
    useEffect(() => {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            const state = JSON.parse(savedState);
            // 開始時刻や表示中時間をRefやstateに復元
            setCurrentStartTime(state.startTime);
            setDisplayTime(state.displayTime);
            setMemo(state.memo);
        } else {
            // localStorageに何もない場合は自動で開始
            handleStart();
        }
        setRestored(true);
    }, [storageKey]);

    // -----------------------------------------------
    // displayTime が変わるたびにlocalStorageに最新状態を保存する
    // -----------------------------------------------
    useEffect(() => {
        if (!restored) return; // まだ復元が終わっていないならスキップ
        const state = {
            startTime: currentStartTime,
            displayTime,
            memo
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
    }, [currentStartTime, displayTime, restored, memo, storageKey]);

    // -----------------------------------------------
    // ストップウォッチの稼働状態管理
    // -----------------------------------------------
    useEffect(() => {
        // ストップウォッチがRunningならtimerを起動
        if (currentStartTime !== null && !timerRef.current) {
            timerRef.current = setInterval(updateDisplayTime, 1000);
        }
        // 止まったらtimerをクリア
        if (currentStartTime === null && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // アンマウントや依存変化時にtimerをクリア
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [currentStartTime]);

    // -----------------------------------------------
    // ストップウォッチ起動中、currentStartTimeからの経過時間を計算して displayTimeに反映
    // -----------------------------------------------
    const updateDisplayTime = () => {
        if (currentStartTime !== null) {
            const elapsed = Date.now() - currentStartTime;
            setDisplayTime(elapsed);
        }
    };

    // -----------------------------------------------
    // ストップウォッチ開始
    // currentStartTime が nullなら開始処理、そうでなければ無視
    // Discord連携も開始し、timerをスタートする
    // -----------------------------------------------
    const handleStart = async (newDiscordData, force = false) => {
        // 強制開始無効かつ既に開始済みなら何もせずreturn
        if (!force && currentStartTime !== null) return;

        const now = Date.now();
        setCurrentStartTime(now);

        // Discord連携を開始（新しいデータが有ればそちらを優先）
        const discordDataToUse = newDiscordData || discordData;
        setDiscordData(discordDataToUse);
        if (discordDataToUse && !discordLockRef.current) {
            setIsDiscordBusy(true);
            discordLockRef.current = true;
            try {
                await startDiscordPresence(discordDataToUse);
                console.log('Discord presence started');
            } catch (error) {
                console.error('Failed to start Discord presence:', error);
            } finally {
                discordLockRef.current = false;
                setIsDiscordBusy(false);
            }
        }
    };

    // -----------------------------------------------
    // ストップウォッチ停止処理
    //   * タイマーを止める
    //   * Discord連係を止める
    //   * localStorageを削除し、内部状態もリセット
    //   * 経過時間(ms)を返す
    // -----------------------------------------------
    async function stopNow() {
        // Discord停止
        if (discordData && !discordLockRef.current) {
            setIsDiscordBusy(true);
            discordLockRef.current = true;
            try {
                await stopDiscordPresence({ group: discordData.group });
                console.log('Discord presence stopped');
            } catch (error) {
                console.error('Failed to stop Discord presence:', error);
            } finally {
                discordLockRef.current = false;
                setIsDiscordBusy(false);
            }
        }
        // 経過時間(ms)計算
        let totalElapsed = 0;
        if (currentStartTime !== null) {
            totalElapsed = Date.now() - currentStartTime;
        }
        // リセット
        localStorage.removeItem(storageKey);
        setCurrentStartTime(null);
        setDisplayTime(0);
        setMemo('');

        return totalElapsed;
    }

    // -----------------------------------------------
    // 計測完了
    // -----------------------------------------------
    const complete = async (passedMemo) => {
        const totalElapsed = await stopNow();
        if (onComplete) onComplete(totalElapsed / 60000, passedMemo);
    };

    // -----------------------------------------------
    // 今走っているストップウォッチを完了し、すぐ次の計測を開始する
    // -----------------------------------------------
    const finishAndReset = async (newDiscordData) => {
        const memoSnapshot = memo;
        let totalElapsed = await stopNow();
        await handleStart(newDiscordData, true);
        return { minutes: totalElapsed / 60000, memo: memoSnapshot };
    };

    // -----------------------------------------------
    // キャンセル
    // -----------------------------------------------
    const cancel = async () => {
        await stopNow();
        if (onCancel) onCancel();
    };

    // -----------------------------------------------
    // 開始時刻の変更
    // -----------------------------------------------
    const updateStartTime = (newStartTime) => {
        if (newStartTime > Date.now()) {
            throw new Error("Start time cannot be in the future");
        }
        setCurrentStartTime(newStartTime);
        // 表示用の経過時間を計算
        const elapsed = Date.now() - newStartTime;
        setDisplayTime(elapsed);
    };

    const isRunning = (currentStartTime !== null);
    return {
        displayTime,       // 現在の経過時間（ms）
        isRunning,         // 動作中かどうか
        start: handleStart,// 手動で開始するため
        complete,          // 完了処理
        cancel,            // キャンセル処理
        updateStartTime,   // 開始時刻を編集
        currentStartTime,  // 現在の開始時刻
        finishAndReset,    // 現在の計測を完了し、すぐ次を開始
        memo,              // メモ文字列
        setMemo,           // メモのsetter
        isDiscordBusy,     // DiscordAPIリクエスト送信中フラグ
    };
}

export default useStopwatch;