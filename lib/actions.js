import { exec } from 'child_process';
import { promisify } from 'util';
import { createJob } from './tools/create-job.js';
import { checkBudget, recordAction } from './security/budgets.js';
import { isKilled } from './observe/killswitch.js';
import { logAction } from './observe/logger.js';

const execAsync = promisify(exec);

/**
 * Execute a single action
 * @param {Object} action - { type, job, command, url, method, headers, vars, text, channel, voice } (type: agent|command|webhook|voice)
 * @param {Object} opts - { cwd, data, source, actionName }
 * @returns {Promise<string>} Result description for logging
 */
async function executeAction(action, opts = {}) {
  const type = action.type || 'agent';
  const source = opts.source || 'api';
  const actionName = opts.actionName || action.name || null;
  const startTime = Date.now();

  // Kill switch check
  if (isKilled()) {
    logAction({
      actionType: type,
      actionName,
      source,
      status: 'blocked',
      error: '[KILL SWITCH] All agent actions are paused',
      durationMs: 0,
    });
    throw new Error('[KILL SWITCH] All agent actions are paused');
  }

  // Budget check — throws if exhausted
  try {
    await checkBudget(type);
  } catch (err) {
    logAction({
      actionType: type,
      actionName,
      source,
      status: 'blocked',
      error: err.message,
      durationMs: Date.now() - startTime,
    });
    throw err;
  }

  try {
    let result;

    if (type === 'command') {
      const { stdout, stderr } = await execAsync(action.command, { cwd: opts.cwd });
      recordAction(type);
      result = (stdout || stderr || '').trim();
    } else if (type === 'webhook') {
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
      result = `${method} ${action.url} → ${res.status}`;
    } else if (type === 'voice') {
      const { synthesize } = await import('./voice/tts.js');
      const { getTelegramAdapter } = await import('./channels/index.js');

      const { buffer } = await synthesize(action.text, {
        voice: action.voice,
      });

      const channel = action.channel || 'telegram';
      if (channel === 'telegram') {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!botToken || !chatId) throw new Error('Telegram not configured for voice action');
        const adapter = getTelegramAdapter(botToken);
        await adapter.sendVoiceResponse(chatId, buffer, {});
      }

      recordAction(type);
      result = `voice → ${channel} (${action.text.slice(0, 50)}${action.text.length > 50 ? '...' : ''})`;
    } else {
      // Default: agent
      const options = {};
      if (action.llm_provider) options.llmProvider = action.llm_provider;
      if (action.llm_model) options.llmModel = action.llm_model;
      const jobResult = await createJob(action.job, options);
      recordAction(type);
      result = `job ${jobResult.job_id} — ${jobResult.title}`;
    }

    // Log successful action
    logAction({
      actionType: type,
      actionName,
      source,
      status: 'success',
      result,
      durationMs: Date.now() - startTime,
      input: { type, ...(action.job ? { job: action.job } : {}), ...(action.command ? { command: action.command } : {}), ...(action.url ? { url: action.url } : {}) },
    });

    return result;
  } catch (err) {
    // Log failed action, then re-throw
    logAction({
      actionType: type,
      actionName,
      source,
      status: 'error',
      error: err.message,
      durationMs: Date.now() - startTime,
      input: { type, ...(action.job ? { job: action.job } : {}), ...(action.command ? { command: action.command } : {}), ...(action.url ? { url: action.url } : {}) },
    });
    throw err;
  }
}

export { executeAction };
