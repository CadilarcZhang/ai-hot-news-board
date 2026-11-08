'use strict';

function isClientAborted(signal) {
    return Boolean(signal && signal.aborted);
}

/**
 * 中途断开的半成品不能写入缓存。写完且仍是这一次请求时才缓存。
 */
function canStoreCompletedContent(signal, content) {
    if (isClientAborted(signal)) {
        return false;
    }
    return typeof content === 'string' && content.trim().length > 0;
}

/**
 * 调用方已断开时停住，不能因为正文为空改走无来源模型回退。
 * 仍然连着、且合并正文不足 200 字时，保持原来的回退提示。
 * @returns {'stop'|'fallback'|'summarize'}
 */
function decideSearchSummary(signal, articlesContent) {
    if (isClientAborted(signal)) {
        return 'stop';
    }
    const text = articlesContent == null ? '' : String(articlesContent);
    if (text.length < 200) {
        return 'fallback';
    }
    return 'summarize';
}

module.exports = {
    isClientAborted,
    canStoreCompletedContent,
    decideSearchSummary
};
