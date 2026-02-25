import dgram from 'dgram';
import { once } from 'events';
import { DNSQuery } from './protocol/query.js';
import { parseResponse } from './protocol/parser.js';
import { RecordType, DNSAnswer } from './core/types.js';
import config from './config.json' with { type: 'json' };

type SocketFactory = () => dgram.Socket;

const defaultSocketFactory: SocketFactory = () => dgram.createSocket('udp4');

export async function resolve(
  name: string,
  type: RecordType,
  options?: {
    server?: string;
    port?: number;
    timeout?: number;
    socketFactory?: SocketFactory;
  }
): Promise<{ answers: DNSAnswer[] }> {
  const dnsServer = options?.server ?? config.dns.defaultServer;
  const dnsPort = options?.port ?? config.dns.defaultPort;
  const dnsTimeout = options?.timeout ?? config.dns.defaultTimeoutMs;
  const socketFactory = options?.socketFactory ?? defaultSocketFactory;

  const socket = socketFactory();
  const query = new DNSQuery(name, type);
  const packet = query.pack();

  try {
    await new Promise<void>((resolve, reject) => {
      socket.send(packet, dnsPort, dnsServer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const [msg] = await Promise.race([
      once(socket, 'message'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS query timed out')), dnsTimeout)
      ),
    ]);

    const parsed = parseResponse(msg as Buffer);
    return parsed;
  } finally {
    socket.close();
  }
}
