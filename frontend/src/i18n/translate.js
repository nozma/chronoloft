import { messages } from './messages.js';

export const SUPPORTED_LANGUAGES = ['ja', 'en'];

export function detectLanguage(languages = globalThis.navigator?.languages ?? [globalThis.navigator?.language]) {
    for (const locale of languages) {
        const language = locale?.toLowerCase().split('-')[0];
        if (SUPPORTED_LANGUAGES.includes(language)) return language;
    }
    return 'en';
}

export function resolveLanguage(language) {
    return SUPPORTED_LANGUAGES.includes(language) ? language : detectLanguage();
}

export function createTranslator(language) {
    const dictionary = messages[resolveLanguage(language)];
    return (key, values = {}) => {
        const text = dictionary[key] ?? messages.en[key] ?? key;
        return text.replace(/\{(\w+)\}/g, (match, name) =>
            Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
    };
}
