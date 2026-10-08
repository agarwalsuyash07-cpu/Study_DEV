// Tracks whose work happens on another site: their task titles open it in a new tab.
// ponytail: hardcoded per track id; move to a tracks.url column (seed-driven) if more tracks need links.
const TRACK_LINKS: Record<string, string> = {
  dsa: 'https://takeuforward.org/dashboard',
}

export const trackLink = (trackId: string): string | undefined => TRACK_LINKS[trackId]
