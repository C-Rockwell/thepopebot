"use client";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useCallback } from "react";
import { SpinnerIcon, ChevronDownIcon } from "../icons.js";
import { getActionLog } from "../../actions.js";
const TYPE_BADGE = {
  agent: "bg-purple-500/10 text-purple-500",
  command: "bg-blue-500/10 text-blue-500",
  webhook: "bg-orange-500/10 text-orange-500",
  voice: "bg-cyan-500/10 text-cyan-500"
};
const STATUS_BADGE = {
  success: "bg-green-500/10 text-green-500",
  error: "bg-red-500/10 text-red-500",
  blocked: "bg-yellow-500/10 text-yellow-500"
};
function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1e3);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function ActionRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return /* @__PURE__ */ jsxs("div", { className: "border-b border-border last:border-0", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setExpanded(!expanded),
        className: "w-full flex items-center gap-3 py-2.5 px-2 -mx-2 text-left hover:bg-accent/50 rounded transition-colors",
        children: [
          /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${TYPE_BADGE[entry.actionType] || "bg-muted text-muted-foreground"}`, children: entry.actionType }),
          /* @__PURE__ */ jsx("span", { className: "text-sm font-medium truncate flex-1", children: entry.actionName || entry.source }),
          /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${STATUS_BADGE[entry.status] || "bg-muted text-muted-foreground"}`, children: entry.status }),
          entry.durationMs != null && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0 w-14 text-right", children: entry.durationMs < 1e3 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1e3).toFixed(1)}s` }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground shrink-0 w-16 text-right", children: timeAgo(entry.createdAt) }),
          /* @__PURE__ */ jsx(
            ChevronDownIcon,
            {
              size: 14,
              className: `shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`
            }
          )
        ]
      }
    ),
    expanded && /* @__PURE__ */ jsxs("div", { className: "px-2 pb-3 text-xs space-y-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-16 shrink-0", children: "Source:" }),
        /* @__PURE__ */ jsx("span", { children: entry.source })
      ] }),
      entry.result && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-16 shrink-0", children: "Result:" }),
        /* @__PURE__ */ jsx("span", { className: "break-all", children: entry.result })
      ] }),
      entry.error && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-16 shrink-0", children: "Error:" }),
        /* @__PURE__ */ jsx("span", { className: "text-red-500 break-all", children: entry.error })
      ] }),
      entry.trustLevel && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-16 shrink-0", children: "Trust:" }),
        /* @__PURE__ */ jsx("span", { children: entry.trustLevel })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground w-16 shrink-0", children: "Time:" }),
        /* @__PURE__ */ jsx("span", { children: new Date(entry.createdAt).toLocaleString() })
      ] })
    ] })
  ] });
}
function ActionLogPanel({ initialEntries }) {
  const [entries, setEntries] = useState(initialEntries || []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTrust, setFilterTrust] = useState("");
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
      console.error("Failed to fetch action log:", err);
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
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-semibold", children: "Action Log" }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filterType,
            onChange: (e) => handleFilter(e.target.value, filterStatus, filterTrust),
            className: "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All types" }),
              /* @__PURE__ */ jsx("option", { value: "agent", children: "Agent" }),
              /* @__PURE__ */ jsx("option", { value: "command", children: "Command" }),
              /* @__PURE__ */ jsx("option", { value: "webhook", children: "Webhook" }),
              /* @__PURE__ */ jsx("option", { value: "voice", children: "Voice" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filterStatus,
            onChange: (e) => handleFilter(filterType, e.target.value, filterTrust),
            className: "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All statuses" }),
              /* @__PURE__ */ jsx("option", { value: "success", children: "Success" }),
              /* @__PURE__ */ jsx("option", { value: "error", children: "Error" }),
              /* @__PURE__ */ jsx("option", { value: "blocked", children: "Blocked" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filterTrust,
            onChange: (e) => handleFilter(filterType, filterStatus, e.target.value),
            className: "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All trust levels" }),
              /* @__PURE__ */ jsx("option", { value: "user-direct", children: "user-direct" }),
              /* @__PURE__ */ jsx("option", { value: "user-indirect", children: "user-indirect" }),
              /* @__PURE__ */ jsx("option", { value: "external-untrusted", children: "external-untrusted" })
            ]
          }
        )
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-8", children: /* @__PURE__ */ jsx(SpinnerIcon, { size: 20 }) }) : entries.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-4 text-center", children: "No actions logged yet." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "divide-y-0", children: entries.map((entry) => /* @__PURE__ */ jsx(ActionRow, { entry }, entry.id)) }),
      total != null && total > pageSize && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-3 pt-3 border-t border-border", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => fetchPage(page - 1, filterType, filterStatus, filterTrust),
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
            onClick: () => fetchPage(page + 1, filterType, filterStatus, filterTrust),
            disabled: page >= totalPages || loading,
            className: "rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none",
            children: "Next"
          }
        )
      ] })
    ] })
  ] });
}
export {
  ActionLogPanel
};
