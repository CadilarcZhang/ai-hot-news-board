const axios = require('axios');

const TIMEOUT_MS = 4000;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 400, 1000];

function summarizeUpstreamError(error) {
    const status = error && error.response ? error.response.status : (error && error.status) || null;
    const code = error && error.code ? error.code : null;
    return { code, status };
}

function isRetryable(error) {
    if (error && error.retryable === false) return false;
    const status = error && error.response ? error.response.status : null;
    if (status && status >= 400 && status < 500 && status !== 429) return false;
    return true;
}

/**
 * 拉取天行热搜。超时 4 秒，网络错误和 5xx/429 最多再试 2 次。
 * 抛出的错误只带 code/status，不附带请求地址。
 */
async function fetchHotList(endpoint, apiKey, options = {}) {
    const httpGet = options.httpGet || ((url, config) => axios.get(url, config));
    const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const maxAttempts = options.maxAttempts || MAX_ATTEMPTS;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const wait = BACKOFF_MS[attempt - 1] || 0;
        if (wait) await sleep(wait);
        try {
            const response = await httpGet(
                `https://apis.tianapi.com/${endpoint}/index?key=${apiKey}`,
                { timeout: options.timeoutMs || TIMEOUT_MS }
            );
            const data = response && response.data;
            if (!data || data.code !== 200 || !data.result) {
                const invalid = new Error('TianAPI request failed');
                invalid.code = 'BAD_PAYLOAD';
                invalid.status = response && response.status;
                invalid.retryable = false;
                throw invalid;
            }
            return data;
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === maxAttempts) break;
        }
    }

    const wrapped = new Error('TianAPI request failed');
    const info = summarizeUpstreamError(lastError);
    wrapped.code = info.code;
    wrapped.status = info.status;
    if (info.status) wrapped.response = { status: info.status };
    return Promise.reject(wrapped);
}

module.exports = {
    TIMEOUT_MS,
    MAX_ATTEMPTS,
    fetchHotList,
    summarizeUpstreamError,
    isRetryable
};
