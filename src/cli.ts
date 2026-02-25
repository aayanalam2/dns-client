#!/usr/bin/env node
import { resolve } from './client.js';
import { RecordType } from './types.js';

type CliOptions = {
  type: string;
  name: string;
  server?: string;
  port?: number;
  timeout?: number;
};

const EXIT_INVALID_USAGE = 2;
const EXIT_RUNTIME_FAILURE = 1;

function printUsage() {
  console.error(
    'Usage: dns-client <TYPE> <NAME> [--server <ip>] [--port <number>] [--timeout <ms>]'
  );
  console.error(
    'Example: dns-client A carbonteq.com --server 8.8.8.8 --port 53 --timeout 2000'
  );
}

function parseRecordType(value: string): RecordType {
  const key = value.toUpperCase() as keyof typeof RecordType;
  if (!(key in RecordType)) {
    throw new Error(`Unsupported record type: ${value}`);
  }
  return RecordType[key];
}

function parsePositiveInt(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

function parseCliArgs(args: string[]): CliOptions {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.length < 2) {
    throw new Error('Missing required arguments: TYPE and NAME');
  }

  const type = args[0];
  const name = args[1];
  let server: string | undefined;
  let port: number | undefined;
  let timeout: number | undefined;

  for (let i = 2; i < args.length; i++) {
    const current = args[i];
    if (current === '--server') {
      const value = args[++i];
      if (!value) throw new Error('Missing value for --server');
      server = value;
      continue;
    }
    if (current === '--port') {
      const value = args[++i];
      if (!value) throw new Error('Missing value for --port');
      port = parsePositiveInt(value, 'port');
      continue;
    }
    if (current === '--timeout') {
      const value = args[++i];
      if (!value) throw new Error('Missing value for --timeout');
      timeout = parsePositiveInt(value, 'timeout');
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return { type, name, server, port, timeout };
}

async function main() {
  let options: CliOptions;
  let rtype: RecordType;

  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (e: any) {
    console.error(e.message || e);
    printUsage();
    process.exit(EXIT_INVALID_USAGE);
  }
  try {
    rtype = parseRecordType(options.type);
  } catch (e: any) {
    console.error(e.message || e);
    printUsage();
    process.exit(EXIT_INVALID_USAGE);
  }

  try {
    const res = await resolve(options.name, rtype, {
      server: options.server,
      port: options.port,
      timeout: options.timeout,
    });
    if (res.answers.length === 0) {
      console.log(
        `No answers for ${options.type.toUpperCase()} ${options.name}`
      );
      return;
    }
    for (const a of res.answers) {
      const typeName =
        (
          Object.entries(RecordType) as Array<
            [keyof typeof RecordType, RecordType]
          >
        ).find(([, value]) => value === a.type)?.[0] ?? String(a.type);
      console.log(`${a.name} ${a.ttl} IN ${typeName} ${a.data}`);
    }
  } catch (e: any) {
    console.error('Query failed:', e.message || e);
    process.exit(EXIT_RUNTIME_FAILURE);
  }
}

main();
