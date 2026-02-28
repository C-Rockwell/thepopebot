'use client';

import { ClockIcon, ZapIcon, ActivityIcon } from '../icons.js';

function StatusCard({ icon, label, value, sublabel }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-0.5">{sublabel}</div>}
    </div>
  );
}

export function SystemStatusPanel({ cronCount, triggerCount, memoryStats, actionStats }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="font-semibold mb-3">System Status</h3>
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon={<ClockIcon size={14} />}
          label="Crons"
          value={cronCount ?? 0}
          sublabel="Active schedules"
        />
        <StatusCard
          icon={<ZapIcon size={14} />}
          label="Triggers"
          value={triggerCount ?? 0}
          sublabel="Active watchers"
        />
        <StatusCard
          icon={<ActivityIcon size={14} />}
          label="Actions (1h)"
          value={actionStats?.total ?? 0}
          sublabel={actionStats?.byStatus?.error ? `${actionStats.byStatus.error} errors` : 'No errors'}
        />
        <StatusCard
          icon={<ActivityIcon size={14} />}
          label="Memories"
          value={memoryStats?.total ?? 0}
          sublabel={memoryStats?.avgSalience ? `Avg salience: ${memoryStats.avgSalience}` : null}
        />
      </div>
    </div>
  );
}
