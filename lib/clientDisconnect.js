'use strict';

/**
 * 为这一次响应单独建一个 AbortController。
 *
 * Node/Express 实测（先 finish 再 close）：
 * - 正常写完时 res.finish 先发生，随后 res.close 和 req.close，此时 writableFinished 已经是 true。
 * - 客户端中途断开时只有 res.close / req.close，writableFinished 仍是 false，也不会有 finish。
 * GET/SSE 的请求体在响应结束前就消费完了。若在 req.close 上无条件 abort，
 * 会把一次正常生成取消掉。只有响应还没写完就 close，才取消这一次的上游。
 */
function bindClientAbort(res) {
    const controller = new AbortController();
    let finished = false;

    res.on('finish', () => {
        finished = true;
    });

    res.on('close', () => {
        if (finished || res.writableFinished) {
            return;
        }
        controller.abort();
    });

    return controller;
}

/**
 * 把父级取消传给这一次调用自己的 controller。
 * 不会碰到别的请求持有的 controller。
 */
function linkAbortSignal(parent, child) {
    if (!parent || !child) {
        return function unlink() {};
    }
    const abortChild = () => {
        if (!child.signal.aborted) {
            child.abort();
        }
    };
    if (parent.aborted) {
        abortChild();
        return function unlink() {};
    }
    parent.addEventListener('abort', abortChild, { once: true });
    return function unlink() {
        parent.removeEventListener('abort', abortChild);
    };
}

module.exports = {
    bindClientAbort,
    linkAbortSignal
};
