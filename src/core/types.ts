export enum RecordType {
  A = 1,
  NS = 2,
  CNAME = 5,
  MX = 15,
  AAAA = 28,
}

export enum TransportType {
  UDP = 'UDP',
  TCP = 'TCP',
}

export interface DNSAnswer {
  name: string;
  type: RecordType;
  class: number;
  ttl: number;
  data: string;
}
