'use client';

import { useState, useCallback } from 'react';
import { SpinnerIcon, ChevronDownIcon } from '../icons.js';
import { getActionLog } from '../../actions.js';

const TYPE_BADGE = {
  agent: 'bg-purple-500/10 text-purple-500',
  command: 'bg-blue-500/10 text-blue-500',
  webhook: 'bg-orange-500/10 text-orange-500',
  voice: 'bg-cyan-500/10 text-cyan-500',
};

const STATUS_BADGE = {
  success: 'bg-green-500/10 text-green-500',
  error: 'bg-red-500/10 text-red-500',
  blocked: 'bg-yellow-500/10 text-yellow-500',
};

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActionRow({ entry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2.5 px-2 -mx-2 text-left hover:bg-accent/50 rounded transition-colors"
      >
        {/* Type badge */}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${TYPE_BADGE[entry.actionType] || 'bg-muted text-muted-foreground'}`}>
          {entry.actionType}
        </span>

        {/* Name */}
        <span className="text-sm font-medium truncate flex-1">
          {entry.actionName || entry.source}
        </span>

        {/* Status */}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${STATUS_BADGE[entry.status] || 'bg-muted text-muted-foreground'}`}>
          {entry.status}
        </span>

        {/* Duration */}
        {entry.durationMs != null && (
          <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
            {entry.durationMs < 1000 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Time */}
        <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
          {timeAgo(entry.createdAt)}
        </span>

        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-2 pb-3 text-xs space-y-1">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16 shrink-0">Source:</span>
            <span>{entry.source}</span>
          </div>
          {entry.result && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Result:</span>
              <span className="break-all">{entry.result}</span>
            </div>
          )}
          {entry.error && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Error:</span>
              <span className="text-red-500 break-all">{entry.error}</span>
            </div>
          )}
          {entry.trustLevel && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Trust:</span>
              <span>{entry.trustLevel}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16 shrink-0">Time:</span>
            <span>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActionLogPanel({ initialEntries }) {
  const [entries, setEntries] = useState(initialEntries || []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTrust, setFilterTrust] = useState('');

  const fetchPage = useCallback(async (p, type, status, trust) => {
    setLoading(true);
    try {
      const filters = {};
      if (type) filters.actionType = type;
      if (status) filters.status = status;
      if (trust) filters.trustLevel = trust;
      const data = await getActionLog(p, filters);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setPage(p);
    } catch (err) {
      console.error('Failed to fetch action log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleFilter(type, status, trust) {
    setFilterType(type);
    setFilterStatus(status);
    setFilterTrust(trust);
    fetchPage(1, type, status, trust);
  }

  const pageSize = 20;
  const totalPages = total != null ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Action Log</h3>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => handleFilter(e.target.value, filterStatus, filterTrust)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">All types</option>
            <option value="agent">Agent</option>
            <option value="command">Command</option>
            <option value="webhook">Webhook</option>
            <option value="voice">Voice</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => handleFilter(filterType, e.target.value, filterTrust)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="blocked">Blocked</option>
          </select>
          <select
            value={filterTrust}
            onChange={(e) => handleFilter(filterType, filterStatus, e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="">All trust levels</option>
            <option value="user-direct">user-direct</option>
            <option value="user-indirect">user-indirect</option>
            <option value="external-untrusted">external-untrusted</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <SpinnerIcon size={20} />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No actions logged yet.</p>
      ) : (
        <>
          <div className="divide-y-0">
            {entries.map((entry) => (
              <ActionRow key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Pagination */}
          {total != null && total > pageSize && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <button
                onClick={() => fetchPage(page - 1, filterType, filterStatus, filterTrust)}
                disabled={page <= 1 || loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchPage(page + 1, filterType, filterStatus, filterTrust)}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
