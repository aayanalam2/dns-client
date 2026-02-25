import { Buffer } from 'buffer';
import { ByteCursor } from './ByteCursor.js';

const DNS_POINTER_MASK = 0xc0;
const DNS_POINTER_VALUE = 0xc0;
const DNS_POINTER_OFFSET_MASK = 0x3f;
const MAX_LABEL_LENGTH = 63;
const MAX_NAME_JUMPS = 32;

/**
 * DNSBuffer: Sequential buffer reader/writer with DNS-specific operations.
 * Extends ByteCursor and adds DNS name encoding/decoding.
 */
export class DNSBuffer extends ByteCursor {
  constructor(sizeOrBuffer: number | Buffer = 512) {
    super(sizeOrBuffer);
  }

  // DNS name encoding/decoding
  readName(pos?: number): string {
    const startPos = pos ?? this.offset;
    const result = this.readNameAt(startPos);
    if (pos === undefined) {
      this.advanceOffset(result.length);
    }
    return result.name;
  }

  readNameAt(pos: number, depth = 0): { name: string; length: number } {
    if (depth > MAX_NAME_JUMPS) {
      throw new Error('name compression pointer loop');
    }

    let off = pos;
    const labels: string[] = [];
    const origOff = pos;

    while (true) {
      const len = this.readUint8At(off);
      if ((len & DNS_POINTER_MASK) === DNS_POINTER_VALUE) {
        const b2 = this.readUint8At(off + 1);
        const ptr = ((len & DNS_POINTER_OFFSET_MASK) << 8) | b2;
        const r = this.readNameAt(ptr, depth + 1);
        labels.push(r.name);
        off += 2;
        break;
      }
      off += 1;
      if (len === 0) break;
      labels.push(this.readStringAt(off, len));
      off += len;
    }

    return { name: labels.filter(Boolean).join('.'), length: off - origOff };
  }

  writeName(name: string) {
    if (name === '') {
      this.writeUint8(0);
      return;
    }
    const parts = name.split('.');
    for (const p of parts) {
      const len = Buffer.byteLength(p);
      if (len === 0) continue;
      if (len > MAX_LABEL_LENGTH) throw new Error('label too long');
      this.writeUint8(len);
      this.writeBytes(Buffer.from(p, 'ascii'));
    }
    this.writeUint8(0);
  }

  // DNS header reading
  readHeader() {
    return {
      id: this.readUint16(),
      flags: this.readUint16(),
      qdcount: this.readUint16(),
      ancount: this.readUint16(),
      nscount: this.readUint16(),
      arcount: this.readUint16(),
    };
  }

  readDataAt(pos: number, len: number): Buffer {
    return this.readBytesAt(pos, len);
  }

  readUint16At(pos: number): number {
    return super.readUint16At(pos);
  }
}
