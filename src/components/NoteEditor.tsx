/**
 * The writing surface: title, body, photo attachments, delete.
 * Saves automatically (debounced) — the parent owns persistence.
 */
import { useEffect, useRef, useState } from 'react';
import type { Note } from '../lib/db';
import { formatDate, formatTime, wordCount } from '../lib/format';
import { SourceBadge } from './SourceBadge';

interface NoteEditorProps {
  note: Note;
  draftTitle: string;
  draftContent: string;
  saveState: 'saved' | 'saving';
  savedAt: number | null;
  describingPhotoId: string | null;
  photoError: string | null;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onDelete: () => void;
  onAddPhoto: (file: File) => void;
  onDescribePhoto: (photoId: string) => void;
  onRemovePhoto: (photoId: string) => void;
}

export function NoteEditor({
  note,
  draftTitle,
  draftContent,
  saveState,
  savedAt,
  describingPhotoId,
  photoError,
  onTitleChange,
  onContentChange,
  onDelete,
  onAddPhoto,
  onDescribePhoto,
  onRemovePhoto,
}: NoteEditorProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setConfirmingDelete(false);
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [note.id]);

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingDelete(false);
    onDelete();
  };

  return (
    <section
      aria-label="Entry editor"
      className="flex min-h-0 flex-col rounded-xl border border-stone-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="note-title">
            Entry title
          </label>
          <input
            id="note-title"
            type="text"
            value={draftTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Give this entry a title…"
            className="w-full bg-transparent font-serif text-2xl font-semibold text-stone-900 placeholder:text-stone-300 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-500">
            {formatDate(note.createdAt)} · {wordCount(draftContent)}{' '}
            {wordCount(draftContent) === 1 ? 'word' : 'words'} ·{' '}
            {saveState === 'saving' ? (
              <span role="status">Saving…</span>
            ) : (
              <span role="status">
                Saved locally
                {savedAt ? ` · ${formatTime(savedAt)}` : ''}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDeleteClick}
          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
            confirmingDelete
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-stone-300 text-stone-600 hover:bg-stone-100'
          }`}
        >
          {confirmingDelete ? 'Click again to delete' : 'Delete'}
        </button>
      </div>

      <label className="sr-only" htmlFor="note-content">
        Entry text
      </label>
      <textarea
        id="note-content"
        value={draftContent}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Write honestly — this stays on your device unless you choose otherwise…"
        className="note-body min-h-[300px] w-full flex-1 resize-y bg-transparent px-4 pt-3 pb-8 text-[17px] text-stone-800 placeholder:text-stone-300 focus:outline-none"
      />

      <div className="border-t border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900">
            Photos{' '}
            <span className="font-normal text-stone-500">
              (JPEG/PNG, described on-device)
            </span>
          </h3>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            + Attach photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            aria-label="Attach a JPEG or PNG photo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAddPhoto(file);
              event.target.value = '';
            }}
          />
        </div>

        {photoError && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800" role="alert">
            {photoError}
          </p>
        )}

        {note.photos.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">
            No photos yet. A photo stays on this device, just like your words.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" role="list">
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
                  <p className="truncate text-xs font-medium text-stone-700">
                    {photo.name}
                  </p>
                  {photo.description ? (
                    <div className="mt-2 animate-fade-in">
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
                      onClick={() => onDescribePhoto(photo.id)}
                      disabled={describingPhotoId === photo.id}
                      className="mt-2 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      {describingPhotoId === photo.id
                        ? 'Describing on-device…'
                        : 'Describe on-device'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
                    className="mt-2 ml-2 text-xs font-medium text-stone-500 underline hover:text-stone-800"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
