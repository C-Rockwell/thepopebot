import { getMemoryConfig } from './config.js';

/**
 * Check if embedding generation is available.
 * Requires OPENAI_API_KEY and tier2 enabled in config.
 * @returns {boolean}
 */
export function isEmbeddingAvailable() {
  const config = getMemoryConfig();
  if (!config.tier2.enabled) return false;
  if (!process.env.OPENAI_API_KEY) return false;
  return true;
}

/**
 * Generate an embedding vector for the given text.
 * Uses OpenAI text-embedding-3-small by default.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<Float32Array|null>} Embedding vector or null if unavailable
 */
export async function generateEmbedding(text) {
  if (!isEmbeddingAvailable()) return null;

  const config = getMemoryConfig();
  const { model, dimensions } = config.tier2;

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model,
      dimensions,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[embeddings] OpenAI API error:', response.status, err);
    return null;
  }

  const data = await response.json();
  const vector = data.data?.[0]?.embedding;
  if (!vector) return null;

  // Store as Float32Array for compact binary storage in SQLite blob
  return new Float32Array(vector);
}

/**
 * Generate embeddings for multiple texts in a batch.
 * @param {string[]} texts
 * @returns {Promise<(Float32Array|null)[]>}
 */
export async function generateEmbeddingsBatch(texts) {
  if (!isEmbeddingAvailable() || !texts.length) {
    return texts.map(() => null);
  }

  const config = getMemoryConfig();
  const { model, dimensions } = config.tier2;

  // OpenAI supports batch embedding — send all at once
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
      dimensions,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[embeddings] Batch API error:', response.status, err);
    return texts.map(() => null);
  }

  const data = await response.json();
  // Sort by index to ensure correct ordering
  const sorted = data.data?.sort((a, b) => a.index - b.index) || [];

  return texts.map((_, i) => {
    const vector = sorted[i]?.embedding;
    return vector ? new Float32Array(vector) : null;
  });
}

/**
 * Convert a Float32Array to a Buffer for SQLite blob storage.
 * @param {Float32Array} embedding
 * @returns {Buffer}
 */
export function embeddingToBuffer(embedding) {
  return Buffer.from(embedding.buffer);
}

/**
 * Convert a Buffer from SQLite back to Float32Array.
 * @param {Buffer} buffer
 * @returns {Float32Array}
 */
export function bufferToEmbedding(buffer) {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

/**
 * Compute cosine similarity between two Float32Arrays.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number} Similarity score (-1 to 1)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
