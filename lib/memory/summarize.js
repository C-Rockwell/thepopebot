import { createModel } from '../ai/model.js';
import { createMemory } from './manager.js';
import { getMemoryConfig } from './config.js';
import { checkBudget, recordAction } from '../security/budgets.js';

/**
 * Summarize a conversation and store it as a memory.
 *
 * @param {Array<{ role: string, content: string }>} messages - Conversation messages
 * @param {object} options
 * @param {string} options.threadId - Conversation thread ID
 * @param {string} [options.trustLevel='user-direct']
 * @param {string} [options.userId]
 * @returns {Promise<object|null>} Created memory or null if skipped
 */
export async function summarizeConversation(messages, options = {}) {
  const config = getMemoryConfig();
  if (!config.enabled || !config.autoCapture.conversations) return null;

  // Only summarize conversations with enough exchanges
  const minExchanges = config.autoCapture.minExchanges || 3;
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length < minExchanges) return null;

  // Budget check for summarization
  try {
    await checkBudget('memory_summarize');
  } catch {
    return null; // Budget exhausted — skip silently
  }

  try {
    const model = await createModel({ maxTokens: 500 });

    const transcript = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await model.invoke([
      [
        'system',
        'Summarize this conversation into a concise memory entry (2-4 sentences). ' +
        'Focus on key decisions, facts learned, preferences expressed, and action items. ' +
        'Write in third person ("The user..."). Return ONLY the summary.',
      ],
      ['human', transcript],
    ]);

    const summary =
      typeof response.content === 'string'
        ? response.content
        : response.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('');

    const cleaned = summary.trim();
    if (!cleaned) return null;

    recordAction('memory_summarize');

    // Create the memory entry
    const memory = await createMemory(cleaned, {
      summary: cleaned.slice(0, 200),
      trustLevel: options.trustLevel || 'user-direct',
      sourceType: 'conversation',
      sourceId: options.threadId,
      tags: { autoCapture: true, userId: options.userId },
    });

    return memory;
  } catch (err) {
    console.error('[memory:summarize] Failed to summarize conversation:', err.message);
    return null;
  }
}

/**
 * Store a job summary as a memory.
 *
 * @param {string} summaryText - The job summary
 * @param {object} options
 * @param {string} options.jobId
 * @param {string} [options.trustLevel='user-indirect']
 * @returns {Promise<object|null>}
 */
export async function storeJobSummary(summaryText, options = {}) {
  const config = getMemoryConfig();
  if (!config.enabled || !config.autoCapture.jobSummaries) return null;

  try {
    const memory = await createMemory(summaryText, {
      summary: summaryText.slice(0, 200),
      trustLevel: options.trustLevel || 'user-indirect',
      sourceType: 'job-summary',
      sourceId: options.jobId,
      tags: { autoCapture: true },
    });

    return memory;
  } catch (err) {
    console.error('[memory:summarize] Failed to store job summary:', err.message);
    return null;
  }
}
