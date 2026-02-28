"use client";
import { jsx, jsxs } from "react/jsx-runtime";
const TYPE_LABELS = {
  agent: "Agent",
  command: "Command",
  webhook: "Webhook",
  memory_summarize: "Memory",
  voice: "Voice"
};
function getBarColor(pct) {
  if (pct >= 0.9) return "bg-red-500";
  if (pct >= 0.7) return "bg-yellow-500";
  return "bg-green-500";
}
function BudgetPanel({ budgets }) {
  if (!budgets || Object.keys(budgets).length === 0) {
    return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-semibold mb-3", children: "Budget Usage" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "No budget data available" })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsx("h3", { className: "font-semibold mb-3", children: "Budget Usage" }),
    /* @__PURE__ */ jsx("div", { className: "space-y-3", children: Object.entries(budgets).map(([type, status]) => {
      const pct = status.limit > 0 ? status.used / status.limit : 0;
      return /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-sm mb-1", children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: TYPE_LABELS[type] || type }),
          /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground", children: [
            status.used,
            "/",
            status.limit,
            status.resetsIn > 0 && /* @__PURE__ */ jsxs("span", { className: "ml-1 text-xs", children: [
              "(",
              Math.ceil(status.resetsIn / 60),
              "m)"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "h-2 rounded-full bg-muted overflow-hidden", children: /* @__PURE__ */ jsx(
          "div",
          {
            className: `h-full rounded-full transition-all ${getBarColor(pct)}`,
            style: { width: `${Math.min(pct * 100, 100)}%` }
          }
        ) })
      ] }, type);
    }) })
  ] });
}
export {
  BudgetPanel
};
