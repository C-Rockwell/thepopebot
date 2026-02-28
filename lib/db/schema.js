import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default('New Chat'),
  starred: integer('starred').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  notification: text('notification').notNull(),
  payload: text('payload').notNull(),
  read: integer('read').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  channelId: text('channel_id').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const memories = sqliteTable('memories', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  summary: text('summary'),
  trustLevel: text('trust_level').notNull().default('user-direct'),
  salienceScore: real('salience_score').notNull().default(1.0),
  sourceType: text('source_type').notNull().default('manual'),
  sourceId: text('source_id'),
  tags: text('tags'),
  embedding: blob('embedding'),
  createdAt: integer('created_at').notNull(),
  lastAccessedAt: integer('last_accessed_at').notNull(),
  decayAt: integer('decay_at'),
});

export const memoryAuditLog = sqliteTable('memory_audit_log', {
  id: text('id').primaryKey(),
  memoryId: text('memory_id').notNull(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  details: text('details'),
  createdAt: integer('created_at').notNull(),
});

export const actionLog = sqliteTable('action_log', {
  id: text('id').primaryKey(),
  actionType: text('action_type').notNull(),
  actionName: text('action_name'),
  source: text('source').notNull(),
  trustLevel: text('trust_level'),
  input: text('input'),
  result: text('result'),
  status: text('status').notNull().default('success'),
  error: text('error'),
  durationMs: integer('duration_ms'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
});

export const anomalyAlerts = sqliteTable('anomaly_alerts', {
  id: text('id').primaryKey(),
  alertType: text('alert_type').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  details: text('details'),
  acknowledged: integer('acknowledged').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});
