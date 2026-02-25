import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { DNSBuffer } from '../src/DNSBuffer';
import { parseResponse } from '../src/parser';
import { RecordType } from '../src/types';

const QUERY_FILE_NAME = 'query_packet.bin';
const RESPONSE_FILE_NAME = 'response_packet.bin';
const MIN_DNS_HEADER_BYTES = 12;
const DNS_HEADER_QDCOUNT_OFFSET = 4;

function fixtureCandidates(fileName: string): string[] {
  return [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), 'test', 'fixtures', fileName)
  ];
}

function findFixture(fileName: string): string | null {
  const candidate = fixtureCandidates(fileName).find((p) => fs.existsSync(p));
  return candidate ?? null;
}

function testCapturedQueryPacket() {
  const queryPath = findFixture(QUERY_FILE_NAME);
  if (!queryPath) {
    console.log('testCapturedQueryPacket SKIPPED (missing query_packet.bin)');
    return;
  }

  const pkt = fs.readFileSync(queryPath);
  assert(pkt.length >= MIN_DNS_HEADER_BYTES, 'query packet too small');
  assert.strictEqual(pkt.readUInt16BE(DNS_HEADER_QDCOUNT_OFFSET), 1, 'qdcount should be 1');

  const b = new DNSBuffer(pkt);
  b.readUint16();
  b.readUint16();
  b.readUint16();
  b.readUint16();
  b.readUint16();
  b.readUint16();

  const qname = b.readName();
  const qtype = b.readUint16();
  const qclass = b.readUint16();
  assert.strictEqual(qname, 'carbonteq.com', 'captured qname should be carbonteq.com');
  assert.strictEqual(qtype, RecordType.A, 'captured qtype should be A');
  assert.strictEqual(qclass, 1, 'captured qclass should be IN');
  console.log('testCapturedQueryPacket OK');
}

function testCapturedResponsePacket() {
  const responsePath = findFixture(RESPONSE_FILE_NAME);
  if (!responsePath) {
    console.log('testCapturedResponsePacket SKIPPED (missing response_packet.bin)');
    return;
  }

  const pkt = fs.readFileSync(responsePath);
  assert(pkt.length >= MIN_DNS_HEADER_BYTES, 'response packet too small');
  const parsed = parseResponse(pkt);
  assert(parsed.answers.length > 0, 'response should contain at least one answer');
  assert(parsed.answers.some((a) => a.type === RecordType.A || a.type === RecordType.CNAME), 'response should contain A or CNAME answers');
  console.log('testCapturedResponsePacket OK');
}

function runFixtureTests() {
  testCapturedQueryPacket();
  testCapturedResponsePacket();
}

runFixtureTests();
