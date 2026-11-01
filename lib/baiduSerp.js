'use strict';

const cheerio = require('cheerio');

const BAIDU_RESULT_LIMIT = 5;
const BAIDU_HTML_CHECK_BYTES = 32 * 1024;
const BAIDU_HTML_MAX_BYTES = 384 * 1024;

/**
 * 与原先 searchBaidu 相同的选择器。只解析已经读到的 HTML。
 */
function extractBaiduNewsResults(html, limit = BAIDU_RESULT_LIMIT) {
    if (!html || limit <= 0) {
        return [];
    }
    const $ = cheerio.load(html);
    const results = [];

    $('.result, .c-result, .result-op').each((index, element) => {
        if (results.length >= limit) return false;

        const $el = $(element);
        const title = $el.find('h3 a, .t a, .c-title-text').text().trim();
        let link = $el.find('h3 a, .t a').attr('href') || $el.find('a').first().attr('href');
        const snippet = $el.find('.c-abstract, .c-span9, .c-abstract-text, .c-color-text').text().trim();

        if (title && link) {
            if (link.startsWith('/link?url=')) {
                try {
                    const urlMatch = link.match(/url=([^&]+)/);
                    if (urlMatch) {
                        link = decodeURIComponent(urlMatch[1]);
                    }
                } catch (e) {
                    return;
                }
            }

            if (link && link.startsWith('http')) {
                results.push({
                    title,
                    link: link,
                    snippet: snippet || title
                });
            }
        }
    });

    return results;
}

function countResultMarkers(html) {
    if (!html) {
        return 0;
    }
    const needles = ['result-op', 'c-result', 'class="result'];
    let best = 0;
    for (const needle of needles) {
        let from = 0;
        let count = 0;
        while (count <= BAIDU_RESULT_LIMIT) {
            const at = html.indexOf(needle, from);
            if (at === -1) break;
            count += 1;
            from = at + needle.length;
        }
        if (count > best) best = count;
    }
    return best;
}

/**
 * 读到足够的搜索结果就停，避免把整页脚本下载完才解析。
 * 选择器没凑满时继续读到流结束或 maxBytes。
 */
function collectHtmlUntilResults(stream, extract, options = {}) {
    const limit = options.limit || BAIDU_RESULT_LIMIT;
    const maxBytes = options.maxBytes || BAIDU_HTML_MAX_BYTES;
    const checkBytes = options.checkBytes || BAIDU_HTML_CHECK_BYTES;
    const parse = typeof extract === 'function' ? extract : extractBaiduNewsResults;

    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let nextCheck = checkBytes;
        let settled = false;

        const stop = (early) => {
            if (settled) return;
            settled = true;
            const html = Buffer.concat(chunks).toString('utf8');
            try {
                stream.destroy();
            } catch (error) {
                // 流可能已经结束。
            }
            resolve({
                html,
                bytes: size,
                early,
                results: parse(html, limit)
            });
        };

        // 三类 class 不会同时出现，标记数可能小于已解析条数。有标记再解析。
        const consider = () => {
            const html = Buffer.concat(chunks).toString('utf8');
            if (countResultMarkers(html) > 0 && parse(html, limit).length >= limit) {
                stop(true);
            }
        };

        stream.on('data', (chunk) => {
            if (settled) return;
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            let offset = 0;
            while (offset < buf.length && !settled) {
                const step = Math.min(checkBytes, buf.length - offset);
                chunks.push(buf.subarray(offset, offset + step));
                size += step;
                offset += step;
                if (size >= maxBytes) {
                    stop(true);
                    return;
                }
                if (size < nextCheck) continue;
                nextCheck += checkBytes;
                consider();
            }
        });
        stream.on('end', () => stop(false));
        stream.on('error', (error) => {
            if (settled) return;
            if (size > 0) {
                stop(true);
                return;
            }
            settled = true;
            reject(error);
        });
    });
}

module.exports = {
    BAIDU_RESULT_LIMIT,
    BAIDU_HTML_CHECK_BYTES,
    BAIDU_HTML_MAX_BYTES,
    extractBaiduNewsResults,
    countResultMarkers,
    collectHtmlUntilResults
};
