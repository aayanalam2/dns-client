import { DNSQuery } from '../src/DNSQuery.js';
import assert from 'assert';

function testPack() {
  const q = DNSQuery.ipv4('example.com');
  const pkt = q.pack();
  assert(pkt.length >= 12);
  const qdcount = pkt.readUInt16BE(4);
  assert.strictEqual(qdcount, 1);
  console.log('testPack OK');
}

function runAll() {
  testPack();
  console.log('ALL OK');
}

runAll();
