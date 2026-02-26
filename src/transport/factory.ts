import { TransportType } from '../core/types.js';
import { DNSSocket } from './base.js';
import { UDPSocket } from './udp.js';
import { TCPSocket } from './tcp.js';

export class DNSSocketFactory {
  static create(transportType: TransportType): DNSSocket {
    if (transportType === TransportType.TCP) {
      return new TCPSocket();
    }
    return new UDPSocket();
  }
}
