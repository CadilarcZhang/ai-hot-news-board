'use strict';

const SUMMARY_MODEL = 'deepseek-flash';

/**
 * 联网搜索摘要的上游请求体，正文不足时的回退走同一条请求。
 * 思考完整关闭，并且不带 reasoning_effort。高强度推理只在思考开启时有意义，
 * 留在请求里会把摘要重新送回思考档。
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Object}
 */
function buildSearchSummaryCompletion(messages) {
    const data = {
        model: SUMMARY_MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        top_p: 0.95,
        thinking: { type: 'disabled' },
        response_format: { type: 'text' }
    };
    delete data.reasoning_effort;
    return data;
}

module.exports = {
    SUMMARY_MODEL,
    buildSearchSummaryCompletion
};
