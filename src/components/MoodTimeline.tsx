/**
 * Mood timeline: a line chart of sentiment over time plus a 6-week calendar
 * heatmap. Both are driven only by on-device sentiment results.
 */
import { useMemo } from 'react';
import type { Note } from '../lib/db';
import { formatDate } from '../lib/format';
import { moodColor } from '../lib/mood';

interface MoodPoint {
  noteId: number;
  date: number;
  score: number;
  label: string;
  title: string;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const PAD = { left: 44, right: 16, top: 18, bottom: 30 };

function chartY(score: number): number {
  const inner = CHART_HEIGHT - PAD.top - PAD.bottom;
  return PAD.top + ((100 - score) / 200) * inner;
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * @param onDayClick — when provided (V2 dashboard), calendar days that have
 * an analyzed entry become buttons opening that entry.
 */
export function MoodTimeline({
  notes,
  onDayClick,
}: {
  notes: Note[];
  onDayClick?: (noteId: number) => void;
}) {
  const points: MoodPoint[] = useMemo(
    () =>
      notes
        .filter((note) => note.analysis.sentiment && note.id !== undefined)
        .map((note) => ({
          noteId: note.id as number,
          date: note.createdAt,
          score: note.analysis.sentiment?.score ?? 0,
          label: note.analysis.sentiment?.label ?? 'Mixed',
          title: note.title || 'Untitled entry',
        }))
        .sort((a, b) => a.date - b.date),
    [notes],
  );

  const calendarDays = useMemo(() => {
    const byDay = new Map<string, MoodPoint>();
    for (const point of points) {
      byDay.set(dayKey(point.date), point);
    }
    const days: Array<{ date: Date; point: MoodPoint | undefined }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 41; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push({ date, point: byDay.get(dayKey(date.getTime())) });
    }
    return days;
  }, [points]);

  if (points.length === 0) {
    return (
      <section
        aria-label="Mood timeline"
        className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm"
      >
        <h2 className="font-serif text-xl font-semibold text-stone-900">
          Your mood timeline is waiting
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
          Analyze an entry on-device and its mood appears here — a private
          timeline of how your days felt, built without anything leaving this
          browser.
        </p>
      </section>
    );
  }

  const chartX = (index: number): number => {
    const inner = CHART_WIDTH - PAD.left - PAD.right;
    if (points.length === 1) return PAD.left + inner / 2;
    return PAD.left + (index / (points.length - 1)) * inner;
  };
  const linePath = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${chartX(i).toFixed(1)},${chartY(point.score).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${chartX(points.length - 1).toFixed(1)},${chartY(-100).toFixed(1)} L${chartX(0).toFixed(1)},${chartY(-100).toFixed(1)} Z`;
  const average = Math.round(
    points.reduce((sum, point) => sum + point.score, 0) / points.length,
  );
  const brightest = points.reduce((best, point) =>
    point.score > best.score ? point : best,
  );

  return (
    <section aria-label="Mood timeline" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Entries analyzed
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {points.length}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Average mood
          </p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {average}
            <span className="ml-2 text-sm font-normal text-stone-500">
              {average >= 20 ? 'Positive' : average > -20 ? 'Mixed' : 'Low'}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            Brightest day
          </p>
          <p className="mt-1 truncate text-lg font-semibold text-stone-900">
            {brightest.title}
          </p>
          <p className="text-xs text-stone-500">
            {formatDate(brightest.date)} · {brightest.label} ({brightest.score})
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-stone-900">
          Mood over time
        </h2>
        <p className="mt-0.5 text-xs text-stone-500">
          From on-device mood analysis only — no cloud involved.
        </p>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="mt-4 w-full"
          role="img"
          aria-label={`Line chart of mood scores across ${points.length} analyzed entries, average ${average}.`}
        >
          {[-100, -50, 0, 50, 100].map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={CHART_WIDTH - PAD.right}
                y1={chartY(value)}
                y2={chartY(value)}
                stroke={value === 0 ? '#a8a29e' : '#e7e5e4'}
                strokeDasharray={value === 0 ? '4 3' : undefined}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={chartY(value) + 4}
                textAnchor="end"
                fontSize={11}
                fill="#78716c"
              >
                {value}
              </text>
            </g>
          ))}
          <path d={areaPath} fill="#0f766e" opacity={0.08} />
          <path
            d={linePath}
            fill="none"
            stroke="#0f766e"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, i) => (
            <g key={`${point.date}-${i}`}>
              <circle
                cx={chartX(i)}
                cy={chartY(point.score)}
                r={5}
                fill={moodColor(point.score)}
                stroke="#ffffff"
                strokeWidth={2}
              >
                <title>
                  {formatDate(point.date)} — {point.title}: {point.label} (
                  {point.score})
                </title>
              </circle>
              {(i === 0 || i === points.length - 1) && (
                <text
                  x={chartX(i)}
                  y={CHART_HEIGHT - 8}
                  textAnchor={
                    points.length === 1
                      ? 'middle'
                      : i === 0
                        ? 'start'
                        : 'end'
                  }
                  fontSize={11}
                  fill="#78716c"
                >
                  {formatDate(point.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-stone-900">
          Last 6 weeks
        </h2>
        <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label="Calendar heatmap of mood by day for the last 6 weeks.">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <span
              key={i}
              className="pb-1 text-center text-[10px] font-semibold text-stone-400"
            >
              {day}
            </span>
          ))}
          {calendarDays.map(({ date, point }) => {
            const label = point
              ? `${formatDate(date.getTime())} — ${point.label} (${point.score})`
              : `${formatDate(date.getTime())} — no analyzed entry`;
            const style = {
              backgroundColor: point ? moodColor(point.score) : '#f5f5f4',
            };
            // In the V2 dashboard, days with an entry are clickable.
            if (point && onDayClick) {
              return (
                <button
                  key={date.getTime()}
                  type="button"
                  title={label}
                  aria-label={`${label} — open this entry`}
                  onClick={() => onDayClick(point.noteId)}
                  className="aspect-square rounded-md ring-1 ring-stone-200/60 transition-transform hover:scale-110 hover:ring-2 hover:ring-teal-700/50"
                  style={style}
                />
              );
            }
            return (
              <span
                key={date.getTime()}
                title={label}
                className="aspect-square rounded-md ring-1 ring-stone-200/60"
                style={style}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-stone-500">
          <span>Lower mood</span>
          {[-80, -40, 0, 40, 80].map((score) => (
            <span
              key={score}
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-stone-200/60"
              style={{ backgroundColor: moodColor(score) }}
            />
          ))}
          <span>Brighter</span>
        </div>
      </div>
    </section>
  );
}
