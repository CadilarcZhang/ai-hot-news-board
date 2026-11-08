(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.LatestResponse = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    /**
     * 只采纳最后一次热搜请求。更早的响应不能改当前平台，也不能打开文章。
     */
    function createLatestGate() {
        let current = 0;
        return {
            issue() {
                current += 1;
                const token = current;
                return {
                    token: token,
                    isCurrent: function () {
                        return token === current;
                    }
                };
            },
            invalidate() {
                current += 1;
            }
        };
    }

    return {
        createLatestGate: createLatestGate
    };
});
