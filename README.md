# dns-client-ts

A minimal, well-architected TypeScript DNS client library supporting A, AAAA, CNAME, NS, and MX record types. Built with clean separation of concerns and comprehensive test coverage.

## Features

- ✨ **Pure TypeScript** - Full ES module support with zero dependencies beyond Node.js built-ins
- 🏗️ **Clean Architecture** - Generic utilities separated from DNS-specific logic
- 🧪 **Well Tested** - Unit tests with fixture-based integration testing
- 📦 **Multiple Interfaces** - Library API, CLI tool, and web UI
- 🎯 **Record Types** - A, AAAA, CNAME, NS, MX
- ⚡ **Customizable** - Configurable timeout, server, and port with dependency injection for testing

## Quick Start

### Installation

```bash
npm install
npm run build
```

### As a Library

```typescript
import { resolve } from './src/client.js';
import { RecordType } from './src/core/types.js';

// Query A records for a domain
const result = await resolve('example.com', RecordType.A, {
  server: '8.8.8.8',
  port: 53,
  timeout: 5000,
});

console.log(result.answers);
// → [{ name: 'example.com', type: 1, class: 1, ttl: 300, data: '93.184.216.34' }]
```

### CLI

```bash
# Query A records (default: uses system DNS)
npm start -- A example.com

# Query specific record type with custom server
npm start -- MX example.com --server 8.8.8.8 --port 53 --timeout 2000

# Install globally
npm run build
npm link
dns-client A example.com --server 8.8.8.8
dns-client --help
```

### Web Interface

```bash
npm run build
npm run web
```

Open http://127.0.0.1:3000 - query DNS from a browser form.

## Architecture

### Core Components

```
src/
├── core/                 # Low-level utilities
│   ├── ByteCursor.ts    # Generic sequential buffer reader/writer
│   ├── DNSBuffer.ts     # DNS-specific buffer operations
│   └── types.ts         # TypeScript types and enums
│
├── protocol/            # DNS protocol implementation
│   ├── parser.ts        # Parse DNS responses (A, AAAA, CNAME, NS, MX)
│   └── query.ts         # Build DNS query packets
│
├── client.ts            # Main resolve() entry point
├── cli.ts               # Command-line interface
├── web.ts               # Web server interface
└── config.json          # Configuration
```

### Design Philosophy

**Separation of Concerns:**
- **`core/`** - Generic, reusable utilities with zero DNS knowledge
- **`protocol/`** - DNS-specific logic built on top of core utilities
- **`client.ts`** - High-level API for end users

**ByteCursor → DNSBuffer → Client Flow:**
1. `ByteCursor` - Handles raw buffer operations (read/write at positions, offset tracking, resizing)
2. `DNSBuffer` extends `ByteCursor` - Adds DNS-specific methods (name encoding/decoding, header parsing)
3. `DNSQuery` & `Parser` - Build and parse DNS packets
4. `resolve()` - Main async function orchestrating the DNS query flow

## Usage Patterns

### Direct Query

```typescript
import { resolve } from './src/client.js';
import { RecordType } from './src/core/types.js';

// With all defaults
const a = await resolve('google.com', RecordType.A);

// Custom server and timeout
const result = await resolve('example.com', RecordType.MX, {
  server: '1.1.1.1',
  port: 53,
  timeout: 3000,
});

console.log(result.answers.map(ans => ans.data));
// → ['10 mail.example.com.', '20 mail2.example.com.']
```

### Supported Record Types

```typescript
RecordType.A       // IPv4 addresses
RecordType.AAAA    // IPv6 addresses
RecordType.CNAME   // Canonical names
RecordType.NS      // Nameservers
RecordType.MX      // Mail exchangers (with preference)
```

### Testing with Dependency Injection

```typescript
import { resolve } from './src/client.js';
import dgram from 'dgram';

const mockSocket = (sendData?: Buffer) => {
  const sock = dgram.createSocket('udp4');
  // Inject mock implementation here
  return sock;
};

// Pass custom socket factory for testing
const result = await resolve('example.com', RecordType.A, {
  socketFactory: mockSocket,
});
```

## Testing

### Run Tests

```bash
npm test
```

Runs unit tests that verify:
- Query packet structure
- Response parsing (A, AAAA, CNAME, NS, MX records)
- Buffer operations
- DNS name compression/decompression

### Fixture-Based Integration Tests

