"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const DNSQuery_1 = require("../src/DNSQuery");
const assert_1 = __importDefault(require("assert"));
function hex(b) { return b.toString('hex'); }
function testPack() {
    const q = DNSQuery_1.DNSQuery.ipv4('example.com');
    const pkt = q.pack();
    // header must be at least 12 bytes and contain qdcount=1
    (0, assert_1.default)(pkt.length >= 12);
    const qdcount = pkt.readUInt16BE(4);
    assert_1.default.strictEqual(qdcount, 1);
    console.log('testPack OK');
}
function runAll() {
    testPack();
    console.log('ALL OK');
}
runAll();
