import { DNSBuffer } from '../core/DNSBuffer.js';
import { RecordType } from '../core/types.js';
import { TransportType } from '../core/types.js';

export class DNSQuery {
  id: number;
  qname: string;
  qtype: RecordType;
  transportType: TransportType;

  constructor(
    name: string,
    type: RecordType,
    transportType: TransportType = TransportType.UDP
  ) {
    this.id = Math.floor(Math.random() * 0xffff);
    this.qname = name;
    this.qtype = type;
    this.transportType = transportType;
  }

  static ipv4(name: string, transportType: TransportType = TransportType.UDP) {
    return new DNSQuery(name, RecordType.A, transportType);
  }
  static ns(name: string, transportType: TransportType = TransportType.UDP) {
    return new DNSQuery(name, RecordType.NS, transportType);
  }
  static aaaa(name: string, transportType: TransportType = TransportType.UDP) {
    return new DNSQuery(name, RecordType.AAAA, transportType);
  }
  static mx(name: string, transportType: TransportType = TransportType.UDP) {
    return new DNSQuery(name, RecordType.MX, transportType);
  }
  static cname(name: string, transportType: TransportType = TransportType.UDP) {
    return new DNSQuery(name, RecordType.CNAME, transportType);
  }

  pack(): Buffer {
    // Build the DNS message portion in a temporary buffer
    const dnsBuffer = new DNSBuffer(512);
    dnsBuffer.writeUint16(this.id);
    // flags: RD = 1 (lowest bit of first flags byte). Z=010 => in second byte bits6-4
    const firstFlags = 0x01; // RD
    const secondFlags = 0x20; // Z=2 << 4
    const flags = (firstFlags << 8) | secondFlags;
    dnsBuffer.writeUint16(flags);
    dnsBuffer.writeUint16(1); // qdcount
    dnsBuffer.writeUint16(0); // ancount
    dnsBuffer.writeUint16(0); // nscount
    dnsBuffer.writeUint16(0); // arcount

    dnsBuffer.writeName(this.qname);
    dnsBuffer.writeUint16(this.qtype);
    dnsBuffer.writeUint16(1); // class IN

    const dnsMessage = dnsBuffer.bytes();

    // TCP requires 2-byte big-endian length prefix before the DNS message (RFC 1035)
    if (this.transportType === TransportType.TCP) {
      const packet = Buffer.alloc(dnsMessage.length + 2);
      packet.writeUInt16BE(dnsMessage.length, 0);
      dnsMessage.copy(packet, 2);
      return packet;
    }

    // UDP sends the DNS message as-is
    return dnsMessage;
  }
}
