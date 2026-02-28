'use client';

import { useState, useCallback } from 'react';
import { SpinnerIcon, ChevronDownIcon, TrashIcon, SearchIcon } from '../icons.js';
import { getMemoryBrowser, deleteMemoryEntry } from '../../actions.js';

const SOURCE_BADGE = {
  conversation: 'bg-blue-500/10 text-blue-500',
  job: 'bg-purple-500/10 text-purple-500',
  manual: 'bg-green-500/10 text-green-500',
};

function timeAgo(timestamp) {
  if (!timestamp) return '—';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function MemoryRow({ entry, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-start gap-3 py-2.5 px-2 -mx-2">
        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-start gap-3 text-left hover:bg-accent/50 rounded transition-colors min-w-0"
        >
          {/* Source badge */}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 mt-0.5 ${SOURCE_BADGE[entry.sourceType] || 'bg-muted text-muted-foreground'}`}>
            {entry.sourceType || 'unknown'}
          </span>

          {/* Content preview */}
          <span className="text-sm truncate flex-1">
            {entry.summary || entry.content}
          </span>

          {/* Salience */}
          <span className="text-xs text-muted-foreground shrink-0">
            {typeof entry.salienceScore === 'number' ? entry.salienceScore.toFixed(2) : '—'}
          </span>

          {/* Time */}
          <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
            {timeAgo(entry.createdAt)}
          </span>

          <ChevronDownIcon
            size={14}
            className={`shrink-0 text-muted-foreground transition-transform mt-0.5 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Delete */}
        <div className="shrink-0 flex items-center gap-1">
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? '...' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete memory"
            >
              <TrashIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-2 pb-3 text-xs space-y-1">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">Content:</span>
            <span className="break-words">{entry.content}</span>
          </div>
          {entry.summary && entry.summary !== entry.content && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Summary:</span>
              <span className="break-words">{entry.summary}</span>
            </div>
          )}
          {entry.sourceId && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Source ID:</span>
              <span className="font-mono break-all">{entry.sourceId}</span>
            </div>
          )}
          {entry.trustLevel && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Trust:</span>
              <span>{entry.trustLevel}</span>
            </div>
          )}
          {entry.tags && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Tags:</span>
              <span className="font-mono break-all">{typeof entry.tags === 'object' ? JSON.stringify(entry.tags) : entry.tags}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">Last access:</span>
            <span>{timeAgo(entry.lastAccessedAt)}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">ID:</span>
            <span className="font-mono text-[10px] break-all">{entry.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemoryBrowserPanel({ memoryStats }) {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [isSearchResult, setIsSearchResult] = useState(false);

  const fetchPage = useCallback(async (p, query, source) => {
    setLoading(true);
    try {
      const filters = {};
      if (query?.trim()) filters.query = query.trim();
      if (source) filters.sourceType = source;
      const data = await getMemoryBrowser(p, filters);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setPage(p);
      setIsSearchResult(!!query?.trim());
      setLoaded(true);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchPage(1, searchQuery, filterSource);
  }

  async function handleDelete(id) {
    const result = await deleteMemoryEntry(id);
    if (result.success) {
      setEntries(prev => prev.filter(e => e.id !== id));
      setTotal(prev => (prev != null ? prev - 1 : prev));
    }
  }

  const pageSize = 20;
  const totalPages = total != null ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Memory Browser</h3>
          {memoryStats && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {memoryStats.total} {memoryStats.total === 1 ? 'entry' : 'entries'} · avg salience {memoryStats.avgSalience ?? '—'}
            </p>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <SearchIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories…"
            className="w-full rounded-md border border-border bg-background pl-6 pr-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); if (loaded && !searchQuery.trim()) fetchPage(1, '', e.target.value); }}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        >
          <option value="">All sources</option>
          <option value="conversation">Conversation</option>
          <option value="job">Job</option>
          <option value="manual">Manual</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {/* Lazy load state */}
      {!loaded && !loading && (
        <div className="text-center py-6">
          <button
            onClick={() => fetchPage(1, '', filterSource)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Load memories
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <SpinnerIcon size={20} />
        </div>
      ) : loaded && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No memories found.</p>
      ) : loaded ? (
        <>
          {isSearchResult && (
            <p className="text-xs text-muted-foreground mb-2">{total} result{total !== 1 ? 's' : ''}</p>
          )}
          <div className="divide-y-0">
            {entries.map((entry) => (
              <MemoryRow key={entry.id} entry={entry} onDelete={handleDelete} />
            ))}
          </div>

          {/* Pagination — hidden during search results */}
          {!isSearchResult && total != null && total > pageSize && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <button
                onClick={() => fetchPage(page - 1, '', filterSource)}
                disabled={page <= 1 || loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchPage(page + 1, '', filterSource)}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
