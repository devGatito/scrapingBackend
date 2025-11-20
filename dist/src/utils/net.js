"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlockedHost = isBlockedHost;
exports.isPrivateIp = isPrivateIp;
const promises_1 = require("dns/promises");
const ipaddr_js_1 = __importDefault(require("ipaddr.js"));
async function isBlockedHost(hostname) {
    const hn = hostname.toLowerCase();
    if (hn === 'localhost' || hn === '127.0.0.1' || hn === '::1' || hn.endsWith('.local')) {
        return { blocked: true, reason: 'BLOCKED_HOST' };
    }
    try {
        const { address } = await (0, promises_1.lookup)(hn, { all: false });
        if (isPrivateIp(address))
            return { blocked: true, reason: 'BLOCKED_PRIVATE_IP' };
    }
    catch {
        return { blocked: true, reason: 'DNS_RESOLUTION_FAILED' };
    }
    return { blocked: false };
}
function isPrivateIp(address) {
    try {
        const ip = ipaddr_js_1.default.parse(address);
        return ip.range() !== 'unicast';
    }
    catch {
        return true;
    }
}
