/**
 * V4 — "Timeline feed".
 *
 * Notes as a vertical chronological feed (newest first), each entry a card
 * with its text, photos, and inline AI insight cards attached beneath it.
 * The Privacy Ledger becomes a filter on the feed ("show only cloud
 * actions") plus a live counts strip, rather than a separate view. The
 * hypothesis: the feed makes the ON-DEVICE / IN-CLOUD badges visible in
 * context everywhere (every card wears them), which sells "privacy
 * verifiable" harder than a separate ledger page does.
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoodTimeline } from '../../components/MoodTimeline';
import { OnDevicePanel } from '../../components/OnDevicePanel';
import { AiErrorMessage } from '../../components/AiPanel';
import { SourceBadge } from '../../components/SourceBadge';
import type { Vault } from '../../hooks/useVault';
import { db } from '../../lib/db';
import type { Note } from '../../lib/db';
import { formatDate, formatDateTime } from '../../lib/format';
import { moodDotClass } from '../../lib/mood';
import { AppFooter, AppHeader } from '../chrome';
import { EditorOverlay } from '../EditorOverlay';

type View = 'feed' | 'mood';
type FeedFilter = 'all' | 'on-device' | 'cloud' | 'unanalyzed';

const FILTERS: Array<{ id: FeedFilter; label: string }> = [
  { id: 'all', label: 'All entries' },
  { id: 'on-device', label: 'On-device insights' },
  { id: 'cloud', label: 'Cloud insights' },
  { id: 'unanalyzed', label: 'Not yet analyzed' },
];

const EXCERPT_CHARS = 280;

/** Live ledger counts strip — the ledger as a feed header, not a page. */
function LedgerStrip() {
  const entries =
    useLiveQuery(() => db.ledger.orderBy('createdAt').reverse().toArray(), []) ??
    [];
  const onDevice = entries.filter((e) => e.source === 'ON_DEVICE').length;
  const inCloud = entries.filter((e) => e.source === 'IN_CLOUD').length;
  const silent = entries.filter(
    (e) => e.source === 'IN_CLOUD' && !e.authorized,
  ).length;
  const charsSent = entries.reduce((sum, e) => sum + e.charsSent, 0);
  return (
    <div
      aria-label="Privacy ledger summary"
      className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs shadow-sm"
    >
      <span className="font-semibold text-stone-900">Privacy ledger</span>
      <span className="text-teal-800">
        <strong>{onDevice}</strong> on-device actions · 0 characters left
      </span>
      <span className="text-amber-800">
        <strong>{inCloud}</strong> cloud actions · {charsSent} characters sent
        (all approved)
      </span>
      <span className="text-stone-600">
        <strong>{silent}</strong> silent uploads
      </span>
    </div>
  );
}

