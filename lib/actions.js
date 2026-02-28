import { exec } from 'child_process';
import { promisify } from 'util';
import { createJob } from './tools/create-job.js';
import { checkBudget, recordAction } from './security/budgets.js';

const execAsync = promisify(exec);

/**
 * Execute a single action
 * @param {Object} action - { type, job, command, url, method, headers, vars, text, channel, voice } (type: agent|command|webhook|voice)
 * @param {Object} opts - { cwd, data }
 * @returns {Promise<string>} Result description for logging
 */
async function executeAction(action, opts = {}) {
  const type = action.type || 'agent';

  // Budget check — throws if exhausted
  await checkBudget(type);

  if (type === 'command') {
    const { stdout, stderr } = await execAsync(action.command, { cwd: opts.cwd });
    recordAction(type);
    return (stdout || stderr || '').trim();
  }

  if (type === 'webhook') {
    const method = (action.method || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json', ...action.headers };
    const fetchOpts = { method, headers };

    if (method !== 'GET') {
      const body = { ...action.vars };
      if (opts.data) body.data = opts.data;
      fetchOpts.body = JSON.stringify(body);
    }

    const res = await fetch(action.url, fetchOpts);
    recordAction(type);
    return `${method} ${action.url} → ${res.status}`;
  }

  if (type === 'voice') {
    const { synthesize } = await import('./voice/tts.js');
    const { getTelegramAdapter } = await import('./channels/index.js');

    const { buffer } = await synthesize(action.text, {
      voice: action.voice,
    });

    // Resolve target channel adapter (default: telegram)
    const channel = action.channel || 'telegram';
    if (channel === 'telegram') {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) throw new Error('Telegram not configured for voice action');
      const adapter = getTelegramAdapter(botToken);
      await adapter.sendVoiceResponse(chatId, buffer, {});
    }

    recordAction(type);
    return `voice → ${channel} (${action.text.slice(0, 50)}${action.text.length > 50 ? '...' : ''})`;
  }

  // Default: agent
  const options = {};
  if (action.llm_provider) options.llmProvider = action.llm_provider;
  if (action.llm_model) options.llmModel = action.llm_model;
  const result = await createJob(action.job, options);
  recordAction(type);
  return `job ${result.job_id} — ${result.title}`;
}

export { executeAction };
