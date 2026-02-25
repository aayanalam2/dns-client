# dns-client-ts

Minimal TypeScript DNS client library supporting A, AAAA, CNAME, NS and MX.

Build:

```bash
npm install
npm run build
```

Run CLI:

```bash
npm start -- A example.com 8.8.8.8
```

Examples for additional record types:

```bash
dns-client NS example.com
dns-client MX example.com
```

Install as a proper CLI command (local machine):

```bash
npm run build
npm link
dns-client A example.com --server 8.8.8.8 --port 53 --timeout 2000
```

CLI help:

```bash
dns-client --help
```

Run web app:

```bash
npm run build
npm run web
```

Open http://127.0.0.1:3000 and run queries from the form.

Run tests:

```bash
npm test
```

Packet fixture testing (offline):

```bash
# Terminal 1
nc -u -l 1053 > query_packet.bin

# Terminal 2
dig +retry=0 -p 1053 @127.0.0.1 +noedns carbonteq.com
```

Stop `nc` with Ctrl+C, then fetch a real response using the captured query:

```bash
nc -u 8.8.8.8 53 < query_packet.bin > response_packet.bin
```

Stop with Ctrl+C, then run tests:

```bash
npm test
```

The fixture tests in `test/fixtures.test.ts` will automatically use `query_packet.bin` and `response_packet.bin` from the project root (or `test/fixtures/` if you place them there).
