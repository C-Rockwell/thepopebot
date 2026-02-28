# thepopebot — Package Source Reference

Technical reference for AI assistants modifying the thepopebot NPM package source code.

**Architecture**: Event Handler (Next.js) creates `job/*` branches → GitHub Actions runs Docker agent (Pi) → task executed → PR created → auto-merge → notification. Agent jobs log to `logs/{JOB_ID}/`.

## Package vs. Templates — Where Code Goes

All event handler logic, API routes, library code, and core functionality lives in the **npm package** (`api/`, `lib/`, `config/`, `bin/`). This is what users import when they `import ... from 'thepopebot/...'`.

The `templates/` directory contains **only files that get scaffolded into user projects** via `npx thepopebot init`. Templates are for user-editable configuration and thin wiring — things users are expected to customize or override. Never add core logic to templates.

**When adding or modifying event handler code, always put it in the package itself (e.g., `api/`, `lib/`), not in `templates/`.** Templates should only contain:
- Configuration files users edit (`config/SOUL.md`, `config/CRONS.json`, etc.)
- Thin Next.js wiring (`next.config.mjs`, `instrumentation.js`, catch-all route)
- GitHub Actions workflows
- Docker files
- CLAUDE.md files for AI assistant context in user projects

## Directory Structure

```
/
├── api/
│   └── index.js                # GET/POST handlers for all /api/* routes
├── lib/
│   ├── actions.js              # Shared action executor (agent, command, webhook)
│   ├── cron.js                 # Cron scheduler (loads CRONS.json)
│   ├── triggers.js             # Webhook trigger middleware (loads TRIGGERS.json)
│   ├── paths.js                # Central path resolver (resolves from user's project root)
│   ├── ai/                     # LLM integration (chat, streaming, agent, model, tools)
│   ├── auth/                   # NextAuth config, helpers, middleware, server actions
│   ├── channels/               # Channel adapters (base class, Telegram, factory)
│   ├── chat/                   # Chat route handler, server actions, React UI components
│   ├── db/                     # SQLite via Drizzle (schema, migrations, api-keys)
│   ├── memory/                 # Persistent memory system (FTS5, embeddings, decay)
│   ├── security/               # Rate limiting, action budgets, input sanitization
│   ├── tools/                  # Job creation, GitHub API, Telegram, OpenAI Whisper
│   ├── voice/                  # Voice subsystem (STT, TTS, config)
│   ├── observe/                # Observability (action logging, kill switch, anomaly detection)
│   └── utils/
│       └── render-md.js        # Markdown {{include}} processor
├── config/
│   ├── index.js                # withThepopebot() Next.js config wrapper
│   └── instrumentation.js      # Server startup hook (loads .env, starts crons)
├── bin/
│   └── cli.js                  # CLI entry point
├── setup/                      # Interactive setup wizard
├── templates/                  # Scaffolded to user projects (see rule above)
├── docs/                       # Extended documentation
└── package.json
```

## Key Files

