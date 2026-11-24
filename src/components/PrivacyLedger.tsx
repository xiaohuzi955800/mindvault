/**
 * The Privacy Ledger: a verifiable, per-action record of what happened to
 * the user's content — which processing ran on-device, which ran in the
 * cloud (with approval), and exactly how many characters left the device.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { clearAllData, db } from '../lib/db';
import type { LedgerAction } from '../lib/db';
import { formatDateTime } from '../lib/format';
import { ensureSeeded } from '../lib/seed';
import { SourceBadge } from './SourceBadge';

const ACTION_LABELS: Record<LedgerAction, string> = {
  'on-device-summary': 'On-device summary',
  'on-device-sentiment': 'On-device mood analysis',
  'on-device-photo': 'On-device photo description',
  'cloud-deep-summary': 'Cloud deep summary',
  'cloud-suggestions': 'Cloud writing suggestions',
};

export function PrivacyLedger({ onReset }: { onReset: () => void }) {
  const entries =
    useLiveQuery(() => db.ledger.orderBy('createdAt').reverse().toArray(), []) ??
    [];
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onDeviceCount = entries.filter((e) => e.source === 'ON_DEVICE').length;
  const inCloudCount = entries.filter((e) => e.source === 'IN_CLOUD').length;
  const totalCharsSent = entries.reduce((sum, e) => sum + e.charsSent, 0);

  const exportLedger = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindvault-privacy-ledger.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 4000);
      return;
    }
    setConfirmingReset(false);
    setResetting(true);
    await clearAllData();
    await ensureSeeded();
    setResetting(false);
    onReset();
  };

  return (
    <section aria-label="Privacy ledger" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-700/30 bg-teal-50 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
            On-device actions
          </p>
          <p className="mt-1 text-2xl font-semibold text-teal-900">
            {onDeviceCount}
          </p>
          <p className="text-xs text-teal-800">
            Content never left this browser.
          </p>
        </div>
        <div className="rounded-xl border border-amber-600/30 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
            Cloud actions (approved)
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-900">
            {inCloudCount}
          </p>
          <p className="text-xs text-amber-800">
            {totalCharsSent} characters sent in total — each time with your
            explicit approval.
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Silent uploads
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">0</p>
          <p className="text-xs text-stone-500">
            MindVault never sends content without asking first.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Every AI action, accounted for
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Newest first. This ledger itself never leaves this browser.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportLedger}
              disabled={entries.length === 0}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Export ledger (JSON)
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                confirmingReset
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-stone-300 text-stone-700 hover:bg-stone-100'
              } disabled:opacity-50`}
            >
              {resetting
                ? 'Resetting…'
                : confirmingReset
                  ? 'Click again to reset demo data'
                  : 'Reset demo data'}
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="mt-6 rounded-lg bg-stone-50 p-6 text-center text-sm text-stone-500">
            No AI actions yet. Run a summary or mood analysis and it will be
            recorded here — with proof of where it ran.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2" role="list">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    {ACTION_LABELS[entry.action]}
                    <span className="ml-2 font-normal text-stone-500">
                      · “{entry.noteTitle || 'Untitled entry'}”
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">{entry.detail}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    {formatDateTime(entry.createdAt)}
                    {entry.source === 'IN_CLOUD' &&
                      ` · ${entry.charsSent} characters sent · approved by you`}
                  </p>
                </div>
                <SourceBadge source={entry.source} compact />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
