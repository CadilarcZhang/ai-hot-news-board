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

    /**
     * 同一次列表里，用户点过文章之后，延迟的第一条预览不能再改选中项。
     * 换列表会作废上一轮缓存配图的延迟任务，避免写进新文章。
     */
    function createArticleFocus() {
        let generation = 0;
        let choice = 0;
        let activeKey = null;

        function beginList() {
            generation += 1;
            activeKey = null;
        }

        function noteUserChoice(key) {
            choice += 1;
            activeKey = key;
        }

        function watchAutoPreview(isListCurrent) {
            const generationAt = generation;
            const choiceAt = choice;
            return function shouldPreview() {
                if (generation !== generationAt || choice !== choiceAt) {
                    return false;
                }
                if (typeof isListCurrent === 'function' && !isListCurrent()) {
                    return false;
                }
                return true;
            };
        }

        function watchCachedImage(key) {
            const generationAt = generation;
            activeKey = key;
            return function shouldGenerate() {
                return generation === generationAt && activeKey === key;
            };
        }

        function scheduleWhen(delayMs, shouldRun, fn) {
            return setTimeout(function () {
                if (typeof shouldRun === 'function' && !shouldRun()) {
                    return;
                }
                fn();
            }, delayMs);
        }

        return {
            beginList: beginList,
            noteUserChoice: noteUserChoice,
            watchAutoPreview: watchAutoPreview,
            watchCachedImage: watchCachedImage,
            scheduleWhen: scheduleWhen
        };
    }

    return {
        createLatestGate: createLatestGate,
        createArticleFocus: createArticleFocus
    };
});
