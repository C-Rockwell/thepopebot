'use client';

import { useState } from 'react';
import { PowerIcon, SpinnerIcon } from '../icons.js';

export function KillSwitchPanel({ killSwitch, onToggle }) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const active = killSwitch?.active || false;

  async function handleToggle() {
    if (!active) {
      // Require confirmation to activate
      setShowConfirm(true);
      return;
    }
    // Deactivate immediately
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

  return (
    <div className={`rounded-lg border p-4 ${active ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-background'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${active ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
            <PowerIcon size={20} />
          </div>
          <div>
            <h3 className="font-semibold">Kill Switch</h3>
            <p className="text-sm text-muted-foreground">
              {active ? 'All agent actions are paused' : 'System is running normally'}
            </p>
            {active && killSwitch.activatedAt && (
              <p className="text-xs text-red-500 mt-0.5">
                Activated {new Date(killSwitch.activatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            active
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          } disabled:opacity-50 disabled:pointer-events-none`}
        >
          {loading ? (
            <SpinnerIcon size={14} />
          ) : (
            <PowerIcon size={14} />
          )}
          {active ? 'Resume' : 'Pause All'}
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm font-medium text-red-500">Are you sure?</p>
          <p className="text-xs text-muted-foreground mt-1">
            This will stop all cron jobs, block webhook triggers, and return 503 for API requests.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleConfirm}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Confirm — Pause All
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