Test against captured real DNS packets:

**Capture a DNS query:**
```bash
# Terminal 1: Listen for query
nc -u -l 1053 > query_packet.bin

# Terminal 2: Send query
dig +retry=0 -p 1053 @127.0.0.1 +noedns example.com
```

**Fetch a real response:**
```bash
# Use the captured query to get a real response
nc -u 8.8.8.8 53 < query_packet.bin > response_packet.bin
```

**Run fixture tests:**
```bash
# Place files in project root or test/fixtures/
npm test
```

The test suite auto-detects `query_packet.bin` and `response_packet.bin`.

## Configuration

Edit `src/config.json`:

```json
{
  "dns": {
    "defaultServer": "8.8.8.8",
    "defaultPort": 53,
    "defaultTimeoutMs": 5000
  },
  "web": {
    "host": "127.0.0.1",
    "port": 3000
  }
}
```

## Development

### Build

```bash
npm run build          # Compile TypeScript → dist/
npm run build:watch   # Watch mode
```

### Linting

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix formatting
```

### Project Structure

| File | Purpose |
|------|---------|
| `src/core/ByteCursor.ts` | Generic buffer operations (no DNS knowledge) |
| `src/core/DNSBuffer.ts` | DNS-aware buffer extending ByteCursor |
| `src/core/types.ts` | TypeScript interfaces and enums |
| `src/protocol/query.ts` | DNSQuery class for building DNS packets |
| `src/protocol/parser.ts` | Response parser with record type handlers |
| `src/client.ts` | `resolve()` function - main entry point |
| `src/cli.ts` | Command-line interface |
| `src/web.ts` | Web server for browser queries |
| `test/dns.test.ts` | Unit tests |
| `test/fixtures.test.ts` | Integration tests (optional fixtures) |

## How It Works

### Query Flow

```
User Input
    ↓
resolve(name, type, options?)
    ↓
DNSQuery.pack()  ← Builds packet with ByteCursor
    ↓
UDP Send to DNS Server
    ↓
UDP Receive Response
    ↓
parseResponse(buffer)  ← Parses with DNSBuffer & record parsers
    ↓
{ answers: DNSAnswer[] }
```

### Buffer Architecture

**ByteCursor** (Generic):
- `readUint8At(pos)`, `readUint16At(pos)` - position-based reads
- `readUint8()`, `readUint16()` - sequential reads with offset tracking
- `writeUint8(v)`, `writeUint16(v)` - sequential writes
- Auto-resizing on write overflow

**DNSBuffer** (DNS-specific):
- `readName()` / `writeName()` - DNS name encoding/decoding
- `readNameAt()` - Decompress DNS pointers and name references
- `readHeader()` - Parse DNS header
- Inherits all ByteCursor operations

## Examples

### Query Multiple Records

```typescript
import { resolve } from './src/client.js';
import { RecordType } from './src/core/types.js';

async function queryAll(domain: string) {
  const queries = [
    { type: RecordType.A, name: 'A Records' },
    { type: RecordType.AAAA, name: 'IPv6' },
    { type: RecordType.MX, name: 'Mail' },
    { type: RecordType.NS, name: 'Nameservers' },
  ];

  for (const { type, name } of queries) {
    try {
      const result = await resolve(domain, type);
      console.log(`${name}:`, result.answers.map(a => a.data));
    } catch (err) {
      console.error(`${name} failed:`, err.message);
    }
  }
}

queryAll('example.com');
```

### Custom Timeout

```typescript
// 10 second timeout for slow networks
const result = await resolve('example.com', RecordType.A, {
  timeout: 10000,
});
```

### Use Alternative DNS Server

```typescript
// Query Cloudflare DNS
const result = await resolve('example.com', RecordType.A, {
  server: '1.1.1.1',
});

// Query Quad9 DNS
const result = await resolve('example.com', RecordType.A, {
  server: '9.9.9.9',
});
```

## Performance Notes

- **No external dependencies** - Uses only Node.js built-ins
- **Memory efficient** - Buffers resize predictably, queries are small (~40 bytes)
- **Fast parsing** - Single-pass DNS response parsing
- **Caching** - Implement in wrapper layer if needed

## Limitations

- No DNS caching (by design)
- No support for DNSSEC validation
- No recursive nameserver chasing (direct queries only)
- Single record type per query

## License

MIT
