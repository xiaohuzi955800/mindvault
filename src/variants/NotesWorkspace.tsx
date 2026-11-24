/**
 * NotesWorkspace — the three-column notes view (list | editor | AI panel),
 * shared by V1 (journal-first, its home view) and V5 (vault-first, its
 * notes view). The layout is the V1 baseline; the variants differ in what
 * surrounds it.
 */
import { AiPanel } from '../components/AiPanel';
import { NoteEditor } from '../components/NoteEditor';
import { NoteList } from '../components/NoteList';
import type { Vault } from '../hooks/useVault';

export function NotesWorkspace({ vault }: { vault: Vault }) {
  const { notes, selected, draft } = vault;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)] [&>*]:h-full">
        <NoteList
          notes={notes}
          selectedId={selected?.id ?? null}
          search={vault.search}
          onSearchChange={vault.setSearch}
          onSelect={(id) => {
            void vault.selectNote(id);
          }}
          onNew={() => void vault.handleNewNote()}
        />
      </div>

      {selected && draft ? (
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
          onDelete={() => void vault.handleDeleteNote()}
          onAddPhoto={(file) => void vault.handleAddPhoto(file)}
          onDescribePhoto={(photoId) => void vault.handleDescribePhoto(photoId)}
          onRemovePhoto={(photoId) => void vault.handleRemovePhoto(photoId)}
        />
      ) : (
        <section className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-stone-900">
            Your vault is empty
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">
            Write your first entry — a thought, a day, a worry. It stays
            on this device unless you choose otherwise.
          </p>
          <button
            type="button"
            onClick={() => void vault.handleNewNote()}
            className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Write your first entry
          </button>
        </section>
      )}

      {selected && (
        <div className="xl:sticky xl:top-4">
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
      )}
    </div>
  );
}
