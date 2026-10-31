'use strict';

const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

const httpAgent = new http.Agent({ family: 4, keepAlive: false });
const httpsAgent = new https.Agent({ family: 4, keepAlive: false });

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

function withIpv4(options) {
    return Object.assign({
        family: 4,
        httpAgent,
        httpsAgent
    }, options);
}

module.exports = {
    preferIpv4,
    withIpv4
};
