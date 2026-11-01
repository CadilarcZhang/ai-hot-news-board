'use strict';

const SEARCH_SOURCE_LIMIT = 3;
// 搜索接口最多返回 5 条。旧的分批抓取在「最多 3 篇」时会多抓到第 4 条，
// 可用正文经常在第 4 条。候选拉到 5，成功正文仍只保留 3 篇。
const FETCH_CANDIDATE_LIMIT = 5;
const MAX_ARTICLES = 3;

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

function isAbortError(error, signal) {
    if (signal && signal.aborted) {
        return true;
    }
    if (!error) {
        return false;
    }
    return error.code === 'ERR_CANCELED' || error.name === 'CanceledError';
}

/**
 * 已经有可用正文后，不要再等最慢的失败请求。
 * 凑满 maxArticles 立刻停止；否则在第一篇成功后再等 graceMs 收快速的邻居。
 */
function createFetchBudget(graceMs, maxArticles = MAX_ARTICLES) {
    const controller = new AbortController();
    let good = 0;
    let graceTimer = null;
    return {
        signal: controller.signal,
        note(article) {
            if (!article || controller.signal.aborted) {
                return;
            }
            good += 1;
            if (good >= maxArticles) {
                controller.abort();
                return;
            }
            if (!graceTimer) {
                graceTimer = setTimeout(() => controller.abort(), graceMs);
            }
        },
        clear() {
            if (graceTimer) {
                clearTimeout(graceTimer);
                graceTimer = null;
            }
        }
    };
}

async function collectSettled(items, mapper, options = {}) {
    const graceMs = options.graceMs == null ? 1500 : options.graceMs;
    const maxArticles = options.maxArticles || MAX_ARTICLES;
    const budget = createFetchBudget(graceMs, maxArticles);
    try {
        const fetched = await Promise.all(items.map((item, index) => {
            return mapper(item, index, budget.signal).then((article) => {
                budget.note(article);
                return article;
            });
        }));
        return fetched.filter(Boolean).slice(0, maxArticles);
    } finally {
        budget.clear();
    }
}

module.exports = {
    SEARCH_SOURCE_LIMIT,
    FETCH_CANDIDATE_LIMIT,
    MAX_ARTICLES,
    toSourceList,
    sameSources,
    isConnectionReset,
    isAbortError,
    createFetchBudget,
    collectSettled
};
