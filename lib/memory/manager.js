import { getMemoryConfig } from './config.js';
import { initFts, searchFts } from './fts.js';
import { detectPoisoning, flagMemory, storeChecksum } from './integrity.js';
import { reinforceMemory } from './decay.js';
import {
  insertMemory,
  getMemoryById as dbGetMemoryById,
  updateMemory,
  deleteMemory as dbDeleteMemory,
  getMemoriesBySource,
  getMemoryStats as dbGetMemoryStats,
  insertAuditLog,
} from '../db/memories.js';
import {
  generateEmbedding,
  embeddingToBuffer,
  bufferToEmbedding,
  cosineSimilarity,
  isEmbeddingAvailable,
} from './embeddings.js';
import { getDb } from '../db/index.js';

/**
 * Create a new memory with integrity checks.
 *
 * @param {string} content - The memory content
 * @param {object} [options]
 * @param {string} [options.summary] - Short summary
 * @param {string} [options.trustLevel='user-direct']
 * @param {string} [options.sourceType='manual']
 * @param {string} [options.sourceId]
 * @param {object} [options.tags]
 * @param {boolean} [options.skipEmbedding=false] - Skip embedding generation
 * @returns {Promise<object>} Created memory
 */
export async function createMemory(content, options = {}) {
  const config = getMemoryConfig();
  if (!config.enabled) throw new Error('Memory system is disabled');

  // Poison detection
  const poison = detectPoisoning(content);
  if (poison.poisoned) {
    console.warn('[memory] Poison detected in content:', poison.matches);
  }

  // Generate embedding if available
  let embedding = null;
  if (!options.skipEmbedding) {
    try {
      const vec = await generateEmbedding(content);
      if (vec) embedding = embeddingToBuffer(vec);
    } catch (err) {
      console.error('[memory] Embedding generation failed:', err.message);
    }
  }

  // Calculate decay time
  const now = Date.now();
  const { halfLifeMs, minScore } = config.tier1.decay;
  // Time until salience decays to minScore: t = halfLife * log2(1/minScore)
  const decayAt = halfLifeMs > 0
    ? now + Math.ceil(halfLifeMs * Math.log2(1 / minScore))
    : null;

  const memory = insertMemory({
    content,
    summary: options.summary || null,
    trustLevel: options.trustLevel || 'user-direct',
    salienceScore: config.tier1.defaultSalienceScore,
    sourceType: options.sourceType || 'manual',
    sourceId: options.sourceId || null,
    tags: options.tags || null,
    embedding,
    createdAt: now,
    lastAccessedAt: now,
    decayAt,
  });

  // Store checksum
  storeChecksum(memory.id, content, embedding);

  // Flag if poisoned
  if (poison.poisoned) {
    flagMemory(memory.id, `Poison patterns detected: ${poison.matches.join(', ')}`);
  }

  // Audit log
  insertAuditLog({
    memoryId: memory.id,
    action: 'create',
    actor: options.trustLevel || 'user-direct',
    details: {
      sourceType: options.sourceType,
      sourceId: options.sourceId,
      poisoned: poison.poisoned,
      hasEmbedding: !!embedding,
    },
  });

  return memory;
}

/**
 * Search memories using FTS5 keyword search.
 *
 * @param {string} query - Search query
 * @param {object} [options]
 * @param {number} [options.limit] - Max results
 * @param {number} [options.minSalience] - Min salience score
 * @returns {object[]} Matching memories ranked by relevance
 */
export function searchMemories(query, options = {}) {
  const config = getMemoryConfig();
  const limit = options.limit || config.tier1.search.maxResults;
  const minSalience = options.minSalience ?? config.tier1.search.minSalienceScore;

  const results = searchFts(query, { limit, minSalience });

  // Reinforce accessed memories
  for (const mem of results) {
    try { reinforceMemory(mem.id); } catch {}
  }

  return results;
}

/**
 * Semantic search using vector embeddings.
 * Falls back to empty results if embeddings unavailable.
 *
 * @param {string} query - Natural language query
 * @param {object} [options]
 * @param {number} [options.limit=10] - Max results
 * @param {number} [options.minSalience=0.2] - Min salience score
 * @returns {Promise<object[]>} Matching memories ranked by cosine similarity
 */
