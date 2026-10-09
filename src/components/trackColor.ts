// One hue per track, assigned by track sort order.
const HUES = ['#5b9cf5', '#c084fc', '#2dd4bf', '#f472b6', '#facc15', '#fb923c', '#a3e635']

export function trackColor(sortOrder: number): string {
  return HUES[((sortOrder % HUES.length) + HUES.length) % HUES.length]!
}

/** "DSA — follow plan on takeUforward…" → "DSA". */
export const shortTrackName = (name: string) => name.split(/\s[—-]\s/)[0]!