| File | Purpose |
|------|---------|
| `api/index.js` | Next.js GET/POST route handlers for all `/api/*` endpoints |
| `lib/paths.js` | Central path resolver — all paths resolve from user's `process.cwd()` |
| `lib/actions.js` | Shared action dispatcher for agent/command/webhook/voice actions |
| `lib/cron.js` | Cron scheduler — loads `config/CRONS.json` at server start |
| `lib/triggers.js` | Trigger middleware — loads `config/TRIGGERS.json` |
| `lib/utils/render-md.js` | Markdown include and variable processor (`{{filepath}}`, `{{datetime}}`, `{{skills}}`) |
| `config/index.js` | `withThepopebot()` Next.js config wrapper |
| `config/instrumentation.js` | `register()` startup hook (loads .env, validates AUTH_SECRET, init DB, init kill switch, starts crons, init security, init memory, init voice, init observe) |
| `bin/cli.js` | CLI entry point (`thepopebot init`, `setup`, `reset`, `diff`, etc.) |
| `lib/ai/index.js` | Chat, streaming, and job summary functions |
| `lib/ai/agent.js` | LangGraph agent with SQLite checkpointing and tool use |
| `lib/channels/base.js` | Channel adapter base class (normalize messages across platforms) |
| `lib/db/index.js` | Database initialization — SQLite via Drizzle ORM |
| `lib/db/api-keys.js` | API key management (SHA-256 hashed, timing-safe verify) |
| `lib/security/config.js` | Loads `config/SECURITY.json`, deep-merges with defaults, cached singleton |
| `lib/security/rate-limiter.js` | Sliding-window rate limiter (per IP / API key prefix), 3 tiers |
| `lib/security/budgets.js` | Per-action-type budget enforcement, notifies on exhaustion |
| `lib/security/sanitize.js` | Trust classification + prompt injection pattern stripping |
| `lib/memory/config.js` | Loads `config/MEMORY.json`, deep-merges with defaults, cached singleton |
| `lib/memory/manager.js` | Core memory CRUD, FTS5/semantic/hybrid search, initialization |
| `lib/memory/fts.js` | FTS5 virtual table setup, sync triggers, full-text search |
| `lib/memory/embeddings.js` | OpenAI embedding generation, cosine similarity, buffer conversion |
| `lib/memory/decay.js` | Exponential salience decay, reinforcement on access, periodic cleanup |
| `lib/memory/integrity.js` | SHA-256 checksums, poison detection, memory flagging |
| `lib/memory/summarize.js` | Conversation summarization, job summary memory capture |
| `lib/db/memories.js` | Drizzle query functions for memories + audit log tables |
| `lib/observe/config.js` | Loads `config/OBSERVE.json`, deep-merges with defaults, cached singleton |
| `lib/observe/logger.js` | Action logging to `action_log` table, log pruning by retention |
| `lib/observe/killswitch.js` | Kill switch: activate/deactivate, persist to settings table, stop/restart crons |
| `lib/observe/anomaly.js` | Periodic anomaly detection (frequency spikes, off-hours, errors, budget warnings) |
| `lib/db/action-log.js` | Drizzle query functions for `action_log` table |
| `lib/db/anomaly-alerts.js` | Drizzle query functions for `anomaly_alerts` table |

## NPM Package Exports

| Import | Module | Purpose |
|--------|--------|---------|
| `thepopebot/api` | `api/index.js` | `GET` and `POST` route handlers — re-exported by the user's catch-all route |
| `thepopebot/config` | `config/index.js` | `withThepopebot()` — wraps the user's Next.js config to mark server-only packages as external |
| `thepopebot/instrumentation` | `config/instrumentation.js` | `register()` — Next.js instrumentation hook that loads `.env` and starts cron jobs on server start |
| `thepopebot/auth` | `lib/auth/index.js` | Auth helpers (`auth()`, `getPageAuthState()`) |
| `thepopebot/auth/actions` | `lib/auth/actions.js` | Server action for admin setup (`setupAdmin()`) |
| `thepopebot/chat` | `lib/chat/components/index.js` | Chat UI components |
| `thepopebot/chat/actions` | `lib/chat/actions.js` | Server actions for chats, notifications, and swarm |
| `thepopebot/chat/api` | `lib/chat/api.js` | Dedicated chat streaming route handler (session auth) |
| `thepopebot/db` | `lib/db/index.js` | Database access |
| `thepopebot/middleware` | `lib/auth/middleware.js` | Auth middleware |

### Column Naming Convention

Drizzle schema uses camelCase JS property names mapped to snake_case SQL columns.
Example: `createdAt: integer('created_at')` — use `createdAt` in JS, SQL column is `created_at`.

## Database

SQLite via Drizzle ORM at `data/thepopebot.sqlite` (override with `DATABASE_PATH`). Auto-initialized on server start.

