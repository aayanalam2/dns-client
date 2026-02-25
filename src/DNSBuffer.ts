import { Buffer } from 'buffer';

const DNS_POINTER_MASK = 0xc0;
const DNS_POINTER_VALUE = 0xc0;
const DNS_POINTER_OFFSET_MASK = 0x3f;
const MAX_LABEL_LENGTH = 63;
const MAX_NAME_JUMPS = 32;

export class DNSBuffer {
  buf: Buffer;
  offset: number = 0;

  constructor(sizeOrBuffer: number | Buffer = 512) {
    if (typeof sizeOrBuffer === 'number') this.buf = Buffer.alloc(sizeOrBuffer);
    else this.buf = sizeOrBuffer;
  }

  private ensureSize(n: number) {
    if (this.offset + n > this.buf.length) {
      const nb = Buffer.alloc(Math.max(this.buf.length * 2, this.offset + n));
      this.buf.copy(nb, 0, 0, this.offset);
      this.buf = nb;
    }
  }

  private ensureReadable(n: number, at?: number) {
    const start = at ?? this.offset;
    if (start < 0 || start + n > this.buf.length) {
      throw new Error('buffer underflow');
    }
  }
  
  private readAt<T>(size: number, pos: number, fn: (offset: number) => T): T {
    this.ensureReadable(size, pos);
    return fn(pos);
  }
  
  private readAndAdvance<T>(size: number, fn: (offset: number) => T): T {
    const result = this.readAt(size, this.offset, fn);
    this.offset += size;
    return result;
  }


  private writeAndAdvance(size: number, fn: (offset: number) => void) {
    this.ensureSize(size);
    fn(this.offset);
    this.offset += size;
  }

  // Write functions
  writeUint8(v: number) {
    this.writeAndAdvance(1, (pos) => this.buf.writeUInt8(v, pos));
  }

  writeUint16(v: number) {
    this.writeAndAdvance(2, (pos) => this.buf.writeUInt16BE(v, pos));
  }

  writeUint32(v: number) {
    this.writeAndAdvance(4, (pos) => this.buf.writeUInt32BE(v, pos));
  }

  writeBytes(b: Buffer) {
    this.writeAndAdvance(b.length, (pos) => b.copy(this.buf, pos));
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

  // Read functions (with offset advancement)
  readUint8() {
    return this.readAndAdvance(1, (pos) => this.buf.readUInt8(pos));
  }

  readUint16() {
    return this.readAndAdvance(2, (pos) => this.buf.readUInt16BE(pos));
  }

  readUint32() {
    return this.readAndAdvance(4, (pos) => this.buf.readUInt32BE(pos));
  }

  readBytes(len: number) {
    return this.readAndAdvance(len, (pos) => this.buf.subarray(pos, pos + len));
  }

  readName() {
    const r = this.readNameAt(this.offset);
    this.offset += r.length;
    return r.name;
  }

  // Read functions with explicit position (no offset advancement)
  readUint16At(pos: number) {
    return this.readAt(2, pos, (p) => this.buf.readUInt16BE(p));
  }

  readBytesAt(pos: number, len: number) {
    return this.readAt(len, pos, (p) => this.buf.subarray(p, p + len));
  }

  readNameAt(pos: number, depth = 0): { name: string; length: number } {
    if (depth > MAX_NAME_JUMPS) {
      throw new Error('name compression pointer loop');
    }

    let off = pos;
    const labels: string[] = [];
    const origOff = pos;
    while (true) {
      this.ensureReadable(1, off);
      const len = this.buf.readUInt8(off);
      if ((len & DNS_POINTER_MASK) === DNS_POINTER_VALUE) {
        this.ensureReadable(2, off);
        const b2 = this.buf.readUInt8(off + 1);
        const ptr = ((len & DNS_POINTER_OFFSET_MASK) << 8) | b2;
        const r = this.readNameAt(ptr, depth + 1);
        labels.push(r.name);
        off += 2;
        break;
      }
      off += 1;
      if (len === 0) break;
      this.ensureReadable(len, off);
      labels.push(this.buf.toString('ascii', off, off + len));
      off += len;
    }
    const length = off - origOff;
    return { name: labels.filter(Boolean).join('.'), length };
  }

  // Utility methods
  advanceOffset(len: number) {
    this.offset += len;
  }

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

  bytes(): Buffer {
    return this.buf.subarray(0, this.offset);
  }
}
