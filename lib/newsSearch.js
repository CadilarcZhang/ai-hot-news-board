/**
 * 热搜解读的检索 v2。
 *
 * 和 server.js 里的 searchNews 分开，方便对照。
 * /api/generate-with-search 在 SEARCH_V2 未显式关闭时走这里。
 *
 * Google Custom Search JSON API（cse.list）参数取舍：
 * - num=10：单次最多 10 条，再在本地过滤。
 * - lr=lang_zh-CN：只要简体中文文档。
 * - gl=cn：按用户地区加权，不剔除结果。
 * - hl=zh-CN：界面语言，官方说明有助于结果质量。
 * - dateRestrict：先 d3，过滤后不足 3 条再放宽到 d7。这是全网引擎上可用的时间限制。
 * - 不传 cr。cr=countryCN 按顶级域和服务器 IP 硬限制来源国，
 *   会丢掉挂在境外 CDN 上的中文媒体（163、qq、caixin、36kr 等）。gl=cn 已经做地区加权。
 * - 不传 sort。sort=date 默认是硬排序，没有可解析日期的页面会被丢掉
 *   （见 Programmable Search 结构化搜索文档）。全网引擎上这个参数也经常直接 400。
 *   新鲜度交给 dateRestrict，近期刊发再用来源页 pagemap 的 article:published_time 在本地加分。
 * - 不传 siteSearch。它只能指定一个站点，include 模式是硬限制。
 *   可信中文媒体只在本地打分里加权。
 *
 * 每个未缓存话题最多 2 次 Google 请求。内容缓存仍由 server.js 负责。
 */

const axios = require('axios');
const cheerio = require('cheerio');

const SEARCH_TIMEOUT_MS = 8000;
const ARTICLE_TIMEOUT_MS = 4000;
const MAX_GOOGLE_CALLS = 2;
const MIN_KEEP = 3;
const SCORE_KEEP = 0.34;
const TEXT_KEEP = 0.25;
const ENOUGH_ARTICLES = 2;
const FETCH_WAVE_SIZE = 4;
const FETCH_CANDIDATE_LIMIT = 6;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

// 只加分，不作为 siteSearch 硬限制。
const REPUTABLE_SUFFIXES = [
    'thepaper.cn',
    'guancha.cn',
    'sina.com.cn',
    'sina.cn',
    '163.com',
    'qq.com',
    'ifeng.com',
    'people.com.cn',
    'people.cn',
    'xinhuanet.com',
    'news.cn',
    'chinanews.com.cn',
    'chinanews.com',
    'caixin.com',
    '36kr.com',
    'jiemian.com'
];

const searchCache = new Map();

function clearSearchCache() {
    searchCache.clear();
}

function readSearchCache(key, now = Date.now()) {
    const hit = searchCache.get(key);
    if (!hit) return null;
    if (hit.expiry <= now) {
        searchCache.delete(key);
        return null;
    }
    return hit.value;
}

function writeSearchCache(key, value, now = Date.now()) {
    searchCache.set(key, { expiry: now + SEARCH_CACHE_TTL_MS, value });
}

/**
 * 去掉表情、话题井号、括号和标点，留下可检索的话题词。
 * @param {string} rawTitle
 * @returns {string}
 */
