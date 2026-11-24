/**
 * Sidebar: search + note list + new-note action.
 */
import type { Note } from '../lib/db';
import { formatDate } from '../lib/format';
import { moodDotClass } from '../lib/mood';

interface NoteListProps {
  notes: Note[];
  selectedId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  onNew: () => void;
}

function snippet(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return 'No text yet — tap to start writing.';
  return flat.length > 110 ? `${flat.slice(0, 110)}…` : flat;
}

export function NoteList({
  notes,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  onNew,
}: NoteListProps) {
  const query = search.trim().toLowerCase();
  const filtered =
    query.length === 0
      ? notes
      : notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query),
        );

  return (
    <aside
      aria-label="Your notes"
      className="flex min-h-0 flex-col rounded-xl border border-stone-200 bg-white shadow-sm"
    >
      <div className="border-b border-stone-200 p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + New entry
        </button>
        <label className="mt-3 block">
          <span className="sr-only">Search notes</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search your vault…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-400"
          />
        </label>
      </div>

      <ul className="slim-scroll min-h-0 flex-1 overflow-y-auto p-2" role="list">
        {filtered.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-stone-500">
            {notes.length === 0
              ? 'No entries yet. Your first note is one click away.'
              : `Nothing matches “${search.trim()}”.`}
          </li>
        )}
        {filtered.map((note) => {
          const selected = note.id === selectedId;
          const sentiment = note.analysis.sentiment;
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => note.id !== undefined && onSelect(note.id)}
                aria-current={selected ? 'true' : undefined}
                className={`w-full rounded-lg px-3 py-2.5 text-left ${
                  selected ? 'bg-teal-50 ring-1 ring-teal-700/30' : 'hover:bg-stone-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  {sentiment && (
                    <span
                      aria-hidden="true"
                      title={`Mood: ${sentiment.label} (${sentiment.score})`}
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${moodDotClass(sentiment.score)}`}
                    />
                  )}
                  <span className="truncate text-sm font-semibold text-stone-900">
                    {note.title.trim() || 'Untitled entry'}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  {formatDate(note.createdAt)}
                  {note.photos.length > 0 && ` · ${note.photos.length} photo${note.photos.length === 1 ? '' : 's'}`}
                  {note.analysis.summary && ' · summarized'}
                  {note.analysis.deepSummary && ' · deep summary'}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-stone-500">
                  {snippet(note.content)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-stone-200 px-3 py-2 text-center text-[11px] text-stone-400">
        {notes.length} {notes.length === 1 ? 'entry' : 'entries'} · stored only in
        this browser
      </p>
    </aside>
  );
}
