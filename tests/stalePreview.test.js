'use strict';

const assert = require('assert');
const { createArticleFocus, createLatestGate } = require('../public/js/latestResponse');

function installFakeTimers() {
    const originalSet = global.setTimeout;
    const originalClear = global.clearTimeout;
    let now = 0;
    let seq = 1;
    const pending = [];

    global.setTimeout = function (fn, ms) {
        const id = seq++;
        pending.push({
            id: id,
            fn: fn,
            at: now + (Number(ms) || 0),
            cleared: false
        });
        return id;
    };
    global.clearTimeout = function (id) {
        pending.forEach((item) => {
            if (item.id === id) item.cleared = true;
        });
    };

    return {
        advance(ms) {
            const target = now + ms;
            while (true) {
                const next = pending
                    .filter((item) => !item.cleared && item.at <= target)
                    .sort((a, b) => a.at - b.at || a.id - b.id)[0];
                if (!next) break;
                now = next.at;
                next.cleared = true;
                next.fn();
            }
            now = target;
        },
        restore() {
            global.setTimeout = originalSet;
            global.clearTimeout = originalClear;
        }
    };
}

function testUserClickBeatsAutomaticPreview() {
    const clock = installFakeTimers();
    try {
        const focus = createArticleFocus();
        const gate = createLatestGate();
        const ticket = gate.issue();
        focus.beginList();
        const shouldPreview = focus.watchAutoPreview(() => ticket.isCurrent());
        let selected = null;
        focus.scheduleWhen(300, shouldPreview, () => {
            selected = 1;
        });
        focus.noteUserChoice('2\n用户先点的文章');
        clock.advance(300);
        assert.strictEqual(selected, null);
    } finally {
        clock.restore();
    }
}

function testAutomaticPreviewStillRunsWithoutAClick() {
    const clock = installFakeTimers();
    try {
        const focus = createArticleFocus();
        const gate = createLatestGate();
        const ticket = gate.issue();
        focus.beginList();
        const shouldPreview = focus.watchAutoPreview(() => ticket.isCurrent());
        let selected = null;
        focus.scheduleWhen(300, shouldPreview, () => {
            selected = 1;
        });
        clock.advance(299);
        assert.strictEqual(selected, null);
        clock.advance(1);
        assert.strictEqual(selected, 1);
    } finally {
        clock.restore();
    }
}

function testCachedImageDoesNotStartAfterSwitch() {
    const clock = installFakeTimers();
    try {
        const focus = createArticleFocus();
        focus.beginList();
        const shouldImage = focus.watchCachedImage('1\n缓存文章');
        let started = false;
        let overwritten = false;
        focus.scheduleWhen(500, shouldImage, () => {
            started = true;
            overwritten = true;
        });
        focus.noteUserChoice('3\n另一条');
        clock.advance(500);
        assert.strictEqual(started, false);
        assert.strictEqual(overwritten, false);

        focus.beginList();
        const staleAfterList = focus.watchCachedImage('1\n旧平台');
        focus.scheduleWhen(500, staleAfterList, () => {
            started = true;
        });
        focus.beginList();
        const currentImage = focus.watchCachedImage('1\n新平台');
        let currentStarted = false;
        focus.scheduleWhen(500, currentImage, () => {
            currentStarted = true;
        });
        clock.advance(500);
        assert.strictEqual(started, false);
        assert.strictEqual(currentStarted, true);
    } finally {
        clock.restore();
    }
}

function testCachedImageStillRunsForTheActiveArticle() {
    const clock = installFakeTimers();
    try {
        const focus = createArticleFocus();
        focus.beginList();
        const shouldImage = focus.watchCachedImage('1\n当前文章');
        let started = false;
        focus.scheduleWhen(500, shouldImage, () => {
            started = true;
        });
        clock.advance(500);
        assert.strictEqual(started, true);
    } finally {
        clock.restore();
    }
}

function run() {
    testUserClickBeatsAutomaticPreview();
    testAutomaticPreviewStillRunsWithoutAClick();
    testCachedImageDoesNotStartAfterSwitch();
    testCachedImageStillRunsForTheActiveArticle();
    console.log('stalePreview tests ok');
}

run();
