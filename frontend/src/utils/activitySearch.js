import { toHiragana, toRomaji } from 'wanakana';

export const isValidReading = value => typeof value === 'string'
    && [...value].length <= 160 && /^[ぁ-ゖゝゞー]*$/u.test(value);

const normalize = value => toHiragana((value ?? '').normalize('NFKC').toLowerCase(), { passRomaji: true });

export function createActivitySearchPredicate(inputValue) {
    const query = normalize(inputValue).trim();
    if (!query) return () => true;
    const queries = [query, toHiragana(query), toHiragana(query, { IMEMode: true })].filter(Boolean);
    return activity => [activity.name, activity.reading].some(value => {
        const text = normalize(value);
        return text && (queries.some(part => text.includes(part)) || toRomaji(text).includes(query));
    });
}

export function filterActivityOptions(options, { inputValue }) {
    return options.filter(createActivitySearchPredicate(inputValue));
}
