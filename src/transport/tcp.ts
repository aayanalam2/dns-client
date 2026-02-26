import net from 'net';
import { DNSSocket } from './base.js';

export class TCPSocket extends DNSSocket {
  private socket: net.Socket;

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
      this.socket.connect({ host: server, port }, () => resolve());
      setTimeout(() => reject(new Error('TCP connection timed out')), timeout);
    });

    await new Promise<void>((resolve, reject) => {
      this.socket.write(packet, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async receive(timeout: number): Promise<Buffer> {
    let buffer = Buffer.alloc(0);
    let messageLength: number | null = null;

    return new Promise<Buffer>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error('DNS query timed out'));
      }, timeout);

      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Read the 2-byte length prefix if we haven't yet
        if (messageLength === null && buffer.length >= 2) {
          messageLength = buffer.readUInt16BE(0);
        }

        // Check if we have the complete message (2-byte prefix + message)
        if (messageLength !== null && buffer.length >= messageLength + 2) {
          clearTimeout(timeoutHandle);
          this.socket.removeListener('data', onData);
          this.socket.removeListener('error', onError);

          // Extract just the DNS message (skip the 2-byte length prefix)
          const dnsMessage = buffer.slice(2, messageLength + 2);
          resolve(dnsMessage);
        }
      };

      const onError = (err: Error) => {
        clearTimeout(timeoutHandle);
        this.socket.removeListener('data', onData);
        this.socket.removeListener('error', onError);
        reject(err);
      };

      this.socket.on('data', onData);
      this.socket.on('error', onError);
    });
  }

  close(): void {
    this.socket.destroy();
  }
}
