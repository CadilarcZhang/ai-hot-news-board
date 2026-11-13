'use strict';

const { selectArticles } = require('./deepseekArticleSelect');

const SEARCH_URL = 'https://api.deepseek.com/v1/tools/search';
const SEARCH_COUNT = 5;
const SEARCH_TIMEOUT_MS = 15000;
const BODY_TTL_MS = 15 * 60 * 1000;
const RAW_RESULT_TTL_MS = 10 * 60 * 1000;
const BODY_MAX_ENTRIES = 50;
const SUMMARY_TTL_SECONDS = 3600;

function summaryCacheKey(query) {
    return `deepseek-summary:v1:${query}`;
}

function articlesCacheKey(query) {
    return `deepseek-articles:v1:${query}`;
}

function classifyStatus(status) {
    if (status === 401) return 'auth';
    if (status === 402) return 'balance';
    if (status === 429) return 'rate';
    if (status === 408 || status === 504) return 'timeout';
    return 'provider';
}

function providerMessage(kind) {
    if (kind === 'auth') return '搜索服务鉴权失败，请稍后再试。';
    if (kind === 'balance') return '搜索服务余额不足，暂时无法联网检索。';
    if (kind === 'rate') return '搜索服务繁忙，请稍后再试。';
    if (kind === 'timeout') return '搜索超时，请稍后再试。';
    return '搜索服务暂时不可用，请稍后再试。';
}

function isAbortError(error, signal) {
    if (signal && signal.aborted) return true;
    if (!error) return false;
    return error.code === 'ERR_CANCELED' || error.name === 'CanceledError' || error.name === 'AbortError';
}

function isTimeoutError(error) {
    if (!error) return false;
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
}

/**
 * 只发一次 Search。失败、空结果和取消都不在这里重试。
 */
async function requestDeepseekSearch({ query, apiKey, signal, httpPost, timeoutMs, nowMs }) {
    if (signal && signal.aborted) return { aborted: true };
    const text = String(query || '');
    if ([...text].length < 1 || [...text].length > 128 || !text.trim()) {
        return { ok: false, kind: 'provider', status: null, calls: 0 };
    }
    if (!apiKey) {
        return { ok: false, kind: 'auth', status: null, calls: 0 };
    }
    const body = { query: text, count: SEARCH_COUNT, need_content: true };
    let response;
    try {
        response = await httpPost({
            url: SEARCH_URL,
            method: 'post',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            data: body,
            timeout: timeoutMs || SEARCH_TIMEOUT_MS,
            signal,
            validateStatus: () => true
        });
    } catch (error) {
        if (isAbortError(error, signal)) return { aborted: true, calls: 1 };
        if (isTimeoutError(error)) return { ok: false, kind: 'timeout', status: null, calls: 1 };
        return { ok: false, kind: 'provider', status: null, calls: 1 };
    }
    if (signal && signal.aborted) return { aborted: true, calls: 1 };
    const status = response && response.status;
    if (status !== 200) {
        return { ok: false, kind: classifyStatus(status), status, calls: 1 };
    }
    const results = response.data && Array.isArray(response.data.results) ? response.data.results : null;
    if (!results) {
        return { ok: false, kind: 'provider', status, calls: 1 };
    }
    const selected = selectArticles(results, text, nowMs || Date.now());
    return {
        ok: true,
        status,
        calls: 1,
        resultCount: results.length,
        articles: selected.articles,
        dropped: selected.dropped,
        textLength: selected.textLength,
        sufficient: selected.sufficient,
        merged: selected.merged,
        cacheable: selected.sufficient,
        rawCacheable: results.length > 0 && !selected.sufficient,
        results
    };
}

function createBodyCache(now, ttlMs) {
    const entries = new Map();
    const clock = now || Date.now;
    const ttl = ttlMs || BODY_TTL_MS;
    function read(key) {
        const item = entries.get(key);
        if (!item) return null;
        if (clock() > item.expiry) {
            entries.delete(key);
            return null;
        }
        entries.delete(key);
        entries.set(key, item);
        return item.value;
    }
    function write(key, value) {
        if (entries.has(key)) entries.delete(key);
        entries.set(key, { value, expiry: clock() + ttl });
        while (entries.size > BODY_MAX_ENTRIES) {
            const oldest = entries.keys().next().value;
            entries.delete(oldest);
        }
    }
    return {
        read,
        write,
        size() {
            return entries.size;
        }
    };
}