| Table | Purpose |
|-------|---------|
| `users` | Admin accounts (email, bcrypt password hash, role) |
| `chats` | Chat sessions (user_id, title, timestamps) |
| `messages` | Chat messages (chat_id, role, content) |
| `notifications` | Job completion notifications |
| `subscriptions` | Channel subscriptions |
| `settings` | Key-value configuration store (also stores API keys) |
| `memories` | Persistent memory entries (content, summary, embeddings, salience scores) |
| `memory_audit_log` | Audit trail for memory operations (create, access, update, decay, delete, flag) |
| `action_log` | Dispatched action history (type, source, status, timing, errors) |
| `anomaly_alerts` | Anomaly detection alerts (frequency spikes, off-hours, errors, budget warnings) |

### Migration Rules

**All schema changes MUST go through the migration workflow.**

- **NEVER** write raw `CREATE TABLE`, `ALTER TABLE`, or any DDL SQL manually
- **NEVER** modify `initDatabase()` to add schema changes
- **ALWAYS** make schema changes by editing `lib/db/schema.js` then running `npm run db:generate`

**Workflow**: Edit `lib/db/schema.js` → `npm run db:generate` → review generated SQL in `drizzle/` → commit both schema change and migration file. Migrations auto-apply on startup via `migrate()` in `initDatabase()`.

**Key files**: `lib/db/schema.js` (source of truth), `drizzle/` (generated migrations), `drizzle.config.js` (Drizzle Kit config), `lib/db/index.js` (`initDatabase()` calls `migrate()`).

## Security: /api vs Server Actions

**`/api` routes are for external callers only.** They authenticate via `x-api-key` header or webhook secrets (Telegram, GitHub). Never add session/cookie auth to `/api` routes.

**Browser UI uses Server Actions.** All authenticated browser-to-server calls MUST use Next.js Server Actions (`'use server'` functions in `lib/chat/actions.js` or `lib/auth/actions.js`), not `/api` fetch calls. Server Actions use the `requireAuth()` pattern which validates the session cookie internally.

**Exception: chat streaming.** The AI SDK's `DefaultChatTransport` requires an HTTP endpoint. Chat has its own route handler at `lib/chat/api.js` (mapped to `/stream/chat`) with session auth, outside `/api`.

| Caller | Mechanism | Auth | Location |
|--------|-----------|------|----------|
| External (cURL, GitHub Actions, Telegram) | `/api` route handler | `x-api-key` or webhook secret | `api/index.js` |
| Browser UI (data/mutations) | Server Action | `requireAuth()` session check | `lib/chat/actions.js`, `lib/auth/actions.js` |
| Browser UI (chat streaming) | Dedicated route handler | `auth()` session check | `lib/chat/api.js` |

## Action Dispatch System

Both cron jobs and webhook triggers use the same shared dispatch system (`lib/actions.js`). Every action has a `type` field — `"agent"` (default), `"command"`, `"webhook"`, or `"voice"`.

| | `agent` | `command` | `webhook` | `voice` |
|---|---------|-----------|-----------|---------|
| **Uses LLM** | Yes — spins up Pi in a Docker container | No — runs a shell command | No — makes an HTTP request | No — synthesizes speech via TTS API |
| **Runtime** | Minutes to hours | Milliseconds to seconds | Milliseconds to seconds | Seconds |
| **Cost** | LLM API calls + GitHub Actions minutes | Free (runs on event handler) | Free (runs on event handler) | TTS API calls |

If the task needs to *think*, use `agent`. If it just needs to *do*, use `command`. If it needs to *call an external service*, use `webhook`. If it needs to *speak*, use `voice`.

**Agent**: Creates a Docker Agent job via `createJob()`. Pushes a `job/*` branch; `run-job.yml` spins up the container. The `job` string is the LLM task prompt.

**Command**: Runs a shell command on the event handler. Working directory: `cron/` for crons, `triggers/` for triggers.

**Webhook**: Makes an HTTP request. `GET` skips the body; `POST` (default) sends `{ ...vars }` or `{ ...vars, data: <payload> }`.

