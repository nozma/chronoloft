import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = transformSync(readFileSync(new URL('../../components/SettingsDialog.jsx', import.meta.url), 'utf8'), {
    loader: 'jsx', jsx: 'automatic', format: 'cjs',
}).code;
const defaults = {
    language: 'en', autoFilterOnSelect: true, themeMode: 'system', layoutMode: 'one-column',
    recentDays: '14', recentLimit: '15', recentMinimum: '1', discordEnabled: true, recordSaveMode: 'auto',
};

function dialog() {
    const slots = [];
    const effects = [];
    const writes = [];
    let settings = { ...defaults };
    let index = 0;
    let dirty = false;
    let tree;
    const hooks = {
        useState(initial) {
            const key = index++;
            if (!(key in slots)) slots[key] = initial;
            return [slots[key], value => {
                const next = typeof value === 'function' ? value(slots[key]) : value;
                if (!Object.is(slots[key], next)) { slots[key] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const key = index++;
            return slots[key] ??= { current: initial };
        },
        useEffect(callback, deps) {
            const key = index++;
            if (!slots[key] || deps.some((value, i) => !Object.is(value, slots[key][i]))) {
                slots[key] = deps;
                effects.push(callback);
            }
        },
    };
    const jsx = (type, props) => ({ type, props });
    const modules = {
        react: hooks,
        'react/jsx-runtime': { jsx, jsxs: jsx },
        '@mui/material': new Proxy({}, { get: (_, name) => name }),
        './LanAccess': { LanSettings: 'LanSettings' },
        '../i18n/I18nContext': { useI18n: () => ({ t: key => key }) },
        '../contexts/SettingsContext': {
            DEFAULT_SETTINGS: defaults,
            useSettings: () => ({ ...settings, isMobile: false, saveSettings: async changes => {
                writes.push(JSON.parse(JSON.stringify(changes)));
                settings = { ...settings, ...changes };
            } }),
        },
    };
    const context = vm.createContext({ module: { exports: {} }, require: name => {
        assert.ok(name in modules, name);
        return modules[name];
    } });
    vm.runInContext(source, context);

    function find(type, predicate) {
        const visit = node => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) {
                for (const child of node) { const result = visit(child); if (result) return result; }
            } else {
                if (node.type === type && predicate(node.props)) return node;
                return visit(node.props?.children);
            }
        };
        const result = visit(tree);
        assert.ok(result, String(type));
        return result.props;
    }
    function render() {
        do {
            dirty = false;
            index = 0;
            tree = context.module.exports.default({ open: true, onClose() {} });
            while (effects.length) effects.shift()();
        } while (dirty);
    }
    render();
    const lan = find('LanSettings', () => true);
    lan.ref.current = { save: async () => {} };
    lan.onReadyChange(true);
    render();
    return {
        writes,
        get settings() { return settings; },
        remote(changes) { settings = { ...settings, ...changes }; render(); },
        reset() { find('Button', props => props.children === 'Reset to Defaults').onClick(); render(); },
        async apply() { await find('Button', props => props.children === 'Apply').onClick(); render(); },
        changeTheme(value) {
            find('RadioGroup', props => ['system', 'light', 'dark'].includes(props.value)).onChange({ target: { value } });
            render();
        },
    };
}

test('設定を変更せず適用しても、別画面から同期した設定を戻さない', async () => {
    const ui = dialog();
    ui.remote({ themeMode: 'dark' });
    await ui.apply();
    assert.deepEqual(ui.writes, [{}]);
    assert.equal(ui.settings.themeMode, 'dark');
});

test('他画面から変更を受けた後でも、既定値へのリセットは全項目を保存する', async () => {
    const ui = dialog();
    ui.remote({ themeMode: 'dark', language: 'ja' });
    ui.reset();
    await ui.apply();
    assert.deepEqual(ui.writes, [defaults]);
    assert.equal(ui.settings.themeMode, 'system');
    assert.equal(ui.settings.language, 'en');
});

test('編集中のテーマは同期で消さず、保存時に別項目の変更も保持する', async () => {
    const ui = dialog();
    ui.changeTheme('light');
    ui.remote({ recordSaveMode: 'confirm' });
    await ui.apply();
    assert.deepEqual(ui.writes, [{ themeMode: 'light' }]);
    assert.equal(ui.settings.recordSaveMode, 'confirm');
});
