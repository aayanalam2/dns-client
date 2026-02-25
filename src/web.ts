import http from 'http';
import { URL } from 'url';
import config from './config.json' with { type: 'json' };
import { resolve } from './client.js';
import { RecordType } from './core/types.js';

const WEB_HOST = config.web.host;
const WEB_PORT = config.web.port;

function parseRecordType(value: string): RecordType | null {
  const key = value.toUpperCase() as keyof typeof RecordType;
  const resolved = RecordType[key];
  if (typeof resolved !== 'number') return null;
  return resolved;
}

function htmlPage(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DNS Client</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; max-width: 760px; }
    h1 { margin-bottom: 8px; }
    form { display: grid; gap: 8px; margin: 16px 0; }
    input, select, button { padding: 8px; font-size: 14px; }
    pre { background: #f6f8fa; padding: 12px; overflow: auto; }
  </style>
</head>
<body>
  <h1>DNS Client</h1>
  <p>Query A, AAAA, CNAME, NS, and MX records.</p>
  <form id="dns-form">
    <label>Type <select id="type">
      <option>A</option>
      <option>AAAA</option>
      <option>CNAME</option>
      <option>NS</option>
      <option>MX</option>
    </select></label>
    <label>Name <input id="name" value="carbonteq.com" required /></label>
    <label>Server <input id="server" value="${config.dns.defaultServer}" /></label>
    <label>Port <input id="port" type="number" min="1" value="${config.dns.defaultPort}" /></label>
    <label>Timeout (ms) <input id="timeout" type="number" min="1" value="${config.dns.defaultTimeoutMs}" /></label>
    <button type="submit">Resolve</button>
  </form>
  <pre id="output">Run a query to see results...</pre>

  <script>
    const form = document.getElementById('dns-form');
    const output = document.getElementById('output');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      output.textContent = 'Loading...';

      const type = document.getElementById('type').value;
      const name = document.getElementById('name').value;
      const server = document.getElementById('server').value;
      const port = document.getElementById('port').value;
      const timeout = document.getElementById('timeout').value;

      const params = new URLSearchParams({ type, name, server, port, timeout });
      const res = await fetch('/api/resolve?' + params.toString());
      const body = await res.json();
      output.textContent = JSON.stringify(body, null, 2);
    });
  </script>
</body>
</html>`;
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown
) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (reqUrl.pathname === '/') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(htmlPage());
    return;
  }

  if (reqUrl.pathname === '/api/resolve') {
    const typeRaw = reqUrl.searchParams.get('type') ?? 'A';
    const name = reqUrl.searchParams.get('name') ?? '';
    const rtype = parseRecordType(typeRaw);
    const serverName = reqUrl.searchParams.get('server') || undefined;
    const port = parsePositiveInt(reqUrl.searchParams.get('port'));
    const timeout = parsePositiveInt(reqUrl.searchParams.get('timeout'));

    if (!name) {
      writeJson(res, 400, { error: 'name is required' });
      return;
    }

    if (rtype === null) {
      writeJson(res, 400, { error: `unsupported type: ${typeRaw}` });
      return;
    }

    try {
      const result = await resolve(name, rtype, {
        server: serverName,
        port,
        timeout,
      });
      writeJson(res, 200, {
        query: {
          type: typeRaw.toUpperCase(),
          name,
          server: serverName ?? config.dns.defaultServer,
          port: port ?? config.dns.defaultPort,
          timeout: timeout ?? config.dns.defaultTimeoutMs,
        },
        answers: result.answers,
      });
    } catch (e: any) {
      writeJson(res, 500, { error: e?.message ?? String(e) });
    }
    return;
  }

  writeJson(res, 404, { error: 'not found' });
});

server.listen(WEB_PORT, WEB_HOST, () => {
  console.log(`Web app running at http://${WEB_HOST}:${WEB_PORT}`);
});