| Webhook field | Required | Default | Description |
|---------------|----------|---------|-------------|
| `url` | yes | — | Target URL |
| `method` | no | `"POST"` | `"GET"` or `"POST"` |
| `headers` | no | `{}` | Outgoing request headers |
| `vars` | no | `{}` | Key-value pairs merged into outgoing body |

**Voice**: Synthesizes speech via TTS API and sends audio to a channel. Requires voice system to be enabled (`config/VOICE.json`).

| Voice field | Required | Default | Description |
|-------------|----------|---------|-------------|
| `text` | yes | — | Text to synthesize into speech |
| `channel` | no | `"telegram"` | Target channel to send audio to |
| `voice` | no | config default | TTS voice (e.g., `"alloy"`, `"echo"`, `"nova"`) |

### Cron Jobs

Defined in `config/CRONS.json`, loaded by `lib/cron.js` at startup via `node-cron`. Each entry has `name`, `schedule` (cron expression), `type` (`agent`/`command`/`webhook`), and the corresponding action fields (`job`, `command`, or `url`/`method`/`headers`/`vars`). Set `enabled: false` to disable. Agent-type entries support optional `llm_provider` and `llm_model` fields to override the default LLM (passed to Docker agent via `job.config.json`).

### Webhook Triggers

Defined in `config/TRIGGERS.json`, loaded by `lib/triggers.js`. Each trigger watches an endpoint path (`watch_path`) and fires an array of actions (fire-and-forget, after auth, before route handler). Actions use the same `type`/`job`/`command`/`url`/`text` fields as cron jobs, including optional `llm_provider`/`llm_model` overrides. Template tokens in `job`, `command`, and `text` strings: `{{body}}`, `{{body.field}}`, `{{query}}`, `{{query.field}}`, `{{headers}}`, `{{headers.field}}`.

## Markdown File Includes

Markdown files in `config/` support includes and built-in variables, powered by `lib/utils/render-md.js`.

- **File includes**: `{{ filepath.md }}` — resolves relative to project root, recursive with circular detection. Missing files are left as-is.
- **`{{datetime}}`** — Current ISO timestamp.
- **`{{skills}}`** — Dynamic bullet list of active skill descriptions from `.pi/skills/*/SKILL.md` frontmatter. Never hardcode skill names — this is resolved at runtime.

Currently used by the Event Handler to load EVENT_HANDLER.md as the LLM system prompt.

## Authentication

NextAuth v5 with Credentials provider (email/password), JWT in httpOnly cookies. First visit creates admin account. `requireAuth()` validates sessions in server actions. API routes use `x-api-key` header. `AUTH_SECRET` env var required for session encryption.

## Security Layer (`lib/security/`)

All security features are configured via `config/SECURITY.json` (user-editable, scaffolded by `npx thepopebot init`). Missing file or keys fall back to hardcoded defaults — no errors. All state is in-memory (no database tables).

### Rate Limiting

Sliding-window rate limiter in `api/index.js`, checked **before auth** to block brute-force attacks. Two in-memory stores: one keyed by IP, one by API key prefix.

| Tier | Routes | Default |
|------|--------|---------|
| `api` | Authenticated `/api/*` routes | 60 req/min |
| `public` | `/ping`, `/github/webhook` | 30 req/min |
| `telegram` | `/telegram/webhook` | 20 req/min |

429 responses include a `Retry-After` header. Cleanup runs every 5 minutes (started by `initRateLimiter()` in `instrumentation.js`).

### Action Budgets

Enforced in `lib/actions.js` via `checkBudget(type)` before dispatch and `recordAction(type)` after success. Resets automatically when the time window expires.

| Action Type | Default Budget |
|-------------|---------------|
| `agent` | 10/hour |
| `command` | 60/hour |
| `webhook` | 120/hour |
| `memory_summarize` | 5/hour |
| `voice` | 30/hour |

On exhaustion: throws (callers in `cron.js`/`triggers.js` catch naturally) and creates a notification via `createNotification()` (distributed to Telegram subscribers).

### Trust Classification & Input Sanitization

Every incoming request body is tagged with a trust level in `api/index.js` via `tagTrust()`:

