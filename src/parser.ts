import { DNSBuffer } from './DNSBuffer';
import { RecordType, DNSAnswer } from './types';

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

export function parseResponse(buf: Buffer): { answers: DNSAnswer[] } {
  const b = new DNSBuffer(buf);
  const id = b.readUint16();
  const flags = b.readUint16();
  const qdcount = b.readUint16();
  const ancount = b.readUint16();
  b.readUint16(); // nscount
  b.readUint16(); // arcount

  // skip questions
  for (let i = 0; i < qdcount; i++) {
    b.readName();
    b.readUint16();
    b.readUint16();
  }

  const answers: DNSAnswer[] = [];
  for (let i = 0; i < ancount; i++) {
    const name = b.readName();
    const type = b.readUint16();
    const cls = b.readUint16();
    const ttl = b.readUint32();
    const rdlen = b.readUint16();
    if (type === RecordType.A) {
      const data = b.readBytes(rdlen);
      answers.push({ name, type, class: cls, ttl, data: ipv4FromBytes(data) });
    } else if (type === RecordType.AAAA) {
      const data = b.readBytes(rdlen);
      answers.push({ name, type, class: cls, ttl, data: ipv6FromBytes(data) });
    } else if (type === RecordType.CNAME) {
      // rdata may be a name (possibly compressed)
      const pos = b.offset;
      const r = b.readNameAt(pos);
      b.offset = pos + rdlen;
      answers.push({ name, type, class: cls, ttl, data: r.name });
    } else if (type === RecordType.NS) {
      const pos = b.offset;
      const r = b.readNameAt(pos);
      b.offset = pos + rdlen;
      answers.push({ name, type, class: cls, ttl, data: r.name });
    } else if (type === RecordType.MX) {
      const pos = b.offset;
      const preference = b.readUint16();
      const exchange = b.readNameAt(pos + 2).name;
      b.offset = pos + rdlen;
      answers.push({
        name,
        type,
        class: cls,
        ttl,
        data: `${preference} ${exchange}`,
      });
    } else {
      // unknown type: skip
      b.readBytes(rdlen);
    }
  }

  return { answers };
}
