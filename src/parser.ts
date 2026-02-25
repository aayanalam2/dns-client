import { DNSBuffer } from './DNSBuffer.js';
import { RecordType, DNSAnswer } from './types.js';

function ipv4FromBytes(b: Buffer) {
  return Array.from(b)
    .map((x) => x.toString())
    .join('.');
}

function ipv6FromBytes(b: Buffer) {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    parts.push(b.readUInt16BE(i).toString(16));
  }
  return parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::');
}

const parseA = (b: DNSBuffer, pos: number, rdlen: number) => {
  const buf = b.readBytesAt(pos, rdlen);
  return ipv4FromBytes(buf);
};

const parseAAAA = (b: DNSBuffer, pos: number, rdlen: number) => {
  const buf = b.readBytesAt(pos, rdlen);
  return ipv6FromBytes(buf);
};

const parseName = (b: DNSBuffer, pos: number) => {
  return b.readNameAt(pos).name;
};

const parseMX = (b: DNSBuffer, pos: number) => {
  const preference = b.readUint16At(pos);
  const exchange = b.readNameAt(pos + 2).name;
  return `${preference} ${exchange}`;
};

const answerParsers: Record<
  number,
  (b: DNSBuffer, pos: number, rdlen: number) => string
> = {
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
  const pos = b.offset;
  const parser = answerParsers[type];
  const data = parser ? parser(b, pos, rdlen) : (b.readBytes(rdlen), '');
  b.advanceOffset(rdlen);

  return { name, type, class: cls, ttl, data };
}

export function parseResponse(buf: Buffer): { answers: DNSAnswer[] } {
  const b = new DNSBuffer(buf);
  const header = b.readHeader();

  // skip questions
  for (let i = 0; i < header.qdcount; i++) {
    b.readName();
    b.readUint16();
    b.readUint16();
  }

  const answers: DNSAnswer[] = [];
  for (let i = 0; i < header.ancount; i++) {
    const name = b.readName();
    const type = b.readUint16();
    const cls = b.readUint16();
    const ttl = b.readUint32();
    const rdlen = b.readUint16();
    answers.push(parseAnswer(b, name, type, cls, ttl, rdlen));
  }

  return { answers };
}
