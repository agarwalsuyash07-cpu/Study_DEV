export function fmtMin(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${String(rest).padStart(2, '0')}m` : `${h}h`
}

export function fmtClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
