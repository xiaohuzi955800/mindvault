/**
 * Per-request cloud authorization. Nothing goes to the cloud until the user
 * has seen exactly what will be sent and checked the box — every single time.
 * Cancelling sends nothing.
 */
import { useEffect, useState } from 'react';

interface CloudConsentModalProps {
  open: boolean;
  actionLabel: string;
  noteTitle: string;
  noteContent: string;
  cloudModelName: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const EXCERPT_LIMIT = 600;

export function CloudConsentModal({
  open,
  actionLabel,
  noteTitle,
  noteContent,
  cloudModelName,
  busy,
  onConfirm,
  onCancel,
}: CloudConsentModalProps) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const excerpt =
    noteContent.length > EXCERPT_LIMIT
      ? `${noteContent.slice(0, EXCERPT_LIMIT)}…`
      : noteContent;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-fade-in sm:items-center"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-consent-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-fade-up"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="cloud-consent-title"
          className="font-serif text-xl font-semibold text-stone-900"
        >
          Send this note to the cloud?
        </h2>
        <p className="mt-2 text-sm text-stone-700">
          <strong>{actionLabel}</strong> needs a stronger model than the one on
          this device, so it runs in the cloud ({cloudModelName}) via Firebase
          AI Logic. This is the only way your words ever leave this browser —
          and only when you say so.
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
            Exactly what will be sent
          </p>
          <p className="mt-1 text-sm font-medium text-stone-900">
            {noteTitle || 'Untitled entry'}
          </p>
          <p className="note-body mt-1 max-h-32 overflow-y-auto text-sm whitespace-pre-wrap text-stone-700 slim-scroll">
            {excerpt}
          </p>
          <p className="mt-2 text-xs text-amber-800">
            {noteContent.length} characters · one request · nothing else from
            your vault
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-stone-800">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-600"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <span>
            I understand this note will be sent to Google Cloud for this one
            request. My other notes stay on this device.
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Keep it on this device
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!agreed || busy}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send once, with my approval'}
          </button>
        </div>
      </div>
    </div>
  );
}
