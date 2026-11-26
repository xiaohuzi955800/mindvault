/**
 * MindVault — privacy-first smart notes.
 *
 * Ships only v6, the merged submission version: Vault home + Notes
 * workspace + Dashboard (V5 + V2 + V1), running on the shared core
 * (`useVault` — data, AI, privacy model).
 *
 * History: five UI variants were built and compared on 2026-11-24
 * (v1 journal-first, v2 mood-first dashboard, v3 focused writer,
 * v4 timeline feed, v5 vault-first), scored against the four judging
 * criteria with scripted walkthroughs; v6 merges the two strongest.
 * The losing variants (v1–v5) were removed from the bundle on
 * 2026-11-26 before submission — their code survives in git history
 * and their screenshots in variants-screenshots/. See NOTES.md.
 */
import { CloudConsentModal } from './components/CloudConsentModal';
import { useVault } from './hooks/useVault';
import Variant6 from './variants/v6/Variant6';

export default function App() {
  const vault = useVault();

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
    <div data-variant="v6">
      <Variant6 vault={vault} />

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