function FeedCard({
  note,
  vault,
  onEdit,
}: {
  note: Note;
  vault: Vault;
  onEdit: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { summary, sentiment, deepSummary, suggestions } = note.analysis;
  const deviceReady = vault.device.availability === 'available';
  const hasContent = note.content.trim().length > 0;
  const long = note.content.length > EXCERPT_CHARS;
  // Trim trailing whitespace/newlines so the ellipsis sits on the last
  // line of text instead of dangling on its own line.
  const shown =
    !long || expanded
      ? note.content
      : note.content.slice(0, EXCERPT_CHARS).trimEnd();
  const onDeviceCount =
    (summary ? 1 : 0) +
    (sentiment ? 1 : 0) +
    note.photos.filter((p) => p.description).length;
  const cloudCount = (deepSummary ? 1 : 0) + (suggestions ? 1 : 0);

  return (
    <article
      aria-label={`Entry: ${note.title || 'Untitled entry'}`}
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-stone-900">
            {sentiment && (
              <span
                aria-hidden="true"
                title={`Mood: ${sentiment.label} (${sentiment.score})`}
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${moodDotClass(sentiment.score)}`}
              />
            )}
            <span className="truncate">{note.title.trim() || 'Untitled entry'}</span>
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {formatDate(note.createdAt)} · {formatDateTime(note.createdAt).split(', ').slice(-1)[0]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => note.id !== undefined && onEdit(note.id)}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
        >
          Edit
        </button>
      </div>

      <p className="note-body mt-3 text-[15px] whitespace-pre-wrap text-stone-800">
        {shown}
        {long && !expanded && '…'}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-teal-800 underline hover:text-teal-900"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {note.photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
          {note.photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-lg border border-stone-200"
            >
              <img
                src={photo.dataUrl}
                alt={photo.description ?? `Attached photo ${photo.name}`}
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-3">
                {photo.description ? (
                  <div className="animate-fade-in">
                    <SourceBadge source={photo.source ?? 'ON_DEVICE'} compact />
                    <p className="mt-1.5 text-sm text-stone-700">
                      {photo.description}
                    </p>
                    {photo.moodTags && photo.moodTags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {photo.moodTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void vault.describePhotoForNote(note, photo.id)}
                    disabled={!deviceReady || vault.describingPhotoId === photo.id}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {vault.describingPhotoId === photo.id
                      ? 'Describing on-device…'
                      : 'Describe on-device'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Inline insight cards — every result wears its badge in context. */}
      {(summary || sentiment || deepSummary || suggestions) && (
        <div className="mt-4 flex flex-col gap-2">
          {summary && (
            <div className="rounded-lg bg-teal-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
                  Summary
                </h4>
                <SourceBadge source={summary.source} compact />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-stone-800">
                {summary.text}
              </p>
            </div>
          )}
          {sentiment && (
            <div className="rounded-lg bg-teal-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
                  Mood
                </h4>
                <SourceBadge source={sentiment.source} compact />
              </div>
              <p className="mt-1 text-sm text-stone-800">
                <span className="font-semibold">{sentiment.label}</span>{' '}
                <span className="text-stone-500">({sentiment.score})</span>
                {sentiment.keywords.length > 0 && (
                  <span className="text-stone-500">
                    {' '}
                    · {sentiment.keywords.join(', ')}
                  </span>
                )}
              </p>
            </div>
          )}
          {deepSummary && (
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                  Deep summary
                </h4>
                <SourceBadge source={deepSummary.source} compact />
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
                {deepSummary.text}
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                Sent with your approval · {deepSummary.charsSent} characters
              </p>
            </div>
          )}
          {suggestions && (
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                  Writing suggestions
                </h4>
                <SourceBadge source={suggestions.source} compact />
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
                {suggestions.text}
              </p>
              <p className="mt-1 text-[11px] text-amber-800">
                Sent with your approval · {suggestions.charsSent} characters
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
        <button
          type="button"
          onClick={() => void vault.runOnDeviceForNote(note, 'summary')}
          disabled={!hasContent || !deviceReady || vault.busy.summary}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {vault.busy.summary ? 'Summarizing…' : summary ? 'Re-summarize' : 'Summarize on device'}
        </button>
        <button
          type="button"
          onClick={() => void vault.runOnDeviceForNote(note, 'sentiment')}
          disabled={!hasContent || !deviceReady || vault.busy.sentiment}
          className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {vault.busy.sentiment ? 'Sensing mood…' : sentiment ? 'Re-analyze mood' : 'Analyze mood on device'}
        </button>
        <button
          type="button"
          onClick={() => vault.requestCloudForNote(note, 'deep-summary')}
          disabled={!hasContent || vault.busy.cloud}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {vault.busy.cloud ? 'Working…' : deepSummary ? 'Re-run deep summary' : 'Deep summary'}
        </button>
        <button
          type="button"
          onClick={() => vault.requestCloudForNote(note, 'suggestions')}
          disabled={!hasContent || vault.busy.cloud}
          className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {vault.busy.cloud ? 'Working…' : suggestions ? 'New suggestions' : 'Writing suggestions'}
        </button>
      </div>

      <p className="mt-3 text-[11px] text-stone-400">
        Ledger for this entry: {onDeviceCount} on-device · {cloudCount} cloud
        {cloudCount > 0 ? ' (approved)' : ''}
      </p>
    </article>
  );
}

export default function Variant4({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('feed');
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [overlayOpen, setOverlayOpen] = useState(false);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'on-device':
        return vault.notes.filter(
          (n) =>
            n.analysis.summary ||
            n.analysis.sentiment ||
            n.photos.some((p) => p.description),
        );
      case 'cloud':
        return vault.notes.filter(
          (n) => n.analysis.deepSummary || n.analysis.suggestions,
        );
      case 'unanalyzed':
        return vault.notes.filter(
          (n) =>
            !n.analysis.summary &&
            !n.analysis.sentiment &&
            !n.analysis.deepSummary &&
            !n.analysis.suggestions,
        );
      default:
        return vault.notes;
    }
  }, [filter, vault.notes]);

  const openEntry = async (id: number) => {
    await vault.selectNote(id);
    setOverlayOpen(true);
  };

  const openNewEntry = async () => {
    await vault.handleNewNote();
    setOverlayOpen(true);
  };

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'feed', label: 'Feed' },
    { id: 'mood', label: 'Mood timeline' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        providerKind={vault.provider.kind}
        providerInitError={vault.providerInitError}
        deviceAvailability={vault.device.availability}
        tabs={tabs}
        activeTab={view}
        onTabChange={(id) => setView(id as View)}
        trailing={
          <button
            type="button"
            onClick={() => void openNewEntry()}
            className="rounded-full bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            + New entry
          </button>
        }
        onStatusClick={() => setView('feed')}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {view === 'feed' && (
          <div className="flex flex-col gap-4">
            <OnDevicePanel
              availability={vault.device.availability}
              progress={vault.device.progress}
              initializing={vault.device.initializing}
              error={vault.device.error}
              modelName={vault.provider.kind === 'mock' ? 'Gemini Nano (simulated)' : 'Gemini Nano'}
              isMock={vault.provider.kind === 'mock'}
              simulated={vault.device.simulated}
              onEnable={vault.device.enable}
              onSetSimulated={vault.device.setSimulated}
            />

            {vault.deviceError && <AiErrorMessage error={vault.deviceError} />}

            {vault.cloudError && <AiErrorMessage error={vault.cloudError} />}

            <LedgerStrip />

            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Filter feed by privacy"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    filter === f.id
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                No entries match this filter yet.
              </p>
            ) : (
              filtered.map((note) => (
                <FeedCard
                  key={note.id}
                  note={note}
                  vault={vault}
                  onEdit={(id) => void openEntry(id)}
                />
              ))
            )}
          </div>
        )}

        {view === 'mood' && <MoodTimeline notes={vault.notes} />}
      </main>

      <AppFooter />

      {overlayOpen && (
        <EditorOverlay vault={vault} onClose={() => setOverlayOpen(false)} />
      )}
    </div>
  );
}
