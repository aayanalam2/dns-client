import dgram from 'dgram';
import { once } from 'events';
import { DNSSocket } from './base.js';

export class UDPSocket extends DNSSocket {
  private socket: dgram.Socket;
  private bound: boolean = false;

  constructor() {
    super();
    this.socket = dgram.createSocket('udp4');
  }

  private async ensureBound(): Promise<void> {
    if (this.bound) return;

    await new Promise<void>((resolve, reject) => {
      this.socket.bind(0, '0.0.0.0', () => {
        this.bound = true;
        resolve();
      });
      this.socket.once('error', reject);
    });
  }

  async send(
    packet: Buffer,
    server: string,
    port: number,
    timeout: number
  ): Promise<void> {
    await this.ensureBound();

    await new Promise<void>((resolve, reject) => {
      this.socket.send(packet, port, server, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async receive(timeout: number): Promise<Buffer> {
    const [msg] = await Promise.race([
      once(this.socket, 'message'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS query timed out')), timeout)
      ),
    ]);
    return msg as Buffer;
  }

  close(): void {
    this.socket.close();
  }
}
