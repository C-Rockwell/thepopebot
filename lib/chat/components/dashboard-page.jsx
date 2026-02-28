'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from './page-layout.js';
import { SpinnerIcon, RefreshIcon } from './icons.js';
import { getDashboardData, toggleKillSwitch } from '../actions.js';
import { KillSwitchPanel } from './dashboard/kill-switch-panel.js';
import { BudgetPanel } from './dashboard/budget-panel.js';
import { SystemStatusPanel } from './dashboard/system-status-panel.js';
import { AnomalyPanel } from './dashboard/anomaly-panel.js';
import { ActionLogPanel } from './dashboard/action-log-panel.js';

export function DashboardPage({ session }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await getDashboardData();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleKillSwitchToggle() {
    const result = await toggleKillSwitch();
    // Refresh all data after toggle
    await fetchData();
    return result;
  }

  return (
    <PageLayout session={session}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Mission Control</h1>
        {!loading && (
          <button
            onClick={() => { setRefreshing(true); fetchData(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            {refreshing ? (
              <>
                <SpinnerIcon size={14} />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshIcon size={14} />
                Refresh
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-border/50" />
          ))}
        </div>
      ) : data?.error ? (
        <div className="text-center py-8 text-muted-foreground">{data.error}</div>
      ) : (
        <div className="space-y-4">
          {/* Kill Switch — full width */}
          <KillSwitchPanel
            killSwitch={data.killSwitch}
            onToggle={handleKillSwitchToggle}
          />

          {/* System Status + Budget Usage — side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SystemStatusPanel
              cronCount={data.cronCount}
              triggerCount={data.triggerCount}
              memoryStats={data.memoryStats}
              actionStats={data.actionStats}
            />
            <BudgetPanel budgets={data.budgets} />
          </div>

          {/* Anomaly Alerts — full width */}
          <AnomalyPanel
            alerts={data.alerts}
            onRefresh={fetchData}
          />

          {/* Action Log — full width */}
          <ActionLogPanel initialEntries={data.recentActions} />
        </div>
      )}
    </PageLayout>
  );
}