| Source | Trust Level | Sanitized? |
|--------|-------------|------------|
| `x-api-key` auth | `user-direct` | No |
| Telegram webhook | `user-indirect` | No |
| GitHub/public webhook | `external-untrusted` | Yes |

Only `external-untrusted` content is sanitized. Sanitization strips prompt injection patterns (configurable in `SECURITY.json`) and replaces them with `[blocked]`. Applied in:
- `api/index.js` — GitHub webhook log content before it reaches `summarizeJob()`
- `lib/triggers.js` — resolved `command`, `job`, and `text` template strings

## Memory System (`lib/memory/`)

Persistent memory gives the agent context across sessions. Configured via `config/MEMORY.json` (user-editable, scaffolded by `npx thepopebot init`). Missing file or keys fall back to hardcoded defaults.

### Architecture

Two-tier search system:
- **Tier 1 (FTS5)**: SQLite full-text search on memory `content` + `summary` fields via `memories_fts` virtual table. Always available.
- **Tier 2 (Vector Embeddings)**: OpenAI `text-embedding-3-small` embeddings stored as blobs. Requires `OPENAI_API_KEY`. Graceful degradation — if unavailable, falls back to FTS5-only search.

**Hybrid search** combines FTS5 keyword relevance (40% weight) + vector cosine similarity (60% weight) and re-ranks results.

### Salience Decay

Memories have a `salienceScore` (0.0–1.0) that decays exponentially over time:
- **Decay**: `score = initial × 0.5^(elapsed / halfLife)` — default half-life: 7 days
- **Reinforcement**: Accessing a memory bumps score by `+0.3` (capped at 1.0)
- **Pruning**: Memories below `minScore` (0.1) are auto-deleted with audit trail
- Decay job runs hourly (started in `instrumentation.js`)

### Auto-Capture

Memories are created automatically from:
- **Conversations**: Summarized after 3+ exchanges via LLM (budget: 5/hour via `memory_summarize`)
- **Job summaries**: Stored when `summarizeJob()` completes

### Integrity & Poison Detection

- SHA-256 checksums cover content + embedding (stored in `tags.checksum`)
- Poison detection scans for instruction-like patterns before storage (configurable in `MEMORY.json`)
- Flagged memories get `tags.flagged = true` + audit log entry

### Agent Tool

The `search_memory` tool is available to the LangGraph agent for querying memories during conversations. Pi (Docker agent) does not have direct memory access — relevant memories are injected into job prompts.

### Key Files

| File | Purpose |
|------|---------|
| `lib/memory/config.js` | Singleton config loader (`MEMORY.json` + defaults) |
| `lib/memory/manager.js` | `createMemory()`, `searchMemories()`, `semanticSearch()`, `hybridSearch()`, `getRelevantMemories()`, `initMemorySystem()` |
| `lib/memory/fts.js` | FTS5 virtual table setup + `searchFts()` |
| `lib/memory/embeddings.js` | `generateEmbedding()`, `cosineSimilarity()`, buffer conversion |
| `lib/memory/decay.js` | `decayMemories()`, `reinforceMemory()`, `startDecayTimer()` |
| `lib/memory/integrity.js` | `computeChecksum()`, `detectPoisoning()`, `flagMemory()` |
| `lib/memory/summarize.js` | `summarizeConversation()`, `storeJobSummary()` |
| `lib/db/memories.js` | Drizzle CRUD for `memories` + `memory_audit_log` tables |

## Voice System (`lib/voice/`)

Voice capabilities: multi-provider STT (speech-to-text), TTS (text-to-speech), and a `voice` action type. Configured via `config/VOICE.json` (user-editable, scaffolded by `npx thepopebot init`). **Disabled by default** — set `enabled: true` to activate. Missing file or keys fall back to hardcoded defaults.

### Architecture

