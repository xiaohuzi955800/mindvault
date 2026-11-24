/**
 * The AI side panel: on-device insights (summary + mood) and cloud insights
 * (deep summary + writing suggestions). Every result wears its source badge.
 */
import type { Note } from '../lib/db';
import { formatDateTime } from '../lib/format';
import type { useDeviceModel } from '../hooks/useDeviceModel';
import { OnDevicePanel } from './OnDevicePanel';
import { SourceBadge } from './SourceBadge';

export type CloudAction = 'deep-summary' | 'suggestions';

interface AiPanelProps {
  note: Note;
  providerKind: 'mock' | 'firebase';
  cloudModelName: string;
  device: ReturnType<typeof useDeviceModel>;
  busy: { summary: boolean; sentiment: boolean; cloud: boolean };
  error: string | null;
  onSummarize: () => void;
  onAnalyzeSentiment: () => void;
  onCloudAction: (action: CloudAction) => void;
}

function ResultMeta({ model, createdAt }: { model: string; createdAt: number }) {
  return (
    <p className="mt-1 text-[11px] text-stone-400">
      {model} · {formatDateTime(createdAt)}
    </p>
  );
}

export function AiPanel({
  note,
  providerKind,
  cloudModelName,
  device,
  busy,
  error,
  onSummarize,
  onAnalyzeSentiment,
  onCloudAction,
}: AiPanelProps) {
  const hasContent = note.content.trim().length > 0;
  const deviceReady = device.availability === 'available';
  const { summary, sentiment, deepSummary, suggestions } = note.analysis;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <OnDevicePanel
        availability={device.availability}
        progress={device.progress}
        initializing={device.initializing}
        error={device.error}
        modelName={providerKind === 'mock' ? 'Gemini Nano (simulated)' : 'Gemini Nano'}
        isMock={providerKind === 'mock'}
        simulated={device.simulated}
        onEnable={device.enable}
        onSetSimulated={device.setSimulated}
      />

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <section
        aria-label="On-device insights"
        className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-stone-900">
          On-device insights
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Summaries and mood analysis run on this device. Nothing leaves the
          browser.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSummarize}
            disabled={!hasContent || !deviceReady || busy.summary}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy.summary ? 'Summarizing…' : summary ? 'Re-summarize' : 'Summarize on device'}
          </button>
          <button
            type="button"
            onClick={onAnalyzeSentiment}
            disabled={!hasContent || !deviceReady || busy.sentiment}
            className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy.sentiment ? 'Sensing mood…' : sentiment ? 'Re-analyze mood' : 'Analyze mood on device'}
          </button>
        </div>
        {!hasContent && (
          <p className="mt-2 text-xs text-stone-500">
            Write a few sentences first — on-device AI needs something to read.
          </p>
        )}
        {hasContent && !deviceReady && (
          <p className="mt-2 text-xs text-stone-500">
            Enable on-device AI above to use these features. Until then,
            everything stays exactly where it is.
          </p>
        )}

        {summary && (
          <div className="mt-4 animate-fade-in rounded-lg bg-teal-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
                Summary
              </h3>
              <SourceBadge source={summary.source} compact />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-800">
              {summary.text}
            </p>
            <ResultMeta model={summary.model} createdAt={summary.createdAt} />
          </div>
        )}

        {sentiment && (
          <div className="mt-3 animate-fade-in rounded-lg bg-teal-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-teal-900 uppercase">
                Mood
              </h3>
              <SourceBadge source={sentiment.source} compact />
            </div>
            <p className="mt-1.5 text-sm text-stone-800">
              <span className="font-semibold">{sentiment.label}</span>{' '}
              <span className="text-stone-500">({sentiment.score})</span>
            </p>
            <div
              className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-slate-400 via-stone-200 to-teal-600"
              role="img"
              aria-label={`Mood score ${sentiment.score} out of -100 to 100, ${sentiment.label}`}
            >
              <span
                aria-hidden="true"
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-800 shadow"
                style={{ left: `${((sentiment.score + 100) / 200) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-stone-400">
              <span>Very low</span>
              <span>Mixed</span>
              <span>Bright</span>
            </div>
            {sentiment.keywords.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {sentiment.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-teal-700/20"
                  >
                    {keyword}
                  </span>
                ))}
              </p>
            )}
            <ResultMeta model={sentiment.model} createdAt={sentiment.createdAt} />
            <p className="mt-1 text-[11px] text-stone-400">
              Mood insights support self-reflection — they are not a medical or
              psychological assessment.
            </p>
          </div>
        )}
      </section>

      <section
        aria-label="Cloud insights"
        className="rounded-xl border border-amber-200/70 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-stone-900">
          Cloud insights{' '}
          <span className="font-normal text-stone-500">({cloudModelName})</span>
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Deep summaries and writing suggestions need a stronger model, so they
          run in the cloud. Each request asks for your approval first — and is
          recorded in the Privacy Ledger.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCloudAction('deep-summary')}
            disabled={!hasContent || busy.cloud}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy.cloud ? 'Working…' : deepSummary ? 'Re-run deep summary' : 'Deep summary'}
          </button>
          <button
            type="button"
            onClick={() => onCloudAction('suggestions')}
            disabled={!hasContent || busy.cloud}
            className="rounded-lg border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy.cloud ? 'Working…' : suggestions ? 'New suggestions' : 'Writing suggestions'}
          </button>
        </div>
        {!hasContent && (
          <p className="mt-2 text-xs text-stone-500">
            Write a few sentences first.
          </p>
        )}

        {deepSummary && (
          <div className="mt-4 animate-fade-in rounded-lg bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                Deep summary
              </h3>
              <SourceBadge source={deepSummary.source} compact />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
              {deepSummary.text}
            </p>
            <ResultMeta model={deepSummary.model} createdAt={deepSummary.createdAt} />
            <p className="mt-1 text-[11px] text-amber-800">
              Sent with your approval · {deepSummary.charsSent} characters
            </p>
          </div>
        )}

        {suggestions && (
          <div className="mt-3 animate-fade-in rounded-lg bg-amber-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-amber-900 uppercase">
                Writing suggestions
              </h3>
              <SourceBadge source={suggestions.source} compact />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
              {suggestions.text}
            </p>
            <ResultMeta model={suggestions.model} createdAt={suggestions.createdAt} />
            <p className="mt-1 text-[11px] text-amber-800">
              Sent with your approval · {suggestions.charsSent} characters
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
