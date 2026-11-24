/**
 * On-device model status + setup. Handles every availability state with a
 * clear UI and never fails silently: when the model cannot run, the panel
 * says why and what to do, and the app keeps working without it.
 */
import type { DeviceAvailability } from '../lib/ai/types';

interface OnDevicePanelProps {
  availability: DeviceAvailability;
  progress: number;
  initializing: boolean;
  error: string | null;
  modelName: string;
  isMock: boolean;
  simulated: boolean;
  onEnable: () => void;
  onSetSimulated: (value: boolean) => void;
}

export function OnDevicePanel({
  availability,
  progress,
  initializing,
  error,
  modelName,
  isMock,
  simulated,
  onEnable,
  onSetSimulated,
}: OnDevicePanelProps) {
  return (
    <section
      aria-label="On-device AI status"
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-stone-900">
        On-device AI
        <span className="ml-2 font-normal text-stone-500">{modelName}</span>
      </h2>

      {availability === 'available' && (
        <div className="mt-2 animate-fade-in">
          <p className="flex items-center gap-2 text-sm text-teal-800">
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Ready — summaries and mood analysis run on this device.
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Sensitive content never leaves the browser for these features.
          </p>
        </div>
      )}

      {availability === 'downloadable' && !initializing && (
        <div className="mt-2 animate-fade-in">
          <p className="text-sm text-stone-700">
            Your private diary deserves private AI. Enable the on-device model
            to summarize entries and sense moods without anything leaving this
            browser.
          </p>
          <button
            type="button"
            onClick={onEnable}
            className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Enable on-device AI
          </button>
          <p className="mt-2 text-xs text-stone-500">
            One-time model download (a few hundred MB). Your notes work fully
            without it.
          </p>
        </div>
      )}

      {(availability === 'downloading' || initializing) && (
        <div className="mt-2 animate-fade-in">
          <p className="text-sm text-stone-700" role="status">
            Downloading the on-device model… {progress}%
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="On-device model download progress"
          >
            <div
              className="h-full rounded-full bg-teal-700 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            First use takes a moment. Keep this tab open.
          </p>
        </div>
      )}

      {availability === 'unavailable' && !initializing && (
        <div className="mt-2 animate-fade-in rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">On-device AI is unavailable here.</p>
          <p className="mt-1">
            It needs Chrome for desktop v139 or newer with the Prompt API
            enabled. In Chrome, open{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
              chrome://flags/#prompt-api-for-gemini-nano
            </code>{' '}
            and turn it on, then reload.
          </p>
          <p className="mt-2">
            Your notes still work fully — only the on-device insights are
            paused. MindVault will not quietly send your diary to the cloud
            instead.
          </p>
          {error && (
            <p className="mt-2 text-xs text-amber-800">Details: {error}</p>
          )}
        </div>
      )}

      {availability === 'unknown' && !initializing && (
        <p className="mt-2 text-sm text-stone-500" role="status">
          Checking on-device AI…
        </p>
      )}

      {error && availability !== 'unavailable' && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {isMock && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-dashed border-stone-200 pt-3 text-xs text-stone-500">
          <input
            type="checkbox"
            checked={simulated}
            onChange={(event) => onSetSimulated(event.target.checked)}
            className="mt-0.5 accent-teal-700"
          />
          <span>
            Demo: simulate an unavailable device model — see how the app
            degrades gracefully instead of silently uploading your diary.
          </span>
        </label>
      )}
    </section>
  );
}
