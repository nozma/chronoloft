import { STOPWATCH_DETAILS_EVENT } from '../utils/stopwatchDetails';
import { useI18n } from '../i18n/I18nContext';
import { normalizeDetails } from '../utils/recordDetails';
import { useState, useEffect, useRef } from 'react';
import { startDiscordPresence, stopDiscordPresence } from '../services/api';
import { STOPWATCH_SYNC_EVENT } from '../contexts/RecordContext';

function createSessionId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // LAN内のHTTP接続ではrandomUUIDが使えないため、乱数からUUIDを生成する。
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
function useStopwatch(storageKey, initialDiscordData, { onComplete, onCancel, discordEnabled = true }) {
    const { t } = useI18n();

    const [displayTime, setDisplayTime] = useState(0); // ストップウォッチの経過時間(ms)
    const [restored, setRestored] = useState(false); // localStorageからの復元完了フラグ
    const [currentStartTime, setCurrentStartTime] = useState(null); // 開始時刻
    const [pausedStartTime, setPausedStartTime] = useState(null); // 一時停止時の開始時刻
    const [memo, setMemo] = useState(''); // メモ
    const [discordData, setDiscordData] = useState(initialDiscordData); // Discordデータ
    const [discordConnected, setDiscordConnected] = useState(false);
    const [isDiscordBusy, setIsDiscordBusy] = useState(false); // DiscordAPI呼び出し中フラグ

    const sessionRef = useRef(null);
    if (sessionRef.current === null) sessionRef.current = createSessionId();
    const stoppingRef = useRef(false);
    const memoRef = useRef(memo);
    memoRef.current = memo;
    const timerRef = useRef(null); // setIntervalのID保持
    const startRef = useRef(null); // 初期化時に最新の開始処理を参照する
    const discordQueueRef = useRef(Promise.resolve());
    const discordGenerationRef = useRef(0);
    const connectedDataRef = useRef(null);
    const pendingDiscordStartRef = useRef(null);
    const discordEnabledRef = useRef(discordEnabled);
    discordEnabledRef.current = discordEnabled;

    const notifyStopwatchSync = () => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(STOPWATCH_SYNC_EVENT));
    };

    const persistStopwatchState = (nextState) => {
        localStorage.setItem(storageKey, JSON.stringify({ ...nextState, sessionId: sessionRef.current }));
    };

    const persistStopwatchStateAndSync = (nextState) => {
        persistStopwatchState(nextState);
        notifyStopwatchSync();
    };

    const clearStopwatchStateAndSync = () => {
        localStorage.removeItem(storageKey);
        notifyStopwatchSync();
    };

    // 親コンポーネント側でDiscord連係対象が変わったら内部状態にも反映する
    useEffect(() => {
        setDiscordData(initialDiscordData);
    }, [initialDiscordData]);

    // 開始処理の変化では復元し直さず、キーが変わったときだけ最新の処理を使う
    useEffect(() => {
        startRef.current = handleStart;
    });

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
            setPausedStartTime(state.pausedStartTime ?? null);
            sessionRef.current = state.sessionId || sessionRef.current;
            setMemo(normalizeDetails(state.memo));
        } else {
            // localStorageに何もない場合は自動で開始
            startRef.current();
        }
        setRestored(true);
    }, [storageKey]);

    // -----------------------------------------------
    // displayTime が変わるたびにlocalStorageに最新状態を保存する
    // -----------------------------------------------
    useEffect(() => {
        if (!restored) return; // まだ復元が終わっていないならスキップ
        if (currentStartTime === null && pausedStartTime === null && displayTime === 0 && memo === '') {
            localStorage.removeItem(storageKey);
            return;
        }
        localStorage.setItem(storageKey, JSON.stringify({
            startTime: currentStartTime,
            pausedStartTime,
            displayTime,
            memo,
            sessionId: sessionRef.current
        }));
    }, [currentStartTime, pausedStartTime, displayTime, restored, memo, storageKey]);

    useEffect(() => {
        const handleDetails = ({ detail: request }) => {
            const { record } = request;
            if (record.stopwatch_key !== storageKey) return;
            const activityKey = storageKey === 'stopwatchState' ? 'selectedActivity' : 'subSelectedActivity';
            const activity = JSON.parse(localStorage.getItem(activityKey) || 'null');
            if (!restored || stoppingRef.current || (currentStartTime === null && pausedStartTime === null)) return;
            if (activity?.id !== record.activity_id || record.session_id !== sessionRef.current) return;
            if (memoRef.current !== record.memo) return;
            request.accepted = true;
            if (request.validateOnly) return;
            const nextMemo = normalizeDetails(request.memo);
            memoRef.current = nextMemo;
            setMemo(nextMemo);
            localStorage.setItem(storageKey, JSON.stringify({
                startTime: currentStartTime, pausedStartTime, displayTime, memo: nextMemo,
                sessionId: sessionRef.current,
            }));
            window.dispatchEvent(new CustomEvent(STOPWATCH_SYNC_EVENT));
        };
        window.addEventListener(STOPWATCH_DETAILS_EVENT, handleDetails);
        return () => window.removeEventListener(STOPWATCH_DETAILS_EVENT, handleDetails);
    }, [storageKey, restored, currentStartTime, pausedStartTime, displayTime]);

    // -----------------------------------------------
    // ストップウォッチの稼働状態管理
    // -----------------------------------------------
    useEffect(() => {
        // ストップウォッチがRunningならtimerを起動
        if (currentStartTime !== null && !timerRef.current) {
            timerRef.current = setInterval(() => {
                setDisplayTime(Date.now() - currentStartTime);
            }, 1000);
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
    // ストップウォッチ開始
    // currentStartTime が nullなら開始処理、そうでなければ無視
    // Discord連携も開始し、timerをスタートする
    // -----------------------------------------------
    const handleStart = async (newDiscordData, force = false) => {
        // 強制開始無効かつ既に開始済みなら何もせずreturn
        if (!force && currentStartTime !== null) return;

        stoppingRef.current = false;
        sessionRef.current = createSessionId();
        const now = Date.now();
        setCurrentStartTime(now);
        setPausedStartTime(null);
        setDisplayTime(0);
        persistStopwatchStateAndSync({
            startTime: now,
            pausedStartTime: null,
            displayTime: 0,
            memo
        });

        // Discord連携を開始（新しいデータが有ればそちらを優先）
        const discordDataToUse = newDiscordData === undefined ? discordData : newDiscordData;
        setDiscordData(discordDataToUse);
        await startDiscordIfNeeded(discordDataToUse, now);
    };

    // 開始・停止を順に実行し、停止要求後に古い開始要求が復活することを防ぐ。
    const enqueueDiscord = (operation) => {
        const request = discordQueueRef.current.then(async () => {
            setIsDiscordBusy(true);
            try {
                await operation();
            } catch (error) {
                setDiscordConnected(false);
                console.error('Discord presence request failed:', error);
            } finally {
                setIsDiscordBusy(false);
            }
        });
        discordQueueRef.current = request;
        return request;
    };

    const stopDiscordIfNeeded = () => {
        discordGenerationRef.current += 1;
        pendingDiscordStartRef.current = null;
        const data = connectedDataRef.current || discordData;
        const sessionId = sessionRef.current;
        return enqueueDiscord(async () => {
            if (!data) return;
            await stopDiscordPresence({ group: data.group, session_id: sessionId });
            connectedDataRef.current = null;
            setDiscordConnected(false);
        });
    };

    const startDiscordIfNeeded = (data, startTime = currentStartTime) => {
        if (!discordEnabledRef.current || !data || startTime === null || stoppingRef.current) return Promise.resolve();
        const generation = discordGenerationRef.current;
        const sessionId = sessionRef.current;
        // 旧保存データに詳細が残っていても、Discordへ送る情報には含めない。
        const presenceData = { group: data.group, activity_name: data.activity_name, asset_key: data.asset_key };
        const requestKey = JSON.stringify([sessionId, presenceData, startTime]);
        if (pendingDiscordStartRef.current?.key === requestKey) {
            return pendingDiscordStartRef.current.promise;
        }
        const pending = { key: requestKey };
        pending.promise = enqueueDiscord(async () => {
            if (!discordEnabledRef.current || generation !== discordGenerationRef.current || stoppingRef.current) return;
            await startDiscordPresence({
                ...presenceData,
                session_id: sessionId,
                start_time: startTime / 1000,
            });
            connectedDataRef.current = data;
            setDiscordConnected(discordEnabledRef.current);
        }).finally(() => {
            if (pendingDiscordStartRef.current === pending) pendingDiscordStartRef.current = null;
        });
        pendingDiscordStartRef.current = pending;
        return pending.promise;
    };

    const refreshDiscord = () => {
        return startDiscordIfNeeded(discordData);
    };

    useEffect(() => () => {
        // 画面を切り替えた後に古い待機要求を実行しない。
        discordGenerationRef.current += 1;
        pendingDiscordStartRef.current = null;
    }, []);

    // 設定OFFでは待機中の開始要求も取り消し、進行中の通信の後に停止する。
    useEffect(() => {
        if (!discordEnabled) stopDiscordIfNeeded();
    }, [discordEnabled]);

    // 復元時と稼働中に接続を確認し、Discordやバックエンドの再起動から復帰する。
    useEffect(() => {
        if (!discordEnabled || !restored || currentStartTime === null || !discordData) return;
        startDiscordIfNeeded(discordData, currentStartTime);
        const interval = setInterval(() => {
            startDiscordIfNeeded(discordData, currentStartTime);
        }, 15000);
        return () => clearInterval(interval);
    }, [restored, currentStartTime, discordData, discordEnabled]);

    // -----------------------------------------------
    // ストップウォッチ停止処理
    //   * タイマーを止める
    //   * Discord連係を止める
    //   * localStorageを削除し、内部状態もリセット
    //   * 経過時間(ms)を返す
    // -----------------------------------------------
    async function stopNow() {
        stoppingRef.current = true;
        // Discord停止
        await stopDiscordIfNeeded();
        // 経過時間(ms)計算
        let totalElapsed = 0;
        if (currentStartTime !== null) {
            totalElapsed = Date.now() - Number(currentStartTime);
        }
        // リセット
        clearStopwatchStateAndSync();
        setCurrentStartTime(null);
        setPausedStartTime(null);
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
    // 一時停止（Confirm用）
    // -----------------------------------------------
    const pause = async () => {
        if (currentStartTime === null) return null;
        stoppingRef.current = true;
        const startTime = Number(currentStartTime);
        if (!Number.isFinite(startTime)) return null;
        const elapsed = Date.now() - startTime;
        setDisplayTime(elapsed);
        setPausedStartTime(startTime);
        setCurrentStartTime(null);
        persistStopwatchStateAndSync({
            startTime: null,
            pausedStartTime: startTime,
            displayTime: elapsed,
            memo
        });
        await stopDiscordIfNeeded();
        return { minutes: elapsed / 60000, memo };
    };

    // -----------------------------------------------
    // 再開
    // -----------------------------------------------
    const resume = async () => {
        if (currentStartTime !== null) return;
        stoppingRef.current = false;
        if (pausedStartTime !== null) {
            const startTime = pausedStartTime;
            const nextDisplayTime = Date.now() - startTime;
            setCurrentStartTime(startTime);
            setPausedStartTime(null);
            setDisplayTime(nextDisplayTime);
            persistStopwatchStateAndSync({
                startTime,
                pausedStartTime: null,
                displayTime: nextDisplayTime,
                memo
            });
            await startDiscordIfNeeded(discordData, startTime);
            return;
        }
        const startTime = Date.now() - displayTime;
        setCurrentStartTime(startTime);
        setPausedStartTime(null);
        persistStopwatchStateAndSync({
            startTime,
            pausedStartTime: null,
            displayTime,
            memo
        });
        await startDiscordIfNeeded(discordData, startTime);
    };

    // -----------------------------------------------
    // 完全リセット（Confirm保存後など）
    // -----------------------------------------------
    const reset = async () => {
        await stopNow();
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
            throw new Error(t("Start time cannot be in the future"));
        }
        setCurrentStartTime(newStartTime);
        setPausedStartTime(null);
        // 表示用の経過時間を計算
        const elapsed = Date.now() - newStartTime;
        setDisplayTime(elapsed);
        persistStopwatchStateAndSync({
            startTime: newStartTime,
            pausedStartTime: null,
            displayTime: elapsed,
            memo
        });
    };

    const isRunning = (currentStartTime !== null);
    const displayStartTime = currentStartTime ?? pausedStartTime;
    return {
        displayTime,       // 現在の経過時間（ms）
        isRunning,         // 動作中かどうか
        start: handleStart,// 手動で開始するため
        complete,          // 完了処理
        cancel,            // キャンセル処理
        pause,             // 一時停止
        resume,            // 再開
        reset,             // リセット
        updateStartTime,   // 開始時刻を編集
        currentStartTime,  // 現在の開始時刻
        displayStartTime,  // 表示用の開始時刻
        finishAndReset,    // 現在の計測を完了し、すぐ次を開始
        memo,              // メモ文字列
        setMemo,           // メモのsetter
        refreshDiscord,
        discordConnected,
        isDiscordBusy,     // DiscordAPIリクエスト送信中フラグ
    };
}

export default useStopwatch;
