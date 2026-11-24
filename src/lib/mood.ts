/** Shared mood-score presentation (list dots, timeline, calendar). */

export type MoodBand = 'very-low' | 'low' | 'mixed' | 'positive' | 'bright';

export function moodBand(score: number): MoodBand {
  if (score >= 60) return 'bright';
  if (score >= 20) return 'positive';
  if (score > -20) return 'mixed';
  if (score > -60) return 'low';
  return 'very-low';
}

/** Hex color for SVG/calendar rendering. */
export function moodColor(score: number): string {
  switch (moodBand(score)) {
    case 'bright':
      return '#0f766e';
    case 'positive':
      return '#2dd4bf';
    case 'mixed':
      return '#d6d3d1';
    case 'low':
      return '#94a3b8';
    case 'very-low':
      return '#64748b';
  }
}

/** Tailwind background class for small dots/chips. */
export function moodDotClass(score: number): string {
  switch (moodBand(score)) {
    case 'bright':
      return 'bg-teal-700';
    case 'positive':
      return 'bg-teal-400';
    case 'mixed':
      return 'bg-stone-300';
    case 'low':
      return 'bg-slate-400';
    case 'very-low':
      return 'bg-slate-500';
  }
}
