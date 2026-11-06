'use strict';

const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

// keepAlive：同一实例上的百度检索和文章抓取复用 TLS，避免每次冷握手。
// 空闲连接被对端关掉时，调用方对 ECONNRESET 再试一次。
const httpAgent = new http.Agent({
    family: 4,
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 8,
    maxFreeSockets: 4
});
const httpsAgent = new https.Agent({
    family: 4,
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 8,
    maxFreeSockets: 4
});

/**
 * Preview functions on Node 26 reset Baidu (`socket hang up`) and time out
 * TianAPI. Those hosts are reachable over IPv4 from the production Node 24
 * runtime in iad1; an IPv6 attempt is not. Prefer IPv4 and do not race a
 * broken AAAA record (Node auto-select turns that race into a failed request).
 */
function preferIpv4() {
    if (typeof dns.setDefaultResultOrder === 'function') {
        dns.setDefaultResultOrder('ipv4first');
    }
    if (typeof net.setDefaultAutoSelectFamily === 'function') {
        try {
            net.setDefaultAutoSelectFamily(false);
        } catch (error) {
            // Some Node builds expose the function but reject the call.
        }
    }
}

preferIpv4();

const ipv4Cache = new Map();

function lookupIpv4(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const cached = ipv4Cache.get(hostname);
    if (cached) {
        cb(null, cached, 4);
        return;
    }
    dns.lookup(hostname, { family: 4 }, (error, address, family) => {
        if (!error && address) {
            ipv4Cache.set(hostname, address);
        }
        cb(error, address, family || 4);
    });
}

function installLookup(agent) {
    const original = agent.createConnection.bind(agent);
    agent.createConnection = function createConnection(options, callback) {
        const next = Object.assign({}, options, { family: 4, lookup: lookupIpv4 });
        return original(next, callback);
    };
}

installLookup(httpAgent);
installLookup(httpsAgent);

function primeIpv4(hostname) {
    if (!hostname || ipv4Cache.has(hostname)) {
        return;
    }
    dns.lookup(hostname, { family: 4 }, (error, address) => {
        if (!error && address) {
            ipv4Cache.set(hostname, address);
        }
    });
}

/**
 * 冷启动时先完成一次 TLS，后面的搜索复用 keepAlive 套接字。
 * 不等待结果；失败被忽略。
 */
function warmHttpsOrigin(hostname) {
    try {
        const req = https.request({
            host: hostname,
            port: 443,
            servername: hostname,
            method: 'HEAD',
            path: '/',
            agent: httpsAgent,
            family: 4,
            headers: { Host: hostname }
        });
        req.setTimeout(2500, () => req.destroy());
        req.on('error', () => {});
        req.on('response', (res) => {
            res.resume();
        });
        req.end();
    } catch (error) {
        // 预热失败不影响真正的搜索。
    }
}

function withIpv4(options) {
    return Object.assign({
        family: 4,
        httpAgent,
        httpsAgent
    }, options);
}

module.exports = {
    preferIpv4,
    primeIpv4,
    warmHttpsOrigin,
    withIpv4
};
