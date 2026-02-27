import { DNSBuffer } from '../core/DNSBuffer.js';
import { RecordType, DNSAnswer } from '../core/types.js';

function ipv4FromBytes(b: Buffer) {
  if (b.length !== 4) {
    throw new Error(`A record must have rdlen=4, got ${b.length}`);
  }
  return Array.from(b)
    .map((x) => x.toString())
    .join('.');
}

function ipv6FromBytes(b: Buffer) {
  if (b.length !== 16) {
    throw new Error(`AAAA record must have rdlen=16, got ${b.length}`);
  }
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    parts.push(b.readUInt16BE(i).toString(16));
  }
  // Return fully expanded address (no compression)
  return parts.join(':');
}

const parseA = (b: DNSBuffer, rdlen: number) => {
  const buf = b.readBytes(rdlen!);
  return ipv4FromBytes(buf);
};

const parseAAAA = (b: DNSBuffer, rdlen: number) => {
  const buf = b.readBytes(rdlen!);
  return ipv6FromBytes(buf);
};

const parseName = (b: DNSBuffer, rdlen: number) => {
  const start = b.offset;
  const name = b.readName();
  const bytesRead = b.offset - start;
  if (bytesRead !== rdlen) {
    throw new Error(
      `Name parsing consumed ${bytesRead} bytes but rdlen=${rdlen}`
    );
  }
  return name;
};

const parseMX = (b: DNSBuffer, rdlen: number) => {
  const start = b.offset;
  const preference = b.readUint16();
  const exchange = b.readName();
  const bytesRead = b.offset - start;
  if (bytesRead !== rdlen) {
    throw new Error(
      `MX parsing consumed ${bytesRead} bytes but rdlen=${rdlen}`
    );
  }
  return `${preference} ${exchange}`;
};

const answerParsers: Record<number, (b: DNSBuffer, rdlen: number) => string> = {
  [RecordType.A]: parseA,
  [RecordType.AAAA]: parseAAAA,
  [RecordType.CNAME]: parseName,
  [RecordType.NS]: parseName,
  [RecordType.MX]: parseMX,
};

function parseAnswer(
  b: DNSBuffer,
  name: string,
  type: number,
  cls: number,
  ttl: number,
  rdlen: number
): DNSAnswer {
  const parser = answerParsers[type];
  const data = parser ? parser(b, rdlen) : b.readBytes(rdlen).toString('hex');

  return { name, type, class: cls, ttl, data };
}

function* parseAnswers(b: DNSBuffer, count: number): Generator<DNSAnswer> {
  for (let i = 0; i < count; i++) {
    const name = b.readName();
    const type = b.readUint16();
    const cls = b.readUint16();
    const ttl = b.readUint32();
    const rdlen = b.readUint16();
    yield parseAnswer(b, name, type, cls, ttl, rdlen);
  }
}

export function parseResponse(
  buf: Buffer,
  queryID?: number
): { answers: DNSAnswer[] } {
  const b = new DNSBuffer(buf);
  const header = b.readHeader();

  // Validate response ID matches query ID
  if (queryID !== undefined && header.id !== queryID) {
    throw new Error(
      `Response ID mismatch: expected ${queryID}, got ${header.id}`
    );
  }

  // skip questions
  for (let i = 0; i < header.qdcount; i++) {
    b.readName();
    b.readUint16();
    b.readUint16();
  }

  const answers: DNSAnswer[] = [...parseAnswers(b, header.ancount)];

  return { answers };
}