export async function semanticSearch(query, options = {}) {
  if (!isEmbeddingAvailable()) return [];

  const config = getMemoryConfig();
  const limit = options.limit || config.tier1.search.maxResults;
  const minSalience = options.minSalience ?? config.tier1.search.minSalienceScore;

  // Embed the query
  const queryVec = await generateEmbedding(query);
  if (!queryVec) return [];

  // Try sqlite-vec first for indexed search
  try {
    const vecResults = vectorSearch(queryVec, limit, minSalience);
    if (vecResults.length > 0) {
      for (const mem of vecResults) {
        try { reinforceMemory(mem.id); } catch {}
      }
      return vecResults;
    }
  } catch {
    // sqlite-vec not available — fall through to brute-force
  }

  // Brute-force cosine similarity (fallback when sqlite-vec not loaded)
  const db = getDb();
  const sqlite = db._.session.client;
  const rows = sqlite.prepare(`
    SELECT id, content, summary, salience_score, trust_level, source_type,
           source_id, tags, embedding, created_at, last_accessed_at
    FROM memories
    WHERE embedding IS NOT NULL AND salience_score >= ?
  `).all(minSalience);

  const scored = rows
    .map((row) => {
      const emb = bufferToEmbedding(row.embedding);
      const similarity = cosineSimilarity(queryVec, emb);
      return {
        id: row.id,
        content: row.content,
        summary: row.summary,
        salienceScore: row.salience_score,
        trustLevel: row.trust_level,
        sourceType: row.source_type,
        sourceId: row.source_id,
        tags: row.tags ? JSON.parse(row.tags) : null,
        createdAt: row.created_at,
        lastAccessedAt: row.last_accessed_at,
        similarity,
      };
    })
    .filter((r) => r.similarity > 0.3) // Min similarity threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // Reinforce accessed memories
  for (const mem of scored) {
    try { reinforceMemory(mem.id); } catch {}
  }

  return scored;
}

/**
 * Vector search using sqlite-vec extension.
 * @param {Float32Array} queryVec
 * @param {number} limit
 * @param {number} minSalience
 * @returns {object[]}
 */
function vectorSearch(queryVec, limit, minSalience) {
  const db = getDb();
  const sqlite = db._.session.client;

  const queryBuf = Buffer.from(queryVec.buffer);

  const rows = sqlite.prepare(`
    SELECT
      m.id,
      m.content,
      m.summary,
      m.salience_score,
      m.trust_level,
      m.source_type,
      m.source_id,
      m.tags,
      m.created_at,
      m.last_accessed_at,
      v.distance AS similarity
    FROM memory_vec v
    JOIN memories m ON m.rowid = v.rowid
    WHERE m.salience_score >= ?
    ORDER BY v.distance
    LIMIT ?
  `).bind(minSalience, limit).all();

  // Note: vec_distance_cosine returns distance (0 = identical), convert to similarity
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    summary: row.summary,
    salienceScore: row.salience_score,
    trustLevel: row.trust_level,
    sourceType: row.source_type,
    sourceId: row.source_id,
    tags: row.tags ? JSON.parse(row.tags) : null,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
    similarity: 1 - row.similarity, // Convert distance to similarity
  }));
}

/**
 * Hybrid search: combines FTS5 keyword relevance + vector similarity.
 * Auto-selects: hybrid if embeddings available, FTS5-only otherwise.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit=10]
 * @param {number} [options.minSalience]
 * @param {number} [options.ftsWeight=0.4] - Weight for FTS5 score
 * @param {number} [options.vecWeight=0.6] - Weight for vector similarity
 * @returns {Promise<object[]>}
 */
