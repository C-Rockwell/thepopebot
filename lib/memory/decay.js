import { getMemoryConfig } from './config.js';
import { getAllMemoriesForDecay, getMemoryById, updateMemory, deleteMemory, insertAuditLog } from '../db/memories.js';

let _decayInterval = null;

/**
 * Calculate decayed salience score using exponential decay.
 * score = initialScore * (0.5 ^ (elapsed / halfLife))
 *
 * @param {number} initialScore - Starting salience score
 * @param {number} elapsedMs - Time elapsed since last access
 * @param {number} halfLifeMs - Half-life in milliseconds
 * @returns {number} Decayed score
 */
export function calculateDecay(initialScore, elapsedMs, halfLifeMs) {
  if (halfLifeMs <= 0) return initialScore;
  return initialScore * Math.pow(0.5, elapsedMs / halfLifeMs);
}

/**
 * Reinforce a memory's salience (called on access/retrieval).
 * score = min(1.0, currentScore + reinforceAmount)
 *
 * @param {string} memoryId
 */
export function reinforceMemory(memoryId) {
  const config = getMemoryConfig();
  const { reinforceAmount } = config.tier1.decay;

  const memory = getMemoryById(memoryId);
  if (!memory) return;

  const newScore = Math.min(1.0, memory.salienceScore + reinforceAmount);
  updateMemory(memoryId, {
    salienceScore: newScore,
    lastAccessedAt: Date.now(),
  });

  insertAuditLog({
    memoryId,
    action: 'access',
    actor: 'system',
    details: { previousScore: memory.salienceScore, newScore },
  });
}

/**
 * Run decay on all memories. Apply exponential decay curve and prune
 * memories that fall below minScore.
 *
 * @returns {{ decayed: number, pruned: number }}
 */
export function decayMemories() {
  const config = getMemoryConfig();
  const { halfLifeMs, minScore } = config.tier1.decay;
  const now = Date.now();

  const allMemories = getAllMemoriesForDecay();
  let decayed = 0;
  let pruned = 0;

  for (const mem of allMemories) {
    const elapsed = now - mem.lastAccessedAt;
    const newScore = calculateDecay(mem.salienceScore, elapsed, halfLifeMs);

    if (newScore < minScore) {
      // Prune memory below threshold
      insertAuditLog({
        memoryId: mem.id,
        action: 'decay',
        actor: 'system',
        details: { finalScore: newScore, reason: 'below_min_score' },
      });
      deleteMemory(mem.id);
      pruned++;
    } else if (Math.abs(newScore - mem.salienceScore) > 0.001) {
      // Update score if it changed meaningfully
      updateMemory(mem.id, { salienceScore: newScore });
      decayed++;
    }
  }

  return { decayed, pruned };
}

/**
 * Start the periodic decay job.
 * Runs every hour by default.
 * @param {number} [intervalMs=3600000] - Interval in milliseconds
 */
export function startDecayTimer(intervalMs = 3600000) {
  if (_decayInterval) return;

  _decayInterval = setInterval(() => {
    try {
      const result = decayMemories();
      if (result.decayed > 0 || result.pruned > 0) {
        console.log(`[memory:decay] Decayed ${result.decayed}, pruned ${result.pruned} memories`);
      }
    } catch (err) {
      console.error('[memory:decay] Error:', err);
    }
  }, intervalMs);

  // Don't keep the process alive just for decay
  if (_decayInterval.unref) _decayInterval.unref();
}

/**
 * Stop the decay timer.
 */
export function stopDecayTimer() {
  if (_decayInterval) {
    clearInterval(_decayInterval);
    _decayInterval = null;
  }
}
