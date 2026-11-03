import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActivityOptions, isValidReading } from './activitySearch.js';

const items = [
    { id: 1, name: '読書', reading: 'どくしょ' },
    { id: 2, name: 'プログラミング', reading: '' },
    { id: 3, name: 'ひらがな', reading: 'べつめい' },
    { id: 4, name: 'English', reading: '' },
    { id: 5, name: '学校', reading: 'がっこう' },
    { id: 6, name: '運動', reading: 'うんどう' },
];
const ids = query => filterActivityOptions(items, { inputValue: query }).map(x => x.id);

test('名前と任意のよみがなを検索し、かな・英字の表記違いを吸収する', () => {
    assert.deepEqual(ids('読'), [1]);
    assert.deepEqual(ids('ドク'), [1]);
    assert.deepEqual(ids('ぷろぐら'), [2]);
    assert.deepEqual(ids('ﾌﾟﾛｸﾞﾗ'), [2]);
    assert.deepEqual(ids('ヒラガナ'), [3]);
    assert.deepEqual(ids('ベツメイ'), [3]);
    assert.deepEqual(ids('ENGLISH'), [4]);
    assert.deepEqual(ids(''), items.map(x => x.id));
    assert.deepEqual(filterActivityOptions([{ name: '古い項目' }], { inputValue: '古い' }).length, 1);
});

test('ローマ字の表記違い・入力途中・促音・末尾のnを扱う', () => {
    for (const q of ['dokusho', 'dokusyo', 'doku', 'dokus', 'ＤＯＫＵ']) assert.deepEqual(ids(q), [1]);
    assert.deepEqual(ids('gakkou'), [5]);
    assert.deepEqual(ids('un'), [6]);
    assert.deepEqual(ids('purogur'), [2]);
});

test('よみがなは任意で、ひらがなと長音・繰り返し記号だけ許可する', () => {
    for (const value of ['', 'どくしょ', 'げーむ', 'すゞき']) assert.equal(isValidReading(value), true);
    for (const value of ['ドクショ', '読書', 'dokusho', 'どく しょ', 'どく\n', 'あ'.repeat(161)]) assert.equal(isValidReading(value), false);
});
