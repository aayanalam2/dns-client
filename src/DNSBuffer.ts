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

  ensureSize(n: number) {
    if (this.offset + n > this.buf.length) {
      const nb = Buffer.alloc(Math.max(this.buf.length * 2, this.offset + n));
      this.buf.copy(nb, 0, 0, this.offset);
      this.buf = nb;
    }
  }

  ensureReadable(n: number, at?: number) {
    const start = at ?? this.offset;
    if (start < 0 || start + n > this.buf.length) {
      throw new Error('buffer underflow');
    }
  }

  //Write functions
  writeUint8(v: number) {
    this.ensureSize(1);
    this.buf.writeUInt8(v, this.offset);
    this.offset += 1;
  }
  writeUint16(v: number) {
    this.ensureSize(2);
    this.buf.writeUInt16BE(v, this.offset);
    this.offset += 2;
  }
  writeUint32(v: number) {
    this.ensureSize(4);
    this.buf.writeUInt32BE(v, this.offset);
    this.offset += 4;
  }
  writeBytes(b: Buffer) {
    this.ensureSize(b.length);
    b.copy(this.buf, this.offset);
    this.offset += b.length;
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

  //Read functions
  readUint8() {
    this.ensureReadable(1, this.offset);
    const v = this.buf.readUInt8(this.offset);
    this.offset += 1;
    return v;
  }
  readUint16() {
    this.ensureReadable(2, this.offset);
    const v = this.buf.readUInt16BE(this.offset);
    this.offset += 2;
    return v;
  }
  readUint32() {
    this.ensureReadable(4, this.offset);
    const v = this.buf.readUInt32BE(this.offset);
    this.offset += 4;
    return v;
  }
  readBytes(len: number) {
    this.ensureReadable(len);
    const b = this.buf.subarray(this.offset, this.offset + len);
    this.offset += len;
    return b;
  }

  readName() {
    const r = this.readNameAt(this.offset);
    this.offset += r.length;
    return r.name;
  }
  
  // Read functions with explicit position (These do not advance the main offset)
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
  readUint16At(pos: number) {
    this.ensureReadable(2, pos);
    return this.buf.readUInt16BE(pos);
  }
  readBytesAt(pos: number, len: number) {
    this.ensureReadable(len, pos);
    return this.buf.subarray(pos, pos + len);
  }

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
