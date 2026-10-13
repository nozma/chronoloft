import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDetails, pasteDetails } from './recordDetails.js';

test('詳細は空値を扱い、各種改行をスペースにまとめる', () => {
    assert.equal(normalizeDetails(null), '');
    assert.equal(normalizeDetails(undefined), '');
    assert.equal(normalizeDetails('本A\r\n\n本B\u2028本C\u2029終わり'), '本A 本B 本C 終わり');
    assert.equal(normalizeDetails('  本A / 本B  '), '  本A / 本B  ');
});

test('貼り付けは選択範囲だけを置き換えて改行を除く', () => {
    let prevented = false;
    let result;
    pasteDetails({
        preventDefault: () => { prevented = true; },
        target: { value: '前・選択・後', selectionStart: 2, selectionEnd: 4 },
        clipboardData: { getData: type => { assert.equal(type, 'text'); return '本A\n本B'; } },
    }, value => { result = value; });
    assert.equal(prevented, true);
    assert.equal(result, '前・本A 本B・後');
});

test('選択位置が取れない入力では末尾に貼り付ける', () => {
    let result;
    pasteDetails({
        preventDefault() {},
        target: { value: '本A' },
        clipboardData: { getData: () => ' / 本B' },
    }, value => { result = value; });
    assert.equal(result, '本A / 本B');
});
