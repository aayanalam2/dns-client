import dgram from 'dgram';
import { once } from 'events';
import { DNSQuery } from './DNSQuery.js';
import { parseResponse } from './parser.js';
import { RecordType, DNSAnswer } from './types.js';
import config from './config.json' with { type: 'json' };

export async function resolve(
  name: string,
  type: RecordType,
  server?: string,
  port?: number,
  timeout?: number
): Promise<{ answers: DNSAnswer[] }> {
  const dnsServer = server ?? config.dns.defaultServer;
  const dnsPort = port ?? config.dns.defaultPort;
  const dnsTimeout = timeout ?? config.dns.defaultTimeoutMs;

  const socket = dgram.createSocket('udp4');
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
