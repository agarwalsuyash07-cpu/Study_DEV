// Dates are plain 'YYYY-MM-DD' strings in IST; arithmetic is done in UTC to avoid DST/offset drift.
const istFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function todayIST(now: Date = new Date()): string {
  return istFormat.format(now)
}

const toUTC = (date: string) => new Date(`${date}T00:00:00Z`)

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: string): number {
  return toUTC(date).getUTCDay()
}

export function addDays(date: string, days: number): string {
  const d = toUTC(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Mon–Sun week containing `date`. */
export function weekDates(date: string): string[] {
  const monday = addDays(date, -((weekdayOf(date) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
