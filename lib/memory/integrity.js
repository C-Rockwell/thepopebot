import { createHash } from 'crypto';
import { getMemoryConfig } from './config.js';
import { getMemoryById, updateMemory } from '../db/memories.js';
import { insertAuditLog } from '../db/memories.js';

/**
 * Compute a SHA-256 checksum of memory content.
 * @param {string} content
 * @param {Buffer|null} [embedding] - Optional embedding to include in checksum
 * @returns {string} Checksum in "sha256:..." format
 */
export function computeChecksum(content, embedding = null) {
  const hash = createHash('sha256');
  hash.update(content);
  if (embedding) {
    hash.update(embedding);
  }
  return `sha256:${hash.digest('hex')}`;
}

/**
 * Verify that a stored memory's checksum matches its content.
 * @param {object} memory - Memory object with content, tags, embedding
 * @returns {boolean} True if valid or no checksum stored
 */
export function verifyChecksum(memory) {
  const tags = memory.tags || {};
  if (!tags.checksum) return true; // No checksum stored — skip

  const expected = computeChecksum(memory.content, memory.embedding);
  return tags.checksum === expected;
}

/**
 * Detect potential prompt injection / poisoning in content.
 * @param {string} content
 * @returns {{ poisoned: boolean, matches: string[] }}
 */
export function detectPoisoning(content) {
  const config = getMemoryConfig();
  if (!config.poisonDetection.enabled) {
    return { poisoned: false, matches: [] };
  }

  const lower = content.toLowerCase();
  const matches = config.poisonDetection.patterns.filter((p) =>
    lower.includes(p.toLowerCase())
  );

  return {
    poisoned: matches.length > 0,
    matches,
  };
}

/**
 * Flag a memory as suspicious.
 * Updates its tags with a flag and creates an audit log entry.
 * @param {string} memoryId
 * @param {string} reason
 * @param {string} [actor='system']
 */
export function flagMemory(memoryId, reason, actor = 'system') {
  const memory = getMemoryById(memoryId);
  if (!memory) return;

  const tags = memory.tags || {};
  tags.flagged = true;
  tags.flagReason = reason;
  tags.flaggedAt = Date.now();

  updateMemory(memoryId, { tags });

  insertAuditLog({
    memoryId,
    action: 'flag',
    actor,
    details: { reason },
  });
}

/**
 * Store a checksum in a memory's tags.
 * @param {string} memoryId
 * @param {string} content
 * @param {Buffer|null} [embedding]
 */
export function storeChecksum(memoryId, content, embedding = null) {
  const memory = getMemoryById(memoryId);
  if (!memory) return;

  const tags = memory.tags || {};
  tags.checksum = computeChecksum(content, embedding);

  updateMemory(memoryId, { tags });
}
