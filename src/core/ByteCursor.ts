import { Buffer } from 'buffer';

/**
 * ByteCursor: Sequential buffer reader/writer with offset tracking.
 * Handles: offset tracking, bounds checking, primitive reads/writes, buffer resizing.
 * Zero DNS knowledge.
 */
export class ByteCursor {
  protected buf: Buffer;
  offset: number = 0;

  constructor(sizeOrBuffer: number | Buffer = 512) {
    if (typeof sizeOrBuffer === 'number') {
      this.buf = Buffer.alloc(sizeOrBuffer);
    } else {
      this.buf = sizeOrBuffer;
    }
  }

  private ensureSize(n: number) {
    if (this.offset + n > this.buf.length) {
      const nb = Buffer.alloc(Math.max(this.buf.length * 2, this.offset + n));
      this.buf.copy(nb, 0, 0, this.offset);
      this.buf = nb;
    }
  }

  private ensureReadable(size: number, pos: number) {
    if (pos < 0 || pos + size > this.buf.length) {
      throw new Error('buffer underflow');
    }
  }

  // Generic position-based read template
  private readAtInternal<T>(pos: number, size: number, fn: (pos: number) => T): T {
    this.ensureReadable(size, pos);
    return fn(pos);
  }

  // Generic sequential read template
  private readInternal<T>(size: number, fn: (pos: number) => T): T {
    const v = this.readAtInternal(this.offset, size, fn);
    this.offset += size;
    return v;
  }

  // Generic write template
  private writeInternal(size: number, fn: (pos: number) => void): void {
    this.ensureSize(size);
    fn(this.offset);
    this.offset += size;
  }

  // Temporary offset helper - run code at a different offset without changing cursor position
  private withOffsetAt<T>(pos: number, fn: () => T): T {
    const savedOffset = this.offset;
    this.offset = pos;
    const result = fn();
    this.offset = savedOffset;
    return result;
  }

  // Sequential reads (with offset tracking)
  readUint8(): number {
    return this.readInternal(1, (p) => this.buf.readUInt8(p));
  }

  readUint16(): number {
    return this.readInternal(2, (p) => this.buf.readUInt16BE(p));
  }

  readUint32(): number {
    return this.readInternal(4, (p) => this.buf.readUInt32BE(p));
  }

  readBytes(len: number): Buffer {
    return this.readInternal(len, (p) => this.buf.subarray(p, p + len));
  }

  // Sequential writes (with offset tracking)
  writeUint8(v: number) {
    this.writeInternal(1, (p) => this.buf.writeUInt8(v, p));
  }

  writeUint16(v: number) {
    this.writeInternal(2, (p) => this.buf.writeUInt16BE(v, p));
  }

  writeUint32(v: number) {
    this.writeInternal(4, (p) => this.buf.writeUInt32BE(v, p));
  }

  writeBytes(b: Buffer) {
    this.writeInternal(b.length, (p) => b.copy(this.buf, p));
  }

  // Buffer management

  bytes(): Buffer {
    return this.buf.subarray(0, this.offset);
  }

  underlying(): Buffer {
    return this.buf;
  }
}
