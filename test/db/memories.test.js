import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import { randomUUID } from 'crypto';

// Set DATABASE_PATH before any db module imports
const dbPath = join(tmpdir(), `test-memories-${randomUUID()}.sqlite`);
process.env.DATABASE_PATH = dbPath;

// Create the schema directly via better-sqlite3 (avoid migration system)
import Database from 'better-sqlite3';

function setupSchema() {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      trust_level TEXT NOT NULL DEFAULT 'user-direct',
      salience_score REAL NOT NULL DEFAULT 1,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      tags TEXT,
      embedding BLOB,
      created_at INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL,
      decay_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS memory_audit_log (
      id TEXT PRIMARY KEY NOT NULL,
      memory_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  db.close();
}

const { insertMemory } = await (async () => {
  setupSchema();
  return import('../../lib/db/memories.js');
})();
const { getMemories, getMemoryCount, getMemoryStats } = await import('../../lib/db/memories.js');

const now = Date.now();

const FIXTURES = [
  { content: 'User prefers dark mode', sourceType: 'conversation', salienceScore: 0.9, createdAt: now - 5000 },
  { content: 'Project uses Next.js 15', sourceType: 'conversation', salienceScore: 0.7, createdAt: now - 4000 },
  { content: 'Deployed to Vercel on Jan 5', sourceType: 'job', salienceScore: 0.5, createdAt: now - 3000 },
  { content: 'Database is PostgreSQL', sourceType: 'job', salienceScore: 0.3, createdAt: now - 2000 },
  { content: 'Manual note: check API keys', sourceType: 'manual', salienceScore: 1.0, createdAt: now - 1000 },
];

beforeAll(() => {
  for (const f of FIXTURES) {
    insertMemory({
      id: randomUUID(),
      content: f.content,
      sourceType: f.sourceType,
      salienceScore: f.salienceScore,
      createdAt: f.createdAt,
      lastAccessedAt: f.createdAt,
    });
  }
});

afterAll(async () => {
  await rm(dbPath, { force: true });
});

describe('getMemories()', () => {
  it('returns all memories when no filter applied', () => {
    const results = getMemories({});
    expect(results.length).toBe(FIXTURES.length);
  });

  it('filters by sourceType conversation', () => {
    const results = getMemories({ sourceType: 'conversation' });
    expect(results.length).toBe(2);
    expect(results.every(r => r.sourceType === 'conversation')).toBe(true);
  });

  it('filters by sourceType job', () => {
    const results = getMemories({ sourceType: 'job' });
    expect(results.length).toBe(2);
    expect(results.every(r => r.sourceType === 'job')).toBe(true);
  });

  it('filters by sourceType manual', () => {
    const results = getMemories({ sourceType: 'manual' });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('Manual note: check API keys');
  });

  it('returns results ordered by salienceScore descending', () => {
    const results = getMemories({});
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].salienceScore).toBeGreaterThanOrEqual(results[i + 1].salienceScore);
    }
  });

  it('respects limit', () => {
    const results = getMemories({ limit: 2 });
    expect(results.length).toBe(2);
  });

  it('respects offset for pagination', () => {
    const page1 = getMemories({ limit: 2, offset: 0 });
    const page2 = getMemories({ limit: 2, offset: 2 });
    const combined = [...page1, ...page2];
    const uniqueIds = new Set(combined.map(r => r.id));
    expect(uniqueIds.size).toBe(4);
  });

  it('returns empty array when no rows match filter', () => {
    const results = getMemories({ sourceType: 'nonexistent' });
    expect(results.length).toBe(0);
  });

  it('includes expected fields', () => {
    const results = getMemories({ limit: 1 });
    const row = results[0];
    expect(row).toHaveProperty('id');
    expect(row).toHaveProperty('content');
    expect(row).toHaveProperty('salienceScore');
    expect(row).toHaveProperty('sourceType');
    expect(row).toHaveProperty('createdAt');
    expect(row).toHaveProperty('lastAccessedAt');
  });
});

describe('getMemoryCount()', () => {
  it('returns total count with no filters', () => {
    expect(getMemoryCount({})).toBe(FIXTURES.length);
  });

  it('counts by sourceType', () => {
    expect(getMemoryCount({ sourceType: 'conversation' })).toBe(2);
    expect(getMemoryCount({ sourceType: 'job' })).toBe(2);
    expect(getMemoryCount({ sourceType: 'manual' })).toBe(1);
  });

  it('returns 0 for sourceType with no matches', () => {
    expect(getMemoryCount({ sourceType: 'nonexistent' })).toBe(0);
  });
});

describe('getMemoryStats()', () => {
  it('returns correct total count', () => {
    const stats = getMemoryStats();
    expect(stats.total).toBe(FIXTURES.length);
  });

  it('returns a non-zero avgSalience', () => {
    const stats = getMemoryStats();
    expect(stats.avgSalience).toBeGreaterThan(0);
    expect(stats.avgSalience).toBeLessThanOrEqual(1);
  });

  it('returns oldest and newest timestamps', () => {
    const stats = getMemoryStats();
    expect(stats.oldest).not.toBeNull();
    expect(stats.newest).not.toBeNull();
    expect(stats.oldest).toBeLessThanOrEqual(stats.newest);
  });
});
