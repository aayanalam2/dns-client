import net from 'net';
import { DNSSocket } from './base.js';

export class TCPSocket extends DNSSocket {
  private socket: net.Socket;
  private buffer: Buffer = Buffer.alloc(0);
  private messageLength: number | null = null;

  constructor() {
    super();
    this.socket = new net.Socket();
  }

  async send(
    packet: Buffer,
    server: string,
    port: number,
    timeout: number
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        this.socket.removeListener('connect', onConnect);
        this.socket.removeListener('error', onError);
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        this.socket.destroy();
        reject(err);
      };

      timeoutHandle = setTimeout(() => {
        cleanup();
        this.socket.destroy();
        reject(new Error('TCP connection timed out'));
      }, timeout);

      this.socket.on('connect', onConnect);
      this.socket.on('error', onError);
      this.socket.connect({ host: server, port });
    });

    await new Promise<void>((resolve, reject) => {
      this.socket.write(packet, (err) => {
        if (err) {
          this.socket.destroy();
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async receive(timeout: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        cleanup();
        this.socket.destroy();
        reject(new Error('TCP receive timed out'));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        this.socket.removeListener('data', onData);
        this.socket.removeListener('error', onError);
        this.socket.removeListener('close', onClose);
        this.socket.removeListener('end', onEnd);
      };

      const onData = (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        // Read the 2-byte DNS length prefix if we haven't yet
        if (this.messageLength === null && this.buffer.length >= 2) {
          this.messageLength = this.buffer.readUInt16BE(0);
        }

        // Check if we have a complete framed message
        if (
          this.messageLength !== null &&
          this.buffer.length >= this.messageLength + 2
        ) {
          cleanup();
          // Return just the DNS message, skip the 2-byte length prefix
          const message = this.buffer.subarray(2, this.messageLength + 2);
          this.buffer = this.buffer.subarray(this.messageLength + 2);
          this.messageLength = null;
          resolve(message);
        }
      };

      const onError = (err: Error) => {
        cleanup();
        this.socket.destroy();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('TCP connection closed unexpectedly'));
      };

      const onEnd = () => {
        cleanup();
        reject(new Error('TCP connection ended unexpectedly'));
      };

      this.socket.on('data', onData);
      this.socket.on('error', onError);
      this.socket.on('close', onClose);
      this.socket.on('end', onEnd);
    });
  }

  close(): void {
    this.socket.destroy();
  }
}
