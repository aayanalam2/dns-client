import { DNSBuffer } from './DNSBuffer';
import { RecordType } from './types';

export class DNSQuery {
  id: number;
  qname: string;
  qtype: RecordType;

  constructor(name: string, type: RecordType) {
    this.id = Math.floor(Math.random() * 0xffff);
    this.qname = name;
    this.qtype = type;
  }

  static ipv4(name: string) {
    return new DNSQuery(name, RecordType.A);
  }
  static ns(name: string) {
    return new DNSQuery(name, RecordType.NS);
  }
  static aaaa(name: string) {
    return new DNSQuery(name, RecordType.AAAA);
  }
  static mx(name: string) {
    return new DNSQuery(name, RecordType.MX);
  }
  static cname(name: string) {
    return new DNSQuery(name, RecordType.CNAME);
  }

  pack(): Buffer {
    const b = new DNSBuffer(512);
    b.writeUint16(this.id);
    // flags: RD = 1 (lowest bit of first flags byte). Z=010 => in second byte bits6-4
    const firstFlags = 0x01; // RD
    const secondFlags = 0x20; // Z=2 << 4
    const flags = (firstFlags << 8) | secondFlags;
    b.writeUint16(flags);
    b.writeUint16(1); // qdcount
    b.writeUint16(0); // ancount
    b.writeUint16(0); // nscount
    b.writeUint16(0); // arcount

    b.writeName(this.qname);
    b.writeUint16(this.qtype);
    b.writeUint16(1); // class IN

    return b.bytes();
  }
}
