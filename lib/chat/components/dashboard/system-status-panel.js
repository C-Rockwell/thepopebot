"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { ClockIcon, ZapIcon, ActivityIcon } from "../icons.js";
function StatusCard({ icon, label, value, sublabel }) {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-muted-foreground mb-1", children: [
      icon,
      /* @__PURE__ */ jsx("span", { className: "text-xs font-medium uppercase tracking-wider", children: label })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "text-2xl font-semibold", children: value }),
    sublabel && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground mt-0.5", children: sublabel })
  ] });
}
function SystemStatusPanel({ cronCount, triggerCount, memoryStats, actionStats }) {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-border bg-background p-4", children: [
    /* @__PURE__ */ jsx("h3", { className: "font-semibold mb-3", children: "System Status" }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsx(
        StatusCard,
        {
          icon: /* @__PURE__ */ jsx(ClockIcon, { size: 14 }),
          label: "Crons",
          value: cronCount ?? 0,
          sublabel: "Active schedules"
        }
      ),
      /* @__PURE__ */ jsx(
        StatusCard,
        {
          icon: /* @__PURE__ */ jsx(ZapIcon, { size: 14 }),
          label: "Triggers",
          value: triggerCount ?? 0,
          sublabel: "Active watchers"
        }
      ),
      /* @__PURE__ */ jsx(
        StatusCard,
        {
          icon: /* @__PURE__ */ jsx(ActivityIcon, { size: 14 }),
          label: "Actions (1h)",
          value: actionStats?.total ?? 0,
          sublabel: actionStats?.byStatus?.error ? `${actionStats.byStatus.error} errors` : "No errors"
        }
      ),
      /* @__PURE__ */ jsx(
        StatusCard,
        {
          icon: /* @__PURE__ */ jsx(ActivityIcon, { size: 14 }),
          label: "Memories",
          value: memoryStats?.total ?? 0,
          sublabel: memoryStats?.avgSalience ? `Avg salience: ${memoryStats.avgSalience}` : null
        }
      )
    ] })
  ] });
}
export {
  SystemStatusPanel
};
