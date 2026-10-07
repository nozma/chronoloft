// 詳細は改行をスペースに置き換え、常に1行として扱う。
export const normalizeDetails = (value) => (value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ');

export const pasteDetails = (event, onChange) => {
    event.preventDefault();
    const input = event.target;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const pasted = normalizeDetails(event.clipboardData.getData('text'));
    onChange(input.value.slice(0, start) + pasted + input.value.slice(end));
};
