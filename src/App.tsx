/**
 * MindVault — privacy-first smart notes.
 *
 * Variant switch: `VITE_VARIANT` selects one of five UI variants, all
 * running on the same shared core (`useVault` — data, AI, privacy model):
 *
 *   VITE_VARIANT=v1  Journal-first (default, baseline): three-column notes
 *   VITE_VARIANT=v2  Mood-first dashboard: mood chart + heatmap as home
 *   VITE_VARIANT=v3  Focused writer: single column, drawer + AI bottom sheet
 *   VITE_VARIANT=v4  Timeline feed: cards with inline insight cards
 *   VITE_VARIANT=v5  Vault-first: privacy dashboard + privacy score as home
 *
 * Build any variant with, e.g.:
 *   VITE_VARIANT=v2 VITE_AI_PROVIDER=mock npm run build
 * (mock provider for deterministic local testing; omit VITE_AI_PROVIDER to
 * use the local .env default). See NOTES.md for the comparison.
 */
import { CloudConsentModal } from './components/CloudConsentModal';
import { useVault } from './hooks/useVault';
import Variant1 from './variants/v1/Variant1';
import Variant2 from './variants/v2/Variant2';
import Variant3 from './variants/v3/Variant3';
import Variant4 from './variants/v4/Variant4';
import Variant5 from './variants/v5/Variant5';
import type { Vault } from './hooks/useVault';

type VariantComponent = (props: { vault: Vault }) => React.JSX.Element;

const VARIANTS: Record<string, VariantComponent> = {
  v1: Variant1,
  v2: Variant2,
  v3: Variant3,
  v4: Variant4,
  v5: Variant5,
};

function getVariantId(): string {
  const raw = (import.meta.env.VITE_VARIANT ?? 'v1').toLowerCase();
  return VARIANTS[raw] ? raw : 'v1';
}

export default function App() {
  const vault = useVault();
  const variantId = getVariantId();
  const Variant = VARIANTS[variantId];

  if (!vault.seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-stone-500" role="status">
          Opening your vault…
        </p>
      </div>
    );
  }

  return (
    <div data-variant={variantId}>
      <Variant vault={vault} />

      <CloudConsentModal
        open={vault.pendingCloud !== null}
        actionLabel={
          vault.pendingCloud === 'deep-summary'
            ? 'Deep summary'
            : 'Writing suggestions'
        }
        noteTitle={vault.cloudTarget.title}
        noteContent={vault.cloudTarget.content}
        cloudModelName={vault.provider.cloudModelName}
        busy={vault.consentBusy}
        onConfirm={() => void vault.confirmCloud()}
        onCancel={vault.cancelCloud}
      />
    </div>
  );
}
