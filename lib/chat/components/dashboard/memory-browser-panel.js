"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useCallback } from "react";
import { SpinnerIcon, ChevronDownIcon, TrashIcon, SearchIcon } from "../icons.js";
import { getMemoryBrowser, deleteMemoryEntry } from "../../actions.js";
const SOURCE_BADGE = {
  conversation: "bg-blue-500/10 text-blue-500",
  job: "bg-purple-500/10 text-purple-500",
  manual: "bg-green-500/10 text-green-500"
};
function timeAgo(timestamp) {
  if (!timestamp) return "\u2014";
  const seconds = Math.floor((Date.now() - timestamp) / 1e3);
  if (seconds < 60) return "just now";
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
  return /* @__PURE__ */ jsxs("div", { className: "border-b border-border last:border-0", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 py-2.5 px-2 -mx-2", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setExpanded(!expanded),
          className: "flex-1 flex items-start gap-3 text-left hover:bg-accent/50 rounded transition-colors min-w-0",
          children: [
            /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 mt-0.5 ${SOURCE_BADGE[entry.sourceType] || "bg-muted text-muted-foreground"}`, children: entry.sourceType || "unknown" }),
            /* @__PURE__ */ jsx("span", { className: "text-sm truncate flex-1", children: entry.summary || entry.content }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0", children: typeof entry.salienceScore === "number" ? entry.salienceScore.toFixed(2) : "\u2014" }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0 w-16 text-right", children: timeAgo(entry.createdAt) }),
            /* @__PURE__ */ jsx(
              ChevronDownIcon,
              {
                size: 14,
                className: `shrink-0 text-muted-foreground transition-transform mt-0.5 ${expanded ? "rotate-180" : ""}`
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "shrink-0 flex items-center gap-1", children: confirmDelete ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleDelete,
            disabled: deleting,
            className: "rounded px-1.5 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50",
            children: deleting ? "..." : "Confirm"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setConfirmDelete(false),
            className: "rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent",
            children: "Cancel"
          }
        )
      ] }) : /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setConfirmDelete(true),
          className: "rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors",
          title: "Delete memory",
          children: /* @__PURE__ */ jsx(TrashIcon, { size: 12 })
        }
      ) })
    ] }),
    expanded && /* @__PURE__ */ jsxs("div", { className: "px-2 pb-3 text-xs space-y-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Content:" }),
        /* @__PURE__ */ jsx("span", { className: "break-words", children: entry.content })
      ] }),
      entry.summary && entry.summary !== entry.content && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Summary:" }),
        /* @__PURE__ */ jsx("span", { className: "break-words", children: entry.summary })
      ] }),
      entry.sourceId && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Source ID:" }),
        /* @__PURE__ */ jsx("span", { className: "font-mono break-all", children: entry.sourceId })
      ] }),
      entry.trustLevel && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Trust:" }),
        /* @__PURE__ */ jsx("span", { children: entry.trustLevel })
      ] }),
      entry.tags && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Tags:" }),
        /* @__PURE__ */ jsx("span", { className: "font-mono break-all", children: typeof entry.tags === "object" ? JSON.stringify(entry.tags) : entry.tags })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "Last access:" }),
        /* @__PURE__ */ jsx("span", { children: timeAgo(entry.lastAccessedAt) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-20 shrink-0", children: "ID:" }),
        /* @__PURE__ */ jsx("span", { className: "font-mono text-[10px] break-all", children: entry.id })
      ] })
    ] })
  ] });
}
function MemoryBrowserPanel({ memoryStats }) {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("");
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
      console.error("Failed to fetch memories:", err);
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
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotal((prev) => prev != null ? prev - 1 : prev);
    }
  }
  const pageSize = 20;
  const totalPages = total != null ? Math.ceil(total / pageSize) : 1;
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between mb-3", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h3", { className: "font-semibold", children: "Memory Browser" }),
      memoryStats && /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [
        memoryStats.total,
        " ",
        memoryStats.total === 1 ? "entry" : "entries",
        " \xB7 avg salience ",
        memoryStats.avgSalience ?? "\u2014"
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSearch, className: "flex gap-2 mb-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative flex-1", children: [
        /* @__PURE__ */ jsx(SearchIcon, { size: 12, className: "absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: "Search memories\u2026",
            className: "w-full rounded-md border border-border bg-background pl-6 pr-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: filterSource,
          onChange: (e) => {
            setFilterSource(e.target.value);
            if (loaded && !searchQuery.trim()) fetchPage(1, "", e.target.value);
          },
          className: "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All sources" }),
            /* @__PURE__ */ jsx("option", { value: "conversation", children: "Conversation" }),
            /* @__PURE__ */ jsx("option", { value: "job", children: "Job" }),
            /* @__PURE__ */ jsx("option", { value: "manual", children: "Manual" })
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "submit",
          disabled: loading,
          className: "rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50",
          children: "Search"
        }
      )
    ] }),
    !loaded && !loading && /* @__PURE__ */ jsx("div", { className: "text-center py-6", children: /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => fetchPage(1, "", filterSource),
        className: "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        children: "Load memories"
      }
    ) }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx(SpinnerIcon, { size: 20 }) }) : loaded && entries.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-4 text-center", children: "No memories found." }) : loaded ? /* @__PURE__ */ jsxs(Fragment, { children: [
      isSearchResult && /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground mb-2", children: [
        total,
        " result",
        total !== 1 ? "s" : ""
      ] }),
      /* @__PURE__ */ jsx("div", { className: "divide-y-0", children: entries.map((entry) => /* @__PURE__ */ jsx(MemoryRow, { entry, onDelete: handleDelete }, entry.id)) }),
      !isSearchResult && total != null && total > pageSize && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-3 pt-3 border-t border-border", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => fetchPage(page - 1, "", filterSource),
            disabled: page <= 1 || loading,
            className: "rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none",
            children: "Previous"
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
          "Page ",
          page,
          " of ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => fetchPage(page + 1, "", filterSource),
            disabled: page >= totalPages || loading,
            className: "rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none",
            children: "Next"
          }
        )
      ] })
    ] }) : null
  ] });
}
export {
  MemoryBrowserPanel
};
