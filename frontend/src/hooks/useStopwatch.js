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
function useStopwatch(storageKey, discordData, { onComplete, onCancel }) {

    // -----------------------------------------------
    // ストップウォッチの経過時間(ms)を表示するための状態
    // -----------------------------------------------
    const [displayTime, setDisplayTime] = useState(0);

    // -----------------------------------------------
    // ストップウォッチが動いているかどうか
    // -----------------------------------------------
    const [isRunning, setIsRunning] = useState(false);

    // -----------------------------------------------
    // localStorageからの状態復元が完了したかどうか
    //  （復元完了前に保存が走らないようフラグ管理）
    // -----------------------------------------------
    const [restored, setRestored] = useState(false);

    // -----------------------------------------------
    // 現在の開始時刻(ミリ秒)を保持する。UIで表示したり編集に使う
    // -----------------------------------------------
    const [currentStartTime, setCurrentStartTime] = useState(null);

    // -----------------------------------------------
    // メモ（Discordの詳細ステータスなどに利用可能）
    // -----------------------------------------------
    const [memo, setMemo] = useState('');

    // -----------------------------------------------
    // setIntervalのIDを保持するためのRef
    // タブがアクティブな間、1秒ごとにupdateDisplayTimeを呼び出す
    // -----------------------------------------------
    const timerRef = useRef(null);

    // -----------------------------------------------
    // 実際の開始時刻をRefで保存。startTimeRef.current が nullでなければ「開始済み」とみなす
    // -----------------------------------------------
    const startTimeRef = useRef(null);

    // -----------------------------------------------
    // 最新のisRunningの値を参照するためのRef
    // setInterval内やコールバックで staleにならないように
    // -----------------------------------------------
    const isRunningRef = useRef(isRunning);

    // isRunningが更新されるたびにisRunningRefを最新化
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    // -----------------------------------------------
    // マウント時： localStorageから以前のストップウォッチ状態を復元
    // なければ自動でhandleStart()（ストップウォッチを開始）
    // 復元終了後、restored=true とする
    // -----------------------------------------------
    useEffect(() => {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            const state = JSON.parse(savedState);
            // 開始時刻や表示中時間をRefやstateに復元
            startTimeRef.current = state.startTime;
            setDisplayTime(state.displayTime);
            setIsRunning(state.isRunning);
            setCurrentStartTime(state.startTime);

            // メモが文字列なら復元
            if (typeof state.memo === 'string') {
                setMemo(state.memo);
            }
        } else {
            // localStorageに何もない場合は自動で開始
            handleStart();
        }
        setRestored(true);
    }, [storageKey]);

    // -----------------------------------------------
    // displayTime や isRunning が変わるたびに
    // localStorageに最新状態を保存する
    // ただし、まだ復元が終わっていないならスキップ
    // -----------------------------------------------
    useEffect(() => {
        if (!restored) return;
        const state = {
            startTime: startTimeRef.current,
            displayTime,
            isRunning,
            memo
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
    }, [displayTime, isRunning, restored, memo, storageKey]);

    // -----------------------------------------------
    // isRunning の状態に応じて timerRef をセット・クリア
    // 毎秒 updateDisplayTime を呼び続ける or 止める
    // -----------------------------------------------
    useEffect(() => {
        // ストップウォッチがRunningならtimerを起動
        if (isRunning && !timerRef.current) {
            timerRef.current = setInterval(updateDisplayTime, 1000);
        }
        // 止まったらtimerをクリア
        if (!isRunning && timerRef.current) {
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
    }, [isRunning]);

    // -----------------------------------------------
    // 毎秒呼ばれる関数。isRunningRef.current がtrueなら、
    // startTimeRefからの経過時間を計算して displayTimeに反映
    // -----------------------------------------------
    const updateDisplayTime = () => {
        if (!isRunningRef.current) return;
        if (startTimeRef.current !== null) {
            const elapsed = Date.now() - startTimeRef.current;
            setDisplayTime(elapsed);
        }
    };

    // -----------------------------------------------
    // ストップウォッチ開始
    // startTimeRef が nullなら開始処理、そうでなければ無視
    // Discord連携も開始し、timerをスタートする
    // -----------------------------------------------
    const handleStart = async (newDiscordData) => {
        // 既に開始済みなら何もせずreturn
        if (startTimeRef.current) return;

        const now = Date.now();
        startTimeRef.current = now;
        setIsRunning(true);
        setCurrentStartTime(now);

        // Discord連携を開始（新しいデータが有ればそちらを優先）
        const discordDataToUse = newDiscordData || discordData;
        if (discordDataToUse) {
            try {
                await startDiscordPresence(discordDataToUse);
                console.log('Discord presence started');
            } catch (error) {
                console.error('Failed to start Discord presence:', error);
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
        // 1) タイマーを止める
        setIsRunning(false);

        // 2) Discord停止
        if (discordData) {
            try {
                await stopDiscordPresence({ group: discordData.group });
                console.log('Discord presence stopped');
            } catch (error) {
                console.error('Failed to stop Discord presence:', error);
            }
        }

        // 3) 経過時間(ms)を計算
        let totalElapsed = 0;
        if (startTimeRef.current !== null && isRunning) {
            totalElapsed = Date.now() - startTimeRef.current;
        }

        // 4) localStorage削除＋内部変数リセット
        localStorage.removeItem(storageKey);
        startTimeRef.current = null;
        setDisplayTime(0);
        setMemo('');

        // 5) 経過時間を返す
        return totalElapsed;
    }

    // -----------------------------------------------
    // 計測完了（ユーザーがStopボタンを押した等）
    // 経過時間を確定して localStorageをクリア
    // Discordを停止し、onCompleteコールバックを呼ぶ
    // -----------------------------------------------
    const complete = async (passedMemo) => {
        // 停止及び経過時間の取得
        const totalElapsed = await stopNow();

        // 親コールバックで使用
        if (onComplete) onComplete(totalElapsed / 60000, passedMemo);
    };

    // -----------------------------------------------
    // 今走っているストップウォッチを完了し、すぐ次の計測を開始する
    // （例：アクティビティ切替時などに使う）
    // -----------------------------------------------
    const finishAndReset = async (newDiscordData) => {
        // 停止及び経過時間の取得、状態のリセット
        let totalElapsed = await stopNow();

        // ストップウォッチを開始（+必要に応じて新しいDiscordデータで連係）
        handleStart(newDiscordData);

        // finishしたアクティビティにかかった分数を返す
        return totalElapsed / 60000;
    };

    // -----------------------------------------------
    // キャンセル（計測結果を破棄して停止）
    // -----------------------------------------------
    const cancel = async () => {
        await stopNow();
        if (onCancel) onCancel();
    };

    // -----------------------------------------------
    // 開始時刻を後から変更する（ユーザーが開始時刻を手動編集 等）
    // -----------------------------------------------
    const updateStartTime = (newStartTime) => {
        if (newStartTime > Date.now()) {
            throw new Error("Start time cannot be in the future");
        }
        startTimeRef.current = newStartTime;
        setCurrentStartTime(newStartTime);

        // 現在時刻との差から表示用の経過時間を再計算
        const elapsed = Date.now() - newStartTime;
        setDisplayTime(elapsed);
    };

    // -----------------------------------------------
    // フックが返す操作やステート
    // -----------------------------------------------
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
    };
}

export default useStopwatch;