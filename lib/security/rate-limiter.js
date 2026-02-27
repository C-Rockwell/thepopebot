import { getSecurityConfig } from './config.js';

/** @type {Map<string, number[]>} key → array of request timestamps */
const ipStore = new Map();
const keyStore = new Map();

let cleanupInterval = null;

/**
 * Determine the rate limit tier for a given route path.
 * @param {string} routePath
 * @returns {string}
 */
function getTier(routePath) {
  if (routePath === '/telegram/webhook') return 'telegram';
  if (routePath === '/ping' || routePath === '/github/webhook') return 'public';
  return 'api';
}

/**
 * Extract a rate-limit key from the request.
 * Prefers API key prefix (first 8 chars) for authenticated requests,
 * falls back to IP address.
 * @param {Request} request
 * @returns {{ store: Map, key: string }}
 */
function getStoreAndKey(request) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return { store: keyStore, key: apiKey.slice(0, 8) };
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return { store: ipStore, key: ip };
}

/**
 * Check rate limit for an incoming request.
 * Returns a 429 Response if limit exceeded, or null if OK.
 * @param {string} routePath
 * @param {Request} request
 * @returns {Response|null}
 */
export function checkRateLimit(routePath, request) {
  const config = getSecurityConfig();
  if (!config.rateLimits.enabled) return null;

  const tier = getTier(routePath);
  const tierConfig = config.rateLimits.tiers[tier];
  if (!tierConfig) return null;

  const { maxRequests, windowMs } = tierConfig;
  const { store, key } = getStoreAndKey(request);
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps = store.get(key);
  if (timestamps) {
    // Prune timestamps outside the window
    timestamps = timestamps.filter((t) => t > windowStart);
  } else {
    timestamps = [];
  }

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    store.set(key, timestamps);
    return Response.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return null;
}

/**
 * Prune stale entries from both stores.
 */
function cleanup() {
  const config = getSecurityConfig();
  const maxWindow = Math.max(
    ...Object.values(config.rateLimits.tiers).map((t) => t.windowMs)
  );
  const cutoff = Date.now() - maxWindow;

  for (const store of [ipStore, keyStore]) {
    for (const [key, timestamps] of store) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }
}

/**
 * Start the periodic cleanup interval.
 * Called once from instrumentation.js at startup.
 */
export function initRateLimiter() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanup, 5 * 60 * 1000); // every 5 min
  // Don't keep the process alive just for cleanup
  if (cleanupInterval.unref) cleanupInterval.unref();
}
