import { Buffer } from 'buffer';
import { ByteCursor } from './ByteCursor.js';
import { DNSHeader } from './types.js';

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
  readName(): string {
    const result = this.readNameInternal(this.offset);
    this.offset += result.length;
    return result.name;
  }

  private readNameInternal(
    startPos: number,
    depth = 0
  ): { name: string; length: number } {
    if (depth > MAX_NAME_JUMPS) {
      throw new Error('name compression pointer loop');
    }

    let off = startPos;
    const labels: string[] = [];
    const origOff = startPos;

    while (true) {
      const len = this.readUint8At(off);
      if ((len & DNS_POINTER_MASK) === DNS_POINTER_VALUE) {
        const b2 = this.readUint8At(off + 1);
        const ptr = ((len & DNS_POINTER_OFFSET_MASK) << 8) | b2;
        // Validate pointer bounds
        if (ptr < 0 || ptr >= this.buf.length) {
          throw new Error('DNS name pointer out of bounds');
        }
        const r = this.readNameInternal(ptr, depth + 1);
        labels.push(r.name);
        off += 2;
        break;
      }
      off += 1;
      if (len === 0) break;
      // Validate label length
      if (len > MAX_LABEL_LENGTH) {
        throw new Error(
          `DNS label length ${len} exceeds maximum ${MAX_LABEL_LENGTH}`
        );
      }
      labels.push(this.readBytesAt(off, len).toString('ascii'));
      off += len;
    }

    return { name: labels.filter(Boolean).join('.'), length: off - origOff };
  }

  writeName(name: string) {
    // Validate domain name
    if (name === '') {
      this.writeUint8(0);
      return;
    }

    if (name.length > 255) {
      throw new Error('domain name exceeds 255 bytes');
    }

    const parts = name.split('.');

    for (const part of parts) {
      if (part === '') {
        throw new Error('domain name contains empty label');
      }
      const len = Buffer.byteLength(part);
      if (len > MAX_LABEL_LENGTH) {
        throw new Error(`label "${part}" exceeds ${MAX_LABEL_LENGTH} bytes`);
      }
    }

    for (const p of parts) {
      const len = Buffer.byteLength(p);
      this.writeUint8(len);
      this.writeBytes(Buffer.from(p, 'ascii'));
    }
    this.writeUint8(0);
  }

  // DNS header reading
  readHeader(): DNSHeader {
    return {
      id: this.readUint16(),
      flags: this.readUint16(),
      qdcount: this.readUint16(),
      ancount: this.readUint16(),
      nscount: this.readUint16(),
      arcount: this.readUint16(),
    };
  }
}
