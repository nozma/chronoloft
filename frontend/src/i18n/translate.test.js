import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createTranslator, detectLanguage, resolveLanguage } from './translate.js';
import { messages } from './messages.js';
import { formatToLocal } from '../utils/dateUtils.js';

test('ブラウザーの言語一覧から対応言語を選び、未対応なら英語を使用する', () => {
    assert.equal(detectLanguage(['ja-JP', 'en-US']), 'ja');
    assert.equal(detectLanguage(['fr-FR', 'en-GB', 'ja']), 'en');
    assert.equal(detectLanguage(['fr-FR', 'ja-JP']), 'ja');
    assert.equal(detectLanguage(['fr-FR']), 'en');
    assert.equal(detectLanguage([]), 'en');
    assert.equal(resolveLanguage('ja'), 'ja');
    assert.equal(resolveLanguage('en'), 'en');
    assert.ok(['ja', 'en'].includes(resolveLanguage('invalid')));
});

test('言語ごとに文言を切り替え、数値や値を埋め込む', () => {
    const ja = createTranslator('ja');
    const en = createTranslator('en');
    assert.equal(ja('Settings'), '設定');
    assert.equal(en('Settings'), 'Settings');
    assert.equal(ja('{count} days', { count: 14 }), '14日');
    assert.equal(en('{count} days', { count: 14 }), '14 days');
    assert.equal(ja('{hours}h {minutes}m', { hours: 0, minutes: 5 }), '0時間5分');
    assert.equal(ja('{value} on {date}', { value: '$& <memo>', date: '2026-10-07' }), '2026-10-07：$& <memo>');
    assert.equal(en('unknown.key'), 'unknown.key');
});

test('両言語の翻訳キーと埋め込み変数が一致する', () => {
    assert.deepEqual(Object.keys(messages.ja).sort(), Object.keys(messages.en).sort());
    for (const key of Object.keys(messages.en)) {
        const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
        assert.ok(messages.ja[key].length > 0, key);
        assert.deepEqual(placeholders(messages.ja[key]), placeholders(messages.en[key]), key);
    }
});

test('画面が参照する翻訳キーに辞書の欠落がない', () => {
    for (const directory of ['../components/', '../hooks/']) {
        const base = new URL(directory, import.meta.url);
        for (const name of readdirSync(base)) {
            if (!/\.(jsx|js)$/.test(name)) continue;
            const source = readFileSync(new URL(name, base), 'utf8');
            for (const match of source.matchAll(/\bt\(["']([^"']+)["']/g)) {
                assert.ok(Object.hasOwn(messages.en, match[1]), `${name}: ${match[1]}`);
            }
        }
    }
});

test('記録日時は指定された言語で表示する', () => {
    const date = '2026-10-07T03:00:00';
    assert.match(formatToLocal(date, undefined, 'ja'), /2026年10月7日/);
    assert.match(formatToLocal(date, undefined, 'en'), /Oct 7, 2026/);
});
