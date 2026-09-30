export const CHART_GROUPING_CHANGE_EVENT = 'chronoloft:chart-grouping-change';

function hashColorKey(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function hashRatio(value) {
    return (hashColorKey(value) % 10001) / 10000;
}

function hslToHex(hue, saturation, lightness) {
    const normalizedSaturation = saturation / 100;
    const normalizedLightness = lightness / 100;
    const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
    const hueSection = hue / 60;
    const intermediate = chroma * (1 - Math.abs((hueSection % 2) - 1));
    let red = 0;
    let green = 0;
    let blue = 0;

    if (hueSection < 1) {
        red = chroma;
        green = intermediate;
    } else if (hueSection < 2) {
        red = intermediate;
        green = chroma;
    } else if (hueSection < 3) {
        green = chroma;
        blue = intermediate;
    } else if (hueSection < 4) {
        green = intermediate;
        blue = chroma;
    } else if (hueSection < 5) {
        red = intermediate;
        blue = chroma;
    } else {
        red = chroma;
        blue = intermediate;
    }

    const match = normalizedLightness - chroma / 2;
    return [red, green, blue]
        .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
        .join('')
        .replace(/^/, '#');
}

function getActivityMemoColorParts(key) {
    const separatorIndex = key.indexOf(' / ');
    if (separatorIndex < 0) {
        return { activityName: key, memo: '' };
    }
    return {
        activityName: key.slice(0, separatorIndex),
        memo: key.slice(separatorIndex + 3),
    };
}

export function getGroupingColor(groupBy, key, themeMode) {
    const normalizedKey = String(key);
    let colorKey = `${groupBy}:${normalizedKey}`;
    let hue = (hashColorKey(`hue:${colorKey}`) % 3600) / 10;

    if (groupBy === 'activityMemo') {
        const { activityName, memo } = getActivityMemoColorParts(normalizedKey);
        const activityColorKey = `activity:${activityName}`;
        hue = (hashColorKey(`hue:${activityColorKey}`) % 3600) / 10;
        if (memo) {
            const offsetMagnitude = 14 + hashRatio(`memo-offset:${memo}`) * 18;
            const offsetDirection = hashColorKey(`memo-direction:${memo}`) % 2 === 0 ? -1 : 1;
            hue = (hue + offsetDirection * offsetMagnitude + 360) % 360;
        } else {
            // memoなしはActivity単位で表示した場合と同じ基本色にする
            colorKey = activityColorKey;
        }
    }

    const isDarkMode = themeMode === 'dark';
    // 極端に暗い・明るい・低彩度な色を避けつつ、キーごとの差を広く確保する
    const saturation = (isDarkMode ? 52 : 58)
        + hashRatio(`saturation:${colorKey}`) * 14;
    const lightness = (isDarkMode ? 62 : 42)
        + hashRatio(`lightness:${colorKey}`) * 10;
    return hslToHex(hue, saturation, lightness);
}

export function blendHexColor(hexColor, targetHex, mixRatio, fallbackColor) {
    const normalized = hexColor?.replace('#', '');
    const target = targetHex?.replace('#', '');
    if (
        !normalized || !target ||
        !/^[0-9a-fA-F]{6}$/.test(normalized) ||
        !/^[0-9a-fA-F]{6}$/.test(target)
    ) {
        return fallbackColor;
    }

    const sourceChannels = [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16));
    const targetChannels = [0, 2, 4].map(index => parseInt(target.slice(index, index + 2), 16));
    const mixedChannels = sourceChannels.map((channel, index) =>
        Math.round(channel + (targetChannels[index] - channel) * mixRatio)
    );

    return `rgb(${mixedChannels.join(', ')})`;
}

export function getGroupingFillColor(color, themeMode) {
    return themeMode === 'dark'
        ? blendHexColor(color, '#000000', 0.7, '#26445f')
        : blendHexColor(color, '#ffffff', 0.9, '#dbe7f3');
}

export function getGroupingBorderColor(color, themeMode) {
    return themeMode === 'dark'
        ? blendHexColor(color, '#ffffff', 0.2, '#555555')
        : blendHexColor(color, '#ffffff', 0.7, '#d0d7de');
}

export function getRecordGroupingKeys(record, groupBy) {
    if (groupBy === 'group') {
        return [record.activityGroup || 'Unknown Group'];
    }
    if (groupBy === 'tag') {
        const tagNames = Array.from(new Set(
            (record.tags || []).map(tag => tag.name).filter(Boolean)
        )).sort((left, right) => left.localeCompare(right, 'ja'));
        return tagNames.length > 0 ? tagNames : ['No Tag'];
    }
    if (groupBy === 'activityMemo') {
        const activityName = record.activityName || 'Unknown Activity';
        return [`${activityName}${record.memo ? ` / ${record.memo}` : ''}`];
    }
    return [record.activityName || 'Unknown Activity'];
}