export async function hybridSearch(query, options = {}) {
  const config = getMemoryConfig();
  const limit = options.limit || config.tier1.search.maxResults;
  const minSalience = options.minSalience ?? config.tier1.search.minSalienceScore;
  const ftsWeight = options.ftsWeight ?? 0.4;
  const vecWeight = options.vecWeight ?? 0.6;

  // Always run FTS5
  const ftsResults = searchFts(query, { limit: limit * 2, minSalience });

  // Try vector search
  const vecResults = await semanticSearch(query, { limit: limit * 2, minSalience });

  if (!vecResults.length) {
    // FTS5-only fallback
    const results = ftsResults.slice(0, limit);
    for (const mem of results) {
      try { reinforceMemory(mem.id); } catch {}
    }
    return results;
  }

  // Normalize FTS5 ranks (lower is better, convert to 0-1 score)
  const maxFtsRank = Math.max(...ftsResults.map((r) => Math.abs(r.ftsRank || 0)), 1);
  const ftsMap = new Map();
  for (const r of ftsResults) {
    ftsMap.set(r.id, {
      ...r,
      normalizedFts: 1 - Math.abs(r.ftsRank || 0) / maxFtsRank,
    });
  }

  // Build vector similarity map
  const vecMap = new Map();
  for (const r of vecResults) {
    vecMap.set(r.id, r);
  }

  // Merge and score
  const allIds = new Set([...ftsMap.keys(), ...vecMap.keys()]);
  const merged = [];

  for (const id of allIds) {
    const fts = ftsMap.get(id);
    const vec = vecMap.get(id);
    const base = fts || vec;

    const ftsScore = fts ? fts.normalizedFts : 0;
    const vecScore = vec ? (vec.similarity || 0) : 0;
    const hybridScore = ftsWeight * ftsScore + vecWeight * vecScore;

    merged.push({
      id: base.id,
      content: base.content,
      summary: base.summary,
      salienceScore: base.salienceScore,
      trustLevel: base.trustLevel,
      sourceType: base.sourceType,
      sourceId: base.sourceId,
      tags: base.tags,
      createdAt: base.createdAt,
      lastAccessedAt: base.lastAccessedAt,
      hybridScore,
      ftsScore,
      vecScore,
      snippet: fts?.snippet || null,
    });
  }

  merged.sort((a, b) => b.hybridScore - a.hybridScore);
  const results = merged.slice(0, limit);

  // Reinforce accessed memories
  for (const mem of results) {
    try { reinforceMemory(mem.id); } catch {}
  }

  return results;
}

/**
 * Get relevant memories for a context.
 * Auto-selects search strategy: hybrid if embeddings available, FTS5-only otherwise.
 *
 * @param {string} threadId - Conversation thread (for source-based lookup)
 * @param {string} query - Search query
 * @param {object} [options]
 * @param {number} [options.limit=5]
 * @returns {Promise<object[]>}
 */
export async function getRelevantMemories(threadId, query, options = {}) {
  const config = getMemoryConfig();
  if (!config.enabled) return [];

  const limit = options.limit || 5;

  // Combine search results with source-based lookup
  const [searchResults, sourceResults] = await Promise.all([
    hybridSearch(query, { limit }),
    Promise.resolve(getMemoriesBySource('conversation', threadId)),
  ]);

  // Merge, deduplicate, and limit
  const seen = new Set();
  const merged = [];

  for (const mem of searchResults) {
    if (!seen.has(mem.id)) {
      seen.add(mem.id);
      merged.push(mem);
    }
  }

  for (const mem of sourceResults) {
    if (!seen.has(mem.id) && merged.length < limit * 2) {
      seen.add(mem.id);
      merged.push(mem);
    }
  }

  return merged.slice(0, limit);
}

/**
 * Get a memory by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getMemoryById(id) {
  return dbGetMemoryById(id);
}

/**
 * Delete a memory by ID with audit logging.
 * @param {string} id
 * @param {string} [actor='system']
 */
export function deleteMemoryById(id, actor = 'system') {
  insertAuditLog({
    memoryId: id,
    action: 'delete',
    actor,
  });
  dbDeleteMemory(id);
}

/**
 * Get memory system stats.
 * @returns {object}
 */
export function getMemoryStats() {
  return dbGetMemoryStats();
}

/**
 * Initialize the memory system.
 * Sets up FTS5 virtual table and validates config.
 */
export function initMemorySystem() {
  const config = getMemoryConfig();
  if (!config.enabled) {
    console.log('[memory] Memory system disabled');
    return;
  }

  // Initialize FTS5
  initFts();

  // Initialize sqlite-vec virtual table if available
  try {
    initVecTable(config);
  } catch (err) {
    console.log('[memory] sqlite-vec not available, using brute-force vector search:', err.message);
  }

  const stats = dbGetMemoryStats();
  console.log(`[memory] Initialized — ${stats.total} memories, avg salience ${stats.avgSalience}`);
}

/**
 * Initialize the sqlite-vec virtual table for indexed vector search.
 * @param {object} config
 */
function initVecTable(config) {
  const db = getDb();
  const sqlite = db._.session.client;
  const dimensions = config.tier2.dimensions || 1536;

  // Create the virtual table for vector search
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
      embedding float[${dimensions}]
    );
  `);
}
