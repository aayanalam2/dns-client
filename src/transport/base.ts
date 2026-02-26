export abstract class DNSSocket {
  abstract send(
    packet: Buffer,
    server: string,
    port: number,
    timeout: number
  ): Promise<void>;

  abstract receive(timeout: number): Promise<Buffer>;

  abstract close(): void;
}