/**
 * 同一个进程里，相同标题同时只发一次 Search。
 * 还有别的请求在等时，单个断开不会取消这次搜索。
 * 这不是跨实例的限额。
 */
function createDeepseekSearchGate(options) {
    const httpPost = options.httpPost;
    const getApiKey = options.getApiKey;
    const now = options.now || Date.now;
    const cache = options.cache || createBodyCache(now, BODY_TTL_MS);
    const rawCache = options.rawCache || createBodyCache(now, RAW_RESULT_TTL_MS);
    const inflight = new Map();

    function cacheKey(query) {
        return `deepseek-search:v1:${query}`;
    }

    function rawKey(query) {
        return `deepseek-raw:v1:${query}`;
    }

    function fromRaw(query, stored) {
        const selected = selectArticles(stored.results, query, now());
        return {
            fromCache: true,
            calls: 0,
            ok: true,
            status: 200,
            resultCount: stored.results.length,
            articles: selected.articles,
            dropped: selected.dropped,
            textLength: selected.textLength,
            sufficient: selected.sufficient,
            merged: selected.merged
        };
    }

    async function load(query, signal) {
        if (signal && signal.aborted) return { aborted: true, calls: 0 };
        const key = cacheKey(query);
        const cached = cache.read(key);
        if (cached) {
            return Object.assign({ fromCache: true, calls: 0 }, cached);
        }
        const rawHit = rawCache.read(rawKey(query));
        if (rawHit) return fromRaw(query, rawHit);

        let flight = inflight.get(key);
        if (!flight) {
            const controller = new AbortController();
            flight = {
                controller,
                waiters: new Set(),
                promise: null
            };
            flight.promise = requestDeepseekSearch({
                query,
                apiKey: getApiKey(),
                signal: controller.signal,
                httpPost,
                nowMs: now()
            }).then((result) => {
                if (!controller.signal.aborted && result && result.cacheable) {
                    cache.write(key, {
                        ok: true,
                        status: result.status,
                        articles: result.articles,
                        dropped: result.dropped,
                        textLength: result.textLength,
                        sufficient: true,
                        merged: result.merged,
                        resultCount: result.resultCount
                    });
                } else if (!controller.signal.aborted && result && result.rawCacheable) {
                    rawCache.write(rawKey(query), { results: result.results });
                }
                if (!result || !result.results) return result;
                const published = Object.assign({}, result);
                delete published.results;
                return published;
            }).finally(() => {
                inflight.delete(key);
            });
            inflight.set(key, flight);
        }

        const waiter = {};
        flight.waiters.add(waiter);
        const leave = () => {
            if (!flight.waiters.has(waiter)) return;
            flight.waiters.delete(waiter);
            if (flight.waiters.size === 0) flight.controller.abort();
        };
        if (signal) {
            if (signal.aborted) leave();
            else signal.addEventListener('abort', leave, { once: true });
        }

        try {
            const result = await flight.promise;
            if (signal && signal.aborted) return { aborted: true, calls: result && result.calls ? result.calls : 0 };
            return result || { aborted: true, calls: 0 };
        } finally {
            if (signal) signal.removeEventListener('abort', leave);
            leave();
        }
    }

    return {
        load,
        inflightSize() {
            return inflight.size;
        },
        cacheSize() {
            return cache.size() + rawCache.size();
        }
    };
}

module.exports = {
    SEARCH_URL,
    SEARCH_COUNT,
    RAW_RESULT_TTL_MS,
    SUMMARY_TTL_SECONDS,
    summaryCacheKey,
    articlesCacheKey,
    providerMessage,
    requestDeepseekSearch,
    createDeepseekSearchGate,
    createBodyCache
};
