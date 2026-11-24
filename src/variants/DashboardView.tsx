/**
 * DashboardView — the mood-first dashboard: the mood chart + clickable
 * calendar heatmap as the hero, with recent insight cards below.
 *
 * Shared by V2 (mood-first dashboard, its home view) and V6 (the merged
 * submission version, its Dashboard tab). The layout is the V2 dashboard;
 * the variants differ in where an opened entry goes (V2 opens a focused
 * overlay, V6 switches to the Notes tab) — that is the caller's choice
 * via `onOpenEntry`.
 */
import { useMemo } from 'react';
import { MoodTimeline } from '../components/MoodTimeline';
import { SourceBadge } from '../components/SourceBadge';
import type { Vault } from '../hooks/useVault';
import { formatDate } from '../lib/format';
import { moodDotClass } from '../lib/mood';

export function DashboardView({
  vault,
  onOpenEntry,
}: {
  vault: Vault;
  /** Open one entry (selects it first; the caller decides the view). */
  onOpenEntry: (id: number) => void;
}) {
  // Recent entries that already have on-device insights — the dashboard's
  // "recent insights" strip.
  const insightCards = useMemo(
    () =>
      vault.notes
        .filter((note) => note.analysis.summary || note.analysis.sentiment)
        .slice(0, 3),
    [vault.notes],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-stone-900">
          How have your days felt?
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Your mood timeline, built entirely on this device from your
          diary — nothing here was ever sent to a cloud. Click any
          highlighted day to open that entry.
        </p>
      </div>

      <MoodTimeline
        notes={vault.notes}
        onDayClick={(id) => void onOpenEntry(id)}
      />

      <section aria-label="Recent insights">
        <h3 className="text-sm font-semibold text-stone-900">
          Recent insights
        </h3>
        {insightCards.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            No insights yet — open an entry and run a summary or mood
            analysis on-device.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {insightCards.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => note.id !== undefined && void onOpenEntry(note.id)}
                className="rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-teal-700/40 hover:shadow-md"
              >
                <span className="flex items-center gap-2">
                  {note.analysis.sentiment && (
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${moodDotClass(note.analysis.sentiment.score)}`}
                    />
                  )}
                  <span className="truncate text-sm font-semibold text-stone-900">
                    {note.title.trim() || 'Untitled entry'}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {formatDate(note.createdAt)}
                </span>
                {note.analysis.sentiment && (
                  <span className="mt-2 block text-sm text-stone-800">
                    {note.analysis.sentiment.label} (
                    {note.analysis.sentiment.score})
                  </span>
                )}
                {note.analysis.summary && (
                  <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-stone-600">
                    {note.analysis.summary.text}
                  </span>
                )}
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {note.analysis.summary && (
                    <SourceBadge source={note.analysis.summary.source} compact />
                  )}
                  {note.analysis.deepSummary && (
                    <SourceBadge source={note.analysis.deepSummary.source} compact />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
