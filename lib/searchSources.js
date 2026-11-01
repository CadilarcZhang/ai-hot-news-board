'use strict';

const SEARCH_SOURCE_LIMIT = 3;

/**
 * 搜索命中转成 SSE sources 使用的 {title, link}。
 * 只保留前 limit 条，和后续正文抓取的条数一致。
 */
function toSourceList(results, limit = SEARCH_SOURCE_LIMIT) {
    if (!Array.isArray(results)) {
        return [];
    }
    const sources = [];
    for (const item of results) {
        if (!item || !item.title || !item.link) {
            continue;
        }
        const link = String(item.link);
        if (!link.startsWith('http')) {
            continue;
        }
        sources.push({ title: String(item.title), link });
        if (sources.length >= limit) {
            break;
        }
    }
    return sources;
}

function sameSources(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }
    return left.every((item, index) => {
        const other = right[index];
        return other && item.title === other.title && item.link === other.link;
    });
}

/**
 * 连接被对端关掉时值得立刻再试一次。
 * 读超时不要重试：再等一轮会把搜索阶段拉长。
 */
function isConnectionReset(error) {
    if (!error) {
        return false;
    }
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
        return true;
    }
    return /socket hang up/i.test(error.message || '');
}

module.exports = {
    SEARCH_SOURCE_LIMIT,
    toSourceList,
    sameSources,
    isConnectionReset
};
