import test from 'node:test';
import assert from 'node:assert/strict';
import { createStopwatchDraft } from './stopwatchDraft.js';

const initial = { id: 'main', revision: 3, started_at: 600000, memo: '' };

function harness(save) {
    const calls = [];
    const draft = createStopwatchDraft(async (base, data) => {
        calls.push({ base, data });
        if (save) return save(base, data);
        return { item: { ...base, ...data, revision: base.revision + 1 } };
    }, () => {});
    return { draft, calls };
}

test('連打中は通信せず、開始時刻と詳細をまとめて1回で保存する', async () => {
    const { draft, calls } = harness();
    draft.update(initial, { started_at: 300000 });
    draft.update(initial, { started_at: 240000 });
    draft.update(initial, { memo: '作業中' });
    draft.update(initial, { started_at: 180000 });
    assert.deepEqual(draft.changes, { started_at: 180000, memo: '作業中' });
    assert.equal(calls.length, 0);
    const saved = await draft.flush(initial);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].data, { started_at: 180000, memo: '作業中' });
    assert.equal(saved.revision, 4);
    assert.deepEqual(draft.changes, {});
});

test('自動保存直後の終了操作は同じ保存を待ち、最新の時刻とリビジョンを使う', async () => {
    let resolve;
    const { draft, calls } = harness(() => new Promise(done => { resolve = done; }));
    draft.update(initial, { started_at: 300000 });
    const autoSave = draft.flush(initial);
    const finish = draft.flush(initial).then(item => ({ action: 'complete', item }));
    assert.equal(calls.length, 1);
    resolve({ item: { ...initial, started_at: 300000, revision: 4 } });
    await autoSave;
    const result = await finish;
    assert.equal(result.item.started_at, 300000);
    assert.equal(result.item.revision, 4);
});

test('通信中の追加入力を失わず、更新後のリビジョンで保存する', async () => {
    let resolve;
    const { draft, calls } = harness(async (base, data) => {
        if (calls.length === 1) await new Promise(done => { resolve = done; });
        return { item: { ...base, ...data, revision: base.revision + 1 } };
    });
    draft.update(initial, { started_at: 300000, memo: '入力途中' });
    const saving = draft.flush(initial);
    draft.update(initial, { started_at: 240000, memo: '入力完了' });
    resolve();
    const saved = await saving;
    assert.equal(calls.length, 2);
    assert.equal(calls[1].base.revision, 4);
    assert.deepEqual(calls[1].data, { started_at: 240000, memo: '入力完了' });
    assert.equal(saved.revision, 5);
    assert.deepEqual(draft.changes, {});
});

test('保存に失敗しても入力を保持し、終了操作へ成功として渡さない', async () => {
    let fail = true;
    const { draft } = harness(async (base, data) => {
        if (fail) throw new Error('通信失敗');
        return { item: { ...base, ...data, revision: base.revision + 1 } };
    });
    draft.update(initial, { started_at: 300000, memo: '保持する詳細' });
    await assert.rejects(draft.flush(initial), /通信失敗/);
    assert.deepEqual(draft.changes, { started_at: 300000, memo: '保持する詳細' });
    fail = false;
    const saved = await draft.flush(initial);
    assert.equal(saved.started_at, 300000);
    assert.equal(saved.memo, '保持する詳細');
});

test('編集途中の他端末更新を黙って上書きせず、編集開始時のリビジョンで競合検出する', async () => {
    const { draft, calls } = harness();
    draft.update(initial, { started_at: 300000 });
    const remote = { ...initial, revision: 4, memo: '他端末の変更' };
    draft.update(remote, { started_at: 240000 });
    await draft.flush(remote);
    assert.equal(calls[0].base.revision, 3);
    assert.deepEqual(calls[0].data, { started_at: 240000 });
});
