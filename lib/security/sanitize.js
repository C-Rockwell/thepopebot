import { getSecurityConfig } from './config.js';

export const TRUST_LEVELS = {
  USER_DIRECT: 'user-direct',
  USER_INDIRECT: 'user-indirect',
  EXTERNAL_UNTRUSTED: 'external-untrusted',
};

const SOURCE_TRUST_MAP = {
  'api-key': TRUST_LEVELS.USER_DIRECT,
  'telegram': TRUST_LEVELS.USER_INDIRECT,
  'github-webhook': TRUST_LEVELS.EXTERNAL_UNTRUSTED,
  'public-webhook': TRUST_LEVELS.EXTERNAL_UNTRUSTED,
};

/**
 * Classify trust level based on the authentication source.
 * @param {string} source - e.g. 'api-key', 'telegram', 'github-webhook'
 * @returns {string} trust level
 */
export function classifyTrust(source) {
  return SOURCE_TRUST_MAP[source] || TRUST_LEVELS.EXTERNAL_UNTRUSTED;
}

/**
 * Sanitize content by stripping injection patterns.
 * Only strips from external-untrusted content.
 * @param {string} content
 * @param {string} trustLevel
 * @returns {string}
 */
export function sanitize(content, trustLevel) {
  if (!content || typeof content !== 'string') return content;

  const config = getSecurityConfig();
  if (!config.sanitization.enabled) return content;

  // Only sanitize untrusted content
  if (trustLevel !== TRUST_LEVELS.EXTERNAL_UNTRUSTED) return content;

  let sanitized = content;
  for (const pattern of config.sanitization.stripPatterns) {
    const regex = new RegExp(pattern, 'gi');
    if (regex.test(sanitized)) {
      if (config.sanitization.logBlocked) {
        console.warn(`[SECURITY] Blocked injection pattern: "${pattern}" in content`);
      }
      sanitized = sanitized.replace(regex, '[blocked]');
    }
  }

  return sanitized;
}

/**
 * Tag a data object with its trust level.
 * @param {Object} data - Request body or similar object
 * @param {string} trustLevel
 * @returns {Object} data with _trust property added
 */
export function tagTrust(data, trustLevel) {
  if (!data || typeof data !== 'object') return data;
  return { ...data, _trust: trustLevel };
}
