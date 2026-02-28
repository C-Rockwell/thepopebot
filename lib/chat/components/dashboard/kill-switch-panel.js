"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { PowerIcon, SpinnerIcon } from "../icons.js";
function KillSwitchPanel({ killSwitch, onToggle }) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const active = killSwitch?.active || false;
  async function handleToggle() {
    if (!active) {
      setShowConfirm(true);
      return;
    }
    setLoading(true);
    await onToggle();
    setLoading(false);
  }
  async function handleConfirm() {
    setShowConfirm(false);
    setLoading(true);
    await onToggle();
    setLoading(false);
  }
  return /* @__PURE__ */ jsxs("div", { className: `rounded-lg border p-4 ${active ? "border-red-500/50 bg-red-500/5" : "border-border bg-background"}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("div", { className: `rounded-full p-2 ${active ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`, children: /* @__PURE__ */ jsx(PowerIcon, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "font-semibold", children: "Kill Switch" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: active ? "All agent actions are paused" : "System is running normally" }),
          active && killSwitch.activatedAt && /* @__PURE__ */ jsxs("p", { className: "text-xs text-red-500 mt-0.5", children: [
            "Activated ",
            new Date(killSwitch.activatedAt).toLocaleString()
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: handleToggle,
          disabled: loading,
          className: `inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"} disabled:opacity-50 disabled:pointer-events-none`,
          children: [
            loading ? /* @__PURE__ */ jsx(SpinnerIcon, { size: 14 }) : /* @__PURE__ */ jsx(PowerIcon, { size: 14 }),
            active ? "Resume" : "Pause All"
          ]
        }
      )
    ] }),
    showConfirm && /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-red-500", children: "Are you sure?" }),
      /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "This will stop all cron jobs, block webhook triggers, and return 503 for API requests." }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleConfirm,
            className: "rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700",
            children: "Confirm \u2014 Pause All"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setShowConfirm(false),
            className: "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent",
            children: "Cancel"
          }
        )
      ] })
    ] })
  ] });
}
export {
  KillSwitchPanel
};
