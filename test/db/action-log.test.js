import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import { randomUUID } from 'crypto';

// Set DATABASE_PATH before any db module imports
const dbPath = join(tmpdir(), `test-action-log-${randomUUID()}.sqlite`);
process.env.DATABASE_PATH = dbPath;

// Create the schema directly via better-sqlite3 (avoid migration system)
import Database from 'better-sqlite3';

function setupSchema() {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS action_log (
      id TEXT PRIMARY KEY NOT NULL,
      action_type TEXT NOT NULL,
      action_name TEXT,
      source TEXT NOT NULL,
      trust_level TEXT,
      input TEXT,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      error TEXT,
      duration_ms INTEGER,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  db.close();
}

// Dynamically import after DATABASE_PATH is set
const { insertActionLog, queryActionLog, getActionLogCount } = await (async () => {
  setupSchema();
  return import('../../lib/db/action-log.js');
})();

const FIXTURES = [
  { actionType: 'agent', actionName: 'daily-summary', source: 'cron', trustLevel: 'user-direct', status: 'success' },
  { actionType: 'command', actionName: 'backup', source: 'cron', trustLevel: 'user-direct', status: 'success' },
  { actionType: 'webhook', actionName: 'notify-slack', source: 'trigger', trustLevel: 'user-indirect', status: 'success' },
  { actionType: 'webhook', actionName: 'github-sync', source: 'trigger', trustLevel: 'external-untrusted', status: 'error' },
  { actionType: 'agent', actionName: 'process-pr', source: 'trigger', trustLevel: 'external-untrusted', status: 'success' },
  { actionType: 'voice', actionName: 'morning-brief', source: 'cron', trustLevel: null, status: 'blocked' },
];

beforeAll(() => {
  for (const f of FIXTURES) {
    insertActionLog({
      actionType: f.actionType,
      actionName: f.actionName,
      source: f.source,
      trustLevel: f.trustLevel,
      status: f.status,
      createdAt: Date.now(),
    });
  }
});

afterAll(async () => {
  await rm(dbPath, { force: true });
});

describe('queryActionLog()', () => {
  it('returns all entries when no filters applied', () => {
    const results = queryActionLog({});
    expect(results.length).toBe(FIXTURES.length);
  });

  it('filters by actionType', () => {
    const agents = queryActionLog({ actionType: 'agent' });
    expect(agents.length).toBe(2);
    expect(agents.every(r => r.actionType === 'agent')).toBe(true);
  });

  it('filters by status', () => {
    const errors = queryActionLog({ status: 'error' });
    expect(errors.length).toBe(1);
    expect(errors[0].actionName).toBe('github-sync');
  });

  it('filters by trustLevel (user-direct)', () => {
    const direct = queryActionLog({ trustLevel: 'user-direct' });
    expect(direct.length).toBe(2);
    expect(direct.every(r => r.trustLevel === 'user-direct')).toBe(true);
  });

  it('filters by trustLevel (user-indirect)', () => {
    const indirect = queryActionLog({ trustLevel: 'user-indirect' });
    expect(indirect.length).toBe(1);
    expect(indirect[0].actionName).toBe('notify-slack');
  });

  it('filters by trustLevel (external-untrusted)', () => {
    const untrusted = queryActionLog({ trustLevel: 'external-untrusted' });
    expect(untrusted.length).toBe(2);
    expect(untrusted.every(r => r.trustLevel === 'external-untrusted')).toBe(true);
  });

  it('combines actionType and trustLevel filters', () => {
    const results = queryActionLog({ actionType: 'agent', trustLevel: 'external-untrusted' });
    expect(results.length).toBe(1);
    expect(results[0].actionName).toBe('process-pr');
  });

  it('combines actionType and status filters', () => {
    const results = queryActionLog({ actionType: 'webhook', status: 'error' });
    expect(results.length).toBe(1);
    expect(results[0].actionName).toBe('github-sync');
  });

  it('returns empty array when no rows match', () => {
    const results = queryActionLog({ trustLevel: 'user-indirect', actionType: 'agent' });
    expect(results.length).toBe(0);
  });

  it('respects limit', () => {
    const results = queryActionLog({ limit: 3 });
    expect(results.length).toBe(3);
  });

  it('respects offset', () => {
    const all = queryActionLog({});
    const page2 = queryActionLog({ limit: 2, offset: 2 });
    expect(page2.length).toBe(2);
    expect(page2[0].id).not.toBe(all[0].id);
  });
});

describe('getActionLogCount()', () => {
  it('returns total count with no filters', () => {
    expect(getActionLogCount({})).toBe(FIXTURES.length);
  });

  it('counts by actionType', () => {
    expect(getActionLogCount({ actionType: 'webhook' })).toBe(2);
    expect(getActionLogCount({ actionType: 'voice' })).toBe(1);
  });

  it('counts by trustLevel', () => {
    expect(getActionLogCount({ trustLevel: 'user-direct' })).toBe(2);
    expect(getActionLogCount({ trustLevel: 'external-untrusted' })).toBe(2);
    expect(getActionLogCount({ trustLevel: 'user-indirect' })).toBe(1);
  });

  it('counts by status', () => {
    expect(getActionLogCount({ status: 'success' })).toBe(4);
    expect(getActionLogCount({ status: 'error' })).toBe(1);
    expect(getActionLogCount({ status: 'blocked' })).toBe(1);
  });

  it('counts with combined filters', () => {
    expect(getActionLogCount({ actionType: 'agent', trustLevel: 'user-direct' })).toBe(1);
    expect(getActionLogCount({ trustLevel: 'external-untrusted', status: 'error' })).toBe(1);
  });

  it('returns 0 when nothing matches', () => {
    expect(getActionLogCount({ trustLevel: 'user-indirect', status: 'error' })).toBe(0);
  });
});
