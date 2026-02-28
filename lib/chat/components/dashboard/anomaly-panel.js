"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ShieldAlertIcon, CheckIcon, SpinnerIcon } from "../icons.js";
import { acknowledgeAnomaly, acknowledgeAllAnomalies } from "../../actions.js";
const SEVERITY_BADGE = {
  info: "bg-blue-500/10 text-blue-500",
  warning: "bg-yellow-500/10 text-yellow-500",
  critical: "bg-red-500/10 text-red-500"
};
const ALERT_TYPE_LABEL = {
  frequency_spike: "Frequency Spike",
  unusual_hour: "Off-Hours Activity",
  budget_warning: "Budget Warning",
  repeated_error: "Repeated Errors"
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
function AnomalyPanel({ alerts: initialAlerts, onRefresh }) {
  const [alerts, setAlerts] = useState(initialAlerts || []);
  const [loading, setLoading] = useState(false);
  async function handleAcknowledge(id) {
    await acknowledgeAnomaly(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }
  async function handleAcknowledgeAll() {
    setLoading(true);
    await acknowledgeAllAnomalies();
    setAlerts([]);
    setLoading(false);
  }
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(ShieldAlertIcon, { size: 16 }),
        /* @__PURE__ */ jsx("h3", { className: "font-semibold", children: "Anomaly Alerts" }),
        alerts.length > 0 && /* @__PURE__ */ jsx("span", { className: "inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white", children: alerts.length })
      ] }),
      alerts.length > 1 && /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleAcknowledgeAll,
          disabled: loading,
          className: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border text-muted-foreground hover:bg-accent disabled:opacity-50",
          children: [
            loading ? /* @__PURE__ */ jsx(SpinnerIcon, { size: 12 }) : /* @__PURE__ */ jsx(CheckIcon, { size: 12 }),
            "Acknowledge All"
          ]
        }
      )
    ] }),
    alerts.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground py-2 text-center", children: "No active alerts" }) : /* @__PURE__ */ jsx("div", { className: "space-y-2", children: alerts.map((alert) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "flex items-start gap-3 rounded-md border border-border p-3",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
              /* @__PURE__ */ jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_BADGE[alert.severity] || "bg-muted text-muted-foreground"}`, children: alert.severity }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: ALERT_TYPE_LABEL[alert.alertType] || alert.alertType }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: timeAgo(alert.createdAt) })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-sm", children: alert.message })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => handleAcknowledge(alert.id),
              className: "shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
              title: "Acknowledge",
              children: /* @__PURE__ */ jsx(CheckIcon, { size: 12 })
            }
          )
        ]
      },
      alert.id
    )) })
  ] });
}
export {
  AnomalyPanel
};
