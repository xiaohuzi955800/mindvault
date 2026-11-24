/**
 * EditorOverlay — a focused, full-screen editor + AI panel used by V2
 * (mood-first dashboard) and V4 (timeline feed) when the user opens an
 * entry. The overlay reuses the exact same editor and AI panel as the
 * three-column workspace, so the writing and AI experience is identical —
 * only the way you get there differs.
 */
import { useEffect } from 'react';
import { AiPanel } from '../components/AiPanel';
import { NoteEditor } from '../components/NoteEditor';
import type { Vault } from '../hooks/useVault';

export function EditorOverlay({
  vault,
  onClose,
}: {
  vault: Vault;
  onClose: () => void;
}) {
  const { selected, draft } = vault;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!selected || !draft) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-stone-100 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Entry editor"
    >
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <p className="truncate text-sm font-semibold text-stone-900">
          {draft.title.trim() || 'Untitled entry'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
        >
          Done
        </button>
      </div>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <NoteEditor
          note={selected}
          draftTitle={draft.title}
          draftContent={draft.content}
          saveState={vault.saveState}
          savedAt={vault.savedAt}
          describingPhotoId={vault.describingPhotoId}
          photoError={vault.photoError}
          onTitleChange={vault.handleTitleChange}
          onContentChange={vault.handleContentChange}
          onDelete={() => {
            void vault.handleDeleteNote();
            onClose();
          }}
          onAddPhoto={(file) => void vault.handleAddPhoto(file)}
          onDescribePhoto={(photoId) => void vault.handleDescribePhoto(photoId)}
          onRemovePhoto={(photoId) => void vault.handleRemovePhoto(photoId)}
        />
        <AiPanel
          note={selected}
          providerKind={vault.provider.kind}
          cloudModelName={vault.provider.cloudModelName}
          device={vault.device}
          busy={vault.busy}
          deviceError={vault.deviceError}
          cloudError={vault.cloudError}
          onSummarize={() => void vault.runOnDevice('summary')}
          onAnalyzeSentiment={() => void vault.runOnDevice('sentiment')}
          onCloudAction={vault.requestCloud}
        />
      </div>
    </div>
  );
}
