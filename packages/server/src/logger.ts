// =============================================================================
// HexWar Server — In-Memory Logger with SSE Support
// =============================================================================

import type { Response } from 'express';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'server' | 'game';

interface LogEntry {
  index: number;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
}

const MAX_ENTRIES = 1000;
const buffer: LogEntry[] = [];
let nextIndex = 0;
const subscribers: Set<Response> = new Set();

function log(level: LogLevel, category: LogCategory, message: string): void {
  const entry: LogEntry = {
    index: nextIndex++,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
  };

  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }

  const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]';
  process.stdout.write(`${prefix} [${category}] ${message}\n`);

  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of subscribers) {
    res.write(data);
  }
}

function getAll(): LogEntry[] {
  return buffer.slice();
}

function getLogs(since?: number): LogEntry[] {
  if (since === undefined) return buffer.slice();
  return buffer.filter((e) => e.index > since);
}

function subscribe(res: Response): void {
  subscribers.add(res);
}

function unsubscribe(res: Response): void {
  subscribers.delete(res);
}

export { log, getAll, getLogs, subscribe, unsubscribe };
export type { LogEntry, LogLevel, LogCategory };
