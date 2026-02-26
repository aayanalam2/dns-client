import { DNSQuery } from './protocol/query.js';
import { parseResponse } from './protocol/parser.js';
import { RecordType, DNSAnswer, TransportType } from './core/types.js';
import config from './config.json' with { type: 'json' };
import { DNSSocketFactory } from './transport/factory.js';

export async function resolve(
  name: string,
  type: RecordType,
  options?: {
    server?: string;
    port?: number;
    timeout?: number;
    transportType?: TransportType;
  }
): Promise<{ answers: DNSAnswer[] }> {
  const dnsServer = options?.server ?? config.dns.defaultServer;
  const dnsPort = options?.port ?? config.dns.defaultPort;
  const dnsTimeout = options?.timeout ?? config.dns.defaultTimeoutMs;
  const transportType = options?.transportType ?? TransportType.UDP;

  const query = new DNSQuery(name, type, transportType);
  const packet = query.pack();

  const socket = DNSSocketFactory.create(transportType);

  try {
    await socket.send(packet, dnsServer, dnsPort, dnsTimeout);
    const response = await socket.receive(dnsTimeout);
    return parseResponse(response, query.id);
  } finally {
    socket.close();
  }
}
