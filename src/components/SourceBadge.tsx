/**
 * The "privacy verifiable" badge: every AI result wears one, showing whether
 * the inference ran on-device or in the cloud. The badge text comes from the
 * result's real `inferenceSource` — never assumed.
 */
import type { InferenceSource } from '../lib/ai/types';

export function SourceBadge({
  source,
  compact = false,
}: {
  source: InferenceSource;
  compact?: boolean;
}) {
  if (source === 'ON_DEVICE') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white"
        title="Processed on this device — the content never left the browser."
      >
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-teal-200" />
        ON-DEVICE
        {!compact && (
          <span className="font-normal text-teal-100">· stayed on device</span>
        )}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white"
      title="Processed in the cloud with your explicit approval."
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-100" />
      IN-CLOUD
      {!compact && (
        <span className="font-normal text-amber-100">· sent with approval</span>
      )}
    </span>
  );
}