function cleanHotSearchTitle(rawTitle) {
    let text = String(rawTitle || '');
    text = text.replace(/\p{Extended_Pictographic}/gu, '');
    text = text.replace(/[\uFE0F\u200D]/g, '');
    text = text.replace(/[#＃]([^#＃]+)[#＃]/g, ' $1 ');
    text = text.replace(/[#＃]/g, ' ');
    text = text.replace(/[\[\]【】（）()「」『』《》<>]/g, ' ');
    text = text.replace(/[，。！？、；：,…—\-_~|/\\@&*+=^%$,.!?;:'"`]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

/**
 * 检索词。清洗后的标题默认补上「新闻」，标题里已经有则不重复加。
 * @param {string} rawTitle
 * @returns {string}
 */
function buildSearchQuery(rawTitle) {
    const cleaned = cleanHotSearchTitle(rawTitle);
    if (!cleaned) return '';
    if (cleaned.includes('新闻')) return cleaned;
    return `${cleaned} 新闻`;
}

/**
 * 发给 Google 的公开参数。不含 key / cx。
 * @param {string} query
 * @param {string} dateRestrict
 * @returns {object}
 */
function buildGoogleParams(query, dateRestrict) {
    return {
        q: query,
        num: 10,
        lr: 'lang_zh-CN',
        gl: 'cn',
        hl: 'zh-CN',
        dateRestrict: dateRestrict || 'd3'
    };
}

function bareHost(hostname) {
    let host = String(hostname || '').toLowerCase();
    let previous = '';
    while (host && host !== previous) {
        previous = host;
        host = host.replace(/^(www|m|3g|wap)\./, '');
    }
    return host;
}

function hostOf(url) {
    try {
        return bareHost(new URL(url).hostname);
    } catch (error) {
        return '';
    }
}

/**
 * 去掉协议、查询串、片段，以及 m. / www. 前缀，用来判断是不是同一篇文章。
 * @param {string} url
 * @returns {string}
 */
function normalizeArticleUrl(url) {
    try {
        const parsed = new URL(url);
        let path = parsed.pathname.replace(/\/+$/, '');
        path = path.replace(/\/index\.(s?html|htm|php)$/i, '');
        return `${bareHost(parsed.hostname)}${path.toLowerCase()}`;
    } catch (error) {
        return String(url || '').split('#')[0].split('?')[0].toLowerCase();
    }
}

/**
 * 首页、频道、标签、列表和 PDF 不是新闻正文。
 * @param {string} url
 * @returns {boolean}
 */
function isNonArticleUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        return true;
    }
    if (!/^https?:$/.test(parsed.protocol)) return true;
    const path = parsed.pathname.toLowerCase();
    if (path === '/' || path === '') return true;
    if (/\.(pdf|jpg|jpeg|png|gif|mp4|zip)$/.test(path)) return true;
    if (/\/index\.(s?html|htm|php)$/.test(path)) return true;
    const segments = path.split('/').filter(Boolean);
    if (segments.some(segment => /^(channel|channels|tag|tags|topic|topics|list|lists|index|special|zhuanti|video|videos|live|search|sitemap)([-_]|$)/.test(segment))) {
        return true;
    }
    // 单段且没有数字，多半是 /china、/news 这类栏目，不是正文。
    // 澎湃的 /newsDetail_forward_123 带数字，保留。
    if (segments.length === 1 && !/\.(s?html|htm|php)$/.test(segments[0]) && !/\d/.test(segments[0])) {
        return true;
    }
    return false;
}

function isReputableDomain(url) {
    const host = hostOf(url);
    if (!host) return false;
    return REPUTABLE_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}

function isNewsSectionHost(url) {
    try {
        return /^(news|finance|mil|sports|ent|tech)\./.test(new URL(url).hostname.toLowerCase());
    } catch (error) {
        return false;
    }
}

function topicTerms(text) {
    const cleaned = cleanHotSearchTitle(text);
    const chinese = cleaned.replace(/[^\u4e00-\u9fff]/g, '');
    const bigrams = [];
    for (let i = 0; i < chinese.length - 1; i += 1) {
        bigrams.push(chinese.slice(i, i + 2));
    }
    if (chinese.length === 1) bigrams.push(chinese);
    const latin = cleaned.toLowerCase().match(/[a-z0-9]{2,}/g) || [];
    return { bigrams, latin };
}

/**
 * 话题词在文档中的覆盖率。中文用二字词，英文用词面。
 * 分母是话题词，长正文不会把分数稀释掉。
 * @param {string} topic
 * @param {string} documentText
 * @returns {number}
 */
function keywordOverlap(topic, documentText) {
    const terms = topicTerms(topic);
    const doc = String(documentText || '');
    const docChinese = doc.replace(/[^\u4e00-\u9fff]/g, '');
    const docLatin = doc.toLowerCase();
    const parts = [];
    if (terms.bigrams.length) {
        let hit = 0;
        terms.bigrams.forEach(gram => {
            if (docChinese.includes(gram)) hit += 1;
        });
        parts.push(hit / terms.bigrams.length);
    }
    if (terms.latin.length) {
        let hit = 0;
        terms.latin.forEach(token => {
            if (docLatin.includes(token)) hit += 1;
        });
        parts.push(hit / terms.latin.length);
    }
    if (!parts.length) return 0;
    return parts.reduce((sum, part) => sum + part, 0) / parts.length;
}

function dateBoost(publishedAt, now = Date.now()) {
    if (!publishedAt) return 0;
    const ageDays = (now - publishedAt) / 86400000;
    if (ageDays < -1) return 0;
    if (ageDays <= 3) return 0.15;
    if (ageDays <= 7) return 0.08;
    if (ageDays <= 30) return 0;
    return -0.2;
}

/**
 * 标题/摘要重合度为主，可信域名和近期日期加分，频道页扣分。
 * @param {string} topic
 * @param {object} result
 * @param {number} [now]
 * @returns {number}
 */
function scoreResult(topic, result, now = Date.now()) {
    const item = result || {};
    const overlap = keywordOverlap(topic, `${item.title || ''} ${item.snippet || ''}`);
    let score = overlap;
    if (isReputableDomain(item.link)) score += 0.12;
    if (isNewsSectionHost(item.link)) score += 0.05;
    score += dateBoost(item.publishedAt, now);
    if (isNonArticleUrl(item.link)) score -= 0.6;
    return Math.round(score * 1000) / 1000;
}

function compactTitle(title) {
    return cleanHotSearchTitle(title).replace(/\s+/g, '').toLowerCase();
}

function titlesNearIdentical(left, right) {
    const a = compactTitle(left);
    const b = compactTitle(right);
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length >= 8 && longer.includes(shorter)) return true;
    const leftGrams = topicTerms(a).bigrams;
    if (leftGrams.length < 4) return false;
    const rightGrams = new Set(topicTerms(b).bigrams);
    let hit = 0;
    leftGrams.forEach(gram => {
        if (rightGrams.has(gram)) hit += 1;
    });
    return hit / leftGrams.length >= 0.85;
}

/**
 * 同一规范化 URL，或标题几乎一样，只留分数更高的一条。
 * @param {Array} results
 * @returns {Array}
 */
function dedupeResults(results) {
    const kept = [];
    (results || []).forEach(item => {
        const duplicateIndex = kept.findIndex(existing => {
            const leftUrl = normalizeArticleUrl(existing.link);
            const rightUrl = normalizeArticleUrl(item.link);
            if (leftUrl && leftUrl === rightUrl) return true;
            return titlesNearIdentical(existing.title, item.title);
        });
        if (duplicateIndex === -1) {
            kept.push(item);
            return;
        }
        if ((item.score || 0) > (kept[duplicateIndex].score || 0)) {
            kept[duplicateIndex] = item;
        }
    });
    return kept;
}

function filterAndRankResults(topic, results, now = Date.now()) {
    const scored = [];
    (results || []).forEach(raw => {
        if (!raw || !raw.link || !raw.title) return;
        if (isNonArticleUrl(raw.link)) return;
        const score = scoreResult(topic, raw, now);
        if (score < SCORE_KEEP) return;
        scored.push(Object.assign({}, raw, { score }));
    });
    scored.sort((left, right) => right.score - left.score);
    return dedupeResults(scored);
}

function metaValue(meta, names) {
    if (!meta || typeof meta !== 'object') return '';
    const keys = Object.keys(meta);
    for (let i = 0; i < names.length; i += 1) {
        const found = keys.find(key => key.toLowerCase() === names[i].toLowerCase());
        if (found && meta[found]) return String(meta[found]);
    }
    return '';
}

function publishedTimeFromItem(item) {
    const tags = item && item.pagemap && item.pagemap.metatags;
    const meta = Array.isArray(tags) ? tags[0] : null;
    const raw = metaValue(meta, [
        'article:published_time',
        'article:modified_time',
        'pubdate',
        'publishdate',
        'date'
    ]);
    if (!raw) return null;
    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizeGoogleItem(item) {
    return {
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
        publishedAt: publishedTimeFromItem(item),
        source: 'google'
    };
}

function isGoogleSearchEnabled(rawSwitch, apiKey, engineId) {
    const hasCredentials = Boolean(apiKey && engineId);
    if (rawSwitch === undefined || rawSwitch === null || String(rawSwitch).trim() === '') {
        return hasCredentials;
    }
    const normalized = String(rawSwitch).trim().toLowerCase();
    if (normalized === 'false') return false;
    if (normalized === 'true') return hasCredentials;
    return false;
}

function readGoogleCredentials() {
    let config = {};
    try {
        config = require('../config/index.js');
    } catch (error) {
        config = {};
    }
    return {
        apiKey: process.env.GOOGLE_SEARCH_API_KEY || config.GOOGLE_SEARCH_API_KEY || '',
        engineId: process.env.GOOGLE_SEARCH_ENGINE_ID || config.GOOGLE_SEARCH_ENGINE_ID || ''
    };
}

function googleErrorInfo(error) {
    const status = error && error.response ? error.response.status : (error && error.status) || null;
    const apiError = error && error.response && error.response.data && error.response.data.error;
    const reason = error && error.reason
        ? error.reason
        : (apiError && Array.isArray(apiError.errors) && apiError.errors[0] ? apiError.errors[0].reason : '');
    const message = (apiError && apiError.message) || (error && error.message) || '';
    const quota = Boolean(error && error.quota)
        || status === 403
        || status === 429
        || /quota|dailylimit|ratelimit|keyinvalid|accessnotconfigured/i.test(`${reason} ${message}`);
    return { status, reason: reason || '', message: String(message).slice(0, 300), quota };
}

async function defaultGoogleSearch(params) {
    const { apiKey, engineId } = readGoogleCredentials();
    const referer = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.SITE_URL || 'https://news.zxt.net.cn');
    console.log('searchNewsV2 Google 请求', {
        query: params.q,
        dateRestrict: params.dateRestrict,
        num: params.num,
        lr: params.lr,
        gl: params.gl,
        hl: params.hl
    });
    try {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            timeout: SEARCH_TIMEOUT_MS,
            params: Object.assign({ key: apiKey, cx: engineId }, params),
            headers: {
                'Accept': 'application/json',
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (compatible; HotNewsBot/1.0)'
            }
        });
        const items = response.data && Array.isArray(response.data.items) ? response.data.items : [];
        return items.map(normalizeGoogleItem);
    } catch (error) {
        const info = googleErrorInfo(error);
        const wrapped = new Error(info.message || 'google search failed');
        wrapped.status = info.status;
        wrapped.reason = info.reason;
        wrapped.quota = info.quota;
        throw wrapped;
    }
}

async function defaultBaiduSearch(query) {
    const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&tn=news`;
    console.log('searchNewsV2 Baidu 请求', { query });
    const response = await axios.get(searchUrl, {
        timeout: SEARCH_TIMEOUT_MS,
        maxRedirects: 3,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://www.baidu.com/'
        }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('.result, .c-result, .result-op').each((index, element) => {
        if (results.length >= 10) return false;
        const $el = $(element);
        const title = $el.find('h3 a, .t a, .c-title-text').text().trim();
        let link = $el.find('h3 a, .t a').attr('href') || $el.find('a').first().attr('href') || '';
        const snippet = $el.find('.c-abstract, .c-span9, .c-abstract-text, .c-color-text').text().trim();
        if (link.startsWith('/link?url=')) {
            const urlMatch = link.match(/url=([^&]+)/);
            if (!urlMatch) return;
            try {
                link = decodeURIComponent(urlMatch[1]);
            } catch (error) {
                return;
            }
        }
        if (title && link.startsWith('http')) {
            results.push({ title, link, snippet: snippet || title, source: 'baidu' });
        }
    });
    return results;
}

function resolveGoogleEnabled(deps) {
    if (deps && deps.googleEnabled != null) return Boolean(deps.googleEnabled);
    const creds = readGoogleCredentials();
    return isGoogleSearchEnabled(process.env.GOOGLE_SEARCH_SWITCH, creds.apiKey, creds.engineId);
}

/**
 * 检索并本地排序。Google 最多两次（d3，不够再 d7），仍不足再百度。
 * @param {string} rawTitle
 * @param {object} [deps]
 * @returns {Promise<Array>}
 */
async function searchNewsV2(rawTitle, deps = {}) {
    const query = buildSearchQuery(rawTitle);
    if (!query) return [];

    if (!deps.bypassCache) {
        const cached = readSearchCache(query);
        if (cached) {
            console.log('searchNewsV2 命中搜索缓存', { query, count: cached.length });
            return cached;
        }
    }

    const googleSearch = deps.googleSearch || defaultGoogleSearch;
    const baiduSearch = deps.baiduSearch || defaultBaiduSearch;
    const enabled = resolveGoogleEnabled(deps);
    const rawGoogle = [];
    let googleCalls = 0;
    let ranked = [];

    if (!enabled) {
        console.log('searchNewsV2 Google 未启用，直接使用百度', { query });
    }

    if (enabled) {
        const windows = ['d3', 'd7'];
        for (let i = 0; i < windows.length; i += 1) {
            if (googleCalls >= MAX_GOOGLE_CALLS) break;
            const params = buildGoogleParams(query, windows[i]);
            googleCalls += 1;
            let batch = [];
            try {
                batch = await googleSearch(params, deps) || [];
            } catch (error) {
                const info = googleErrorInfo(error);
                console.error('searchNewsV2 Google 失败', {
                    query: params.q,
                    dateRestrict: params.dateRestrict,
                    status: info.status,
                    reason: info.reason || 'unknown',
                    message: info.message
                });
                if (info.quota) break;
            }
            rawGoogle.push(...batch);
            ranked = filterAndRankResults(rawTitle, rawGoogle);
            console.log('searchNewsV2 Google', {
                query: params.q,
                params: {
                    dateRestrict: params.dateRestrict,
                    num: params.num,
                    lr: params.lr,
                    gl: params.gl,
                    hl: params.hl,
                    cr: 'omitted',
                    sort: 'omitted',
                    siteSearch: 'omitted'
                },
                googleCalls,
                rawCount: batch.length,
                mergedRawCount: rawGoogle.length,
                filteredCount: ranked.length
            });
            if (ranked.length >= MIN_KEEP) break;
        }
    }

    if (ranked.length < MIN_KEEP) {
        let baiduRaw = [];
        try {
            baiduRaw = await baiduSearch(query, deps) || [];
        } catch (error) {
            const status = error && error.response ? error.response.status : null;
            console.error('searchNewsV2 Baidu 失败', { status, message: error.message });
        }
        const before = ranked.length;
        ranked = filterAndRankResults(rawTitle, rawGoogle.concat(baiduRaw));
        console.log('searchNewsV2 Baidu', {
            query,
            rawCount: baiduRaw.length,
            beforeCount: before,
            filteredCount: ranked.length
        });
    }

    console.log('searchNewsV2 选用来源', ranked.map(item => ({
        source: item.source || '',
        url: normalizeArticleUrl(item.link),
        title: item.title,
        score: item.score
    })));

    if (!deps.bypassCache) writeSearchCache(query, ranked);
    return ranked;
}

function extractArticleText(html) {
    const $ = cheerio.load(html || '');
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .comment, .comments').remove();
    const selectors = [
        'article',
        '.article-content',
        '.pages_content',
        '.post-content',
        '.entry-content',
        '.news-content',
        '.article-body',
        '#content',
        '.main-content'
    ];
    let content = '';
    for (let i = 0; i < selectors.length; i += 1) {
        const text = $(selectors[i]).text().trim();
        if (text.length > 200) {
            content = text;
            break;
        }
    }
    if (content.length < 200) {
        const paragraphs = [];
        $('p').each((index, element) => {
            const text = $(element).text().trim();
            if (text.length > 50) paragraphs.push(text);
        });
        content = paragraphs.join('\n');
    }
    content = content.replace(/\s+/g, ' ').trim();
    if (content.length > 5000) content = `${content.slice(0, 5000)}...`;
    return content;
}

async function defaultFetchArticleText(url, options = {}) {
    if (!url || !/^https?:\/\//i.test(url)) return '';
    try {
        const response = await axios.get(url, {
            timeout: options.timeout || ARTICLE_TIMEOUT_MS,
            signal: options.signal,
            maxRedirects: 3,
            maxContentLength: 1500000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
        });
        return extractArticleText(response.data);
    } catch (error) {
        if (error.code === 'ERR_CANCELED') return '';
        const status = error.response ? error.response.status : '';
        console.error(`selectArticles 抓取失败 状态码: ${status} ${error.message}`);
        return '';
    }
}

function isTextRelevant(topic, text) {
    return keywordOverlap(topic, String(text || '').slice(0, 4000)) >= TEXT_KEEP;
}

/**
 * 并行抓取一小波候选。凑够足够相关正文就不再抓后面的。
 * 正文也要和话题重合，并且长于 200 字。
 * @param {Array} candidates
 * @param {string} topic
 * @param {object} [deps]
 * @returns {Promise<Array>}
 */
async function selectArticles(candidates, topic, deps = {}) {
    const fetchText = deps.fetchText || defaultFetchArticleText;
    const needed = deps.needed == null ? ENOUGH_ARTICLES : deps.needed;
    const waveSize = deps.waveSize || FETCH_WAVE_SIZE;
    const limit = deps.limit || FETCH_CANDIDATE_LIMIT;
    const queue = (candidates || []).slice(0, limit);
    const articles = [];

    for (let index = 0; index < queue.length && articles.length < needed; index += waveSize) {
        const wave = queue.slice(index, index + waveSize);
        const settled = await Promise.allSettled(wave.map(async item => {
            const text = await fetchText(item.link, { timeout: ARTICLE_TIMEOUT_MS });
            return { item, text };
        }));
        settled.forEach(result => {
            if (articles.length >= needed) return;
            if (result.status !== 'fulfilled' || !result.value) return;
            const { item, text } = result.value;
            if (!text || text.length <= 200) {
                console.log(`selectArticles 正文过短: ${item.title || item.link} 长度 ${text ? text.length : 0}`);
                return;
            }
            if (!isTextRelevant(topic, text)) {
                console.log(`selectArticles 正文不相关: ${item.title || item.link}`);
                return;
            }
            articles.push({
                title: item.title,
                content: text.length > 5000 ? `${text.slice(0, 5000)}...` : text,
                source: item.link
            });
        });
    }

    console.log('selectArticles 选用', articles.map(article => normalizeArticleUrl(article.source)));
    return articles;
}

async function fetchNewsContext(rawTitle, deps = {}) {
    const ranked = await searchNewsV2(rawTitle, deps);
    if (!ranked.length) return { content: null, articles: [] };
    const articles = await selectArticles(ranked, rawTitle, deps);
    if (!articles.length) return { content: null, articles: [] };

    let combined = `根据搜索关键词"${rawTitle}"，我找到了以下相关新闻文章：\n\n`;
    articles.forEach((article, index) => {
        combined += `【文章${index + 1}】${article.title}\n`;
        combined += `来源：${article.source}\n\n`;
        combined += `${article.content}\n\n`;
        combined += '---\n\n';
    });
    return {
        content: combined,
        articles: articles.map(article => ({
            title: article.title,
            link: article.source
        }))
    };
}

module.exports = {
    cleanHotSearchTitle,
    buildSearchQuery,
    buildGoogleParams,
    normalizeArticleUrl,
    isNonArticleUrl,
    isReputableDomain,
    keywordOverlap,
    scoreResult,
    dedupeResults,
    filterAndRankResults,
    titlesNearIdentical,
    isTextRelevant,
    searchNewsV2,
    selectArticles,
    fetchNewsContext,
    clearSearchCache,
    isGoogleSearchEnabled,
    SCORE_KEEP,
    TEXT_KEEP,
    MAX_GOOGLE_CALLS,
    MIN_KEEP,
    ARTICLE_TIMEOUT_MS
};
