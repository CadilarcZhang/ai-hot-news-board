'use strict';

const MAX_ARTICLES = 3;
const BODY_CHAR_LIMIT = 5000;
const MIN_REAL_TEXT = 200;
const MIN_BODY_CHARS = 40;
const TITLE_SLICE = 4;
const STALE_AFTER_DAYS = 2;

const SECTION_MARKERS = [
    '热门推荐',
    '相关推荐',
    '相关阅读',
    '猜你喜欢',
    '更多精彩',
    '推荐阅读',
    '延伸阅读',
    '分享到',
    '分享至',
    '扫一扫',
    '打开APP',
    '打开客户端',
    '责任编辑',
    '特别声明',
    '版权声明',
    '免责声明',
    '网友评论',
    '我要评论',
    '全部评论',
    '点击查看更多',
    '关注我们'
];

function compact(value) {
    return String(value || '').replace(/[\s\p{P}\p{S}]/gu, '');
}

function sharesSlice(query, text) {
    const q = compact(query);
    const t = compact(text);
    if (!q || !t) return false;
    if (q.length < TITLE_SLICE) return t.includes(q);
    for (let i = 0; i <= q.length - TITLE_SLICE; i += 1) {
        if (t.includes(q.slice(i, i + TITLE_SLICE))) return true;
    }
    return false;
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 官方日期经常只到日。用日期字符串里的年月日，
 * 和当前北京时间的日历日比较，避免 UTC 零点把「三天前」算成两天。
 */
function civilDay(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor((value + BEIJING_OFFSET_MS) / 86400000);
    }
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    }
    const time = Date.parse(text);
    if (!Number.isFinite(time)) return null;
    return Math.floor((time + BEIJING_OFFSET_MS) / 86400000);
}

function isStaleDate(value, nowMs) {
    const day = civilDay(value);
    if (day == null) return false;
    const today = civilDay(nowMs);
    return today - day > STALE_AFTER_DAYS;
}

function isChromeLine(line) {
    const text = line.trim();
    if (!text) return false;
    if (/^(分享|收藏|点赞|评论|举报|首页|推荐)$/.test(text)) return true;
    if (text.length <= 24 && SECTION_MARKERS.some((marker) => text.includes(marker))) return true;
    return false;
}

function startsSection(line) {
    const text = line.trim();
    return SECTION_MARKERS.some((marker) => text.startsWith(marker));
}

/**
 * 去掉开头的导航行，以及正文之后另起一行的推荐、分享和评论。
 * 短讯里正常出现的词语保留。
 */
function trimArticleBody(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const kept = [];
    for (const line of lines) {
        const text = line.trim();
        if (!text) {
            if (kept.length) kept.push('');
            continue;
        }
        const soFar = kept.join('\n').trim();
        if (startsSection(text)) {
            if (soFar.length > 0) break;
            continue;
        }
        if (isChromeLine(text)) {
            if (soFar.length >= 80) break;
            continue;
        }
        kept.push(text);
    }
    let body = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body.length > BODY_CHAR_LIMIT) {
        body = body.slice(0, BODY_CHAR_LIMIT);
    }
    return body;
}

function realTextLength(articles) {
    return articles.reduce((sum, article) => sum + article.content.length, 0);
}

function combineArticles(query, articles) {
    if (!articles.length) return '';
    let combined = `根据搜索关键词"${query}"，我找到了以下相关新闻文章：\n\n`;
    articles.forEach((article, index) => {
        combined += `【文章${index + 1}】${article.title}\n`;
        combined += `来源：${article.link}\n\n`;
        combined += `${article.content}\n\n`;
        combined += '---\n\n';
    });
    return combined;
}

/**
 * 只用 content。摘要和短句不能拿来凑正文。
 * 日期按北京日历日比较，超过两天的结果丢掉。
 */
function selectArticles(results, query, nowMs) {
    const accepted = [];
    const dropped = [];
    const list = Array.isArray(results) ? results : [];
    for (const item of list) {
        const title = item && item.title ? String(item.title).trim() : '';
        const link = item && item.url ? String(item.url).trim() : '';
        const content = trimArticleBody(item && item.content);
        const reason = rejectReason(query, title, link, content, item && item.date, nowMs);
        if (reason) {
            dropped.push({ title, reason });
            continue;
        }
        accepted.push({
            title,
            link,
            content,
            date: item.date || null
        });
        if (accepted.length >= MAX_ARTICLES) break;
    }
    const textLength = realTextLength(accepted);
    return {
        articles: accepted,
        dropped,
        textLength,
        sufficient: textLength >= MIN_REAL_TEXT,
        merged: combineArticles(query, accepted)
    };
}

function rejectReason(query, title, link, content, date, nowMs) {
    if (!title || !link || !/^https?:\/\//i.test(link)) return 'missing';
    if (isStaleDate(date, nowMs)) return 'stale';
    if (!sharesSlice(query, title)) return 'title';
    if (content.length < MIN_BODY_CHARS) return 'short';
    if (!sharesSlice(query, content)) return 'body';
    return '';
}

module.exports = {
    MAX_ARTICLES,
    BODY_CHAR_LIMIT,
    MIN_REAL_TEXT,
    STALE_AFTER_DAYS,
    trimArticleBody,
    selectArticles,
    combineArticles,
    sharesSlice,
    isStaleDate
};