- **STT**: Multi-provider with automatic fallback. Primary: Groq (`GROQ_API_KEY`), fallback: OpenAI (`OPENAI_API_KEY`). Both use OpenAI-compatible Whisper API. File size validation against `stt.maxAudioSizeMb`.
- **TTS**: OpenAI TTS API (`OPENAI_API_KEY`). Configurable voice, speed, and format. Returns audio buffer + MIME type.
- **Channel Integration**: Telegram adapter detects voice/audio messages, transcribes via STT, optionally responds with TTS audio. Web chat has microphone button for recording voice input.
- **Voice Actions**: The `voice` action type in crons/triggers synthesizes speech and sends to a channel.

### Environment Variables

| Variable | Required for | Description |
|----------|-------------|-------------|
| `GROQ_API_KEY` | STT (primary) | Groq API key for Whisper transcription |
| `OPENAI_API_KEY` | STT (fallback) + TTS | OpenAI API key (also used by embeddings/memory) |

### Key Files

| File | Purpose |
|------|---------|
| `lib/voice/config.js` | Singleton config loader (`VOICE.json` + defaults) |
| `lib/voice/stt.js` | Multi-provider STT with fallback (`transcribe()`, `isSttEnabled()`) |
| `lib/voice/tts.js` | OpenAI TTS (`synthesize()`, `isTtsEnabled()`) |
| `lib/tools/openai.js` | Backward-compatible re-exports from `lib/voice/stt.js` |

## Observability Layer (`lib/observe/`)

Mission Control dashboard and observability features. Configured via `config/OBSERVE.json` (user-editable, scaffolded by `npx thepopebot init`). Missing file or keys fall back to hardcoded defaults.

### Action Logging

Every dispatched action (cron, trigger, API) is logged to the `action_log` table via `logAction()` in `lib/observe/logger.js`. The wrapper in `lib/actions.js` records timing, status, errors, and source metadata. Old entries are pruned daily based on `logger.retentionDays` (default: 30 days).

### Kill Switch

In-memory flag persisted to the `settings` table. When active:
- All `executeAction()` calls throw immediately
- `fireTriggers()` returns immediately
- `/api` routes return `503 Service Unavailable` (except `/ping` and `/github/webhook`)
- All cron tasks are stopped via `stopAllCrons()`

On deactivation, crons restart via `restartCrons()`. State survives server restarts — `initKillSwitch()` reads persisted state in `instrumentation.js` and skips `loadCrons()` if active.

### Anomaly Detection

Periodic checks (default: every 15 min) via `startAnomalyTimer()`:

| Check | Description | Severity |
|-------|-------------|----------|
| **Frequency spike** | Actions in last 15 min > 3x the 7-day rolling average (min 5 actions) | warning/critical |
| **Off-hours activity** | Actions outside normal hours (6–23) exceeding threshold (5) | warning |
| **Repeated errors** | Same action name failed > 3 times in the last hour | warning/critical |
| **Budget warning** | Any budget type > 80% consumed | warning/critical |

Alerts are deduplicated per type per hour. Warning/critical alerts create notifications via `createNotification()`.

### Dashboard (Mission Control)

Server actions in `lib/chat/actions.js`: `getDashboardData()`, `getActionLog()`, `toggleKillSwitch()`, `acknowledgeAnomaly()`, `acknowledgeAllAnomalies()`.

UI at `/dashboard` — auto-refreshes every 10s. Layout: kill switch panel, system status + budget usage, anomaly alerts, paginated action log.

### Key Files

| File | Purpose |
|------|---------|
| `lib/observe/config.js` | Singleton config loader (`OBSERVE.json` + defaults) |
| `lib/observe/logger.js` | `logAction()`, `pruneActionLog()` |
| `lib/observe/killswitch.js` | `activateKillSwitch()`, `deactivateKillSwitch()`, `isKilled()`, `initKillSwitch()` |
| `lib/observe/anomaly.js` | `checkAnomalies()`, `startAnomalyTimer()` |
| `lib/db/action-log.js` | Drizzle CRUD for `action_log` table |
| `lib/db/anomaly-alerts.js` | Drizzle CRUD for `anomaly_alerts` table |
