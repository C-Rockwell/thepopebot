'use client';

const TYPE_LABELS = {
  agent: 'Agent',
  command: 'Command',
  webhook: 'Webhook',
  memory_summarize: 'Memory',
  voice: 'Voice',
};

function getBarColor(pct) {
  if (pct >= 0.9) return 'bg-red-500';
  if (pct >= 0.7) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function BudgetPanel({ budgets }) {
  if (!budgets || Object.keys(budgets).length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <h3 className="font-semibold mb-3">Budget Usage</h3>
        <p className="text-sm text-muted-foreground">No budget data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="font-semibold mb-3">Budget Usage</h3>
      <div className="space-y-3">
        {Object.entries(budgets).map(([type, status]) => {
          const pct = status.limit > 0 ? status.used / status.limit : 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{TYPE_LABELS[type] || type}</span>
                <span className="text-muted-foreground">
                  {status.used}/{status.limit}
                  {status.resetsIn > 0 && (
                    <span className="ml-1 text-xs">({Math.ceil(status.resetsIn / 60)}m)</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(pct)}`}
                  style={{ width: `${Math.min(pct * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
