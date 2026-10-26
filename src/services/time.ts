/**
 * The only module that reads the clock or formats dates. Records store UTC ISO-8601 strings;
 * display uses the device's locale and time zone through Intl.
 */

export type Clock = () => Date

export const systemClock: Clock = () => new Date()

export function nowIso(clock: Clock = systemClock): string {
  return clock().toISOString()
}

export function toEpochMs(iso: string): number {
  return Date.parse(iso)
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const shortFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatShort(epochMs: number): string {
  return shortFormat.format(new Date(epochMs))
}

/** Value for an <input type="datetime-local"> in the device's local time. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a datetime-local value (device local time) back to UTC ISO. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}

/** Whole days elapsed between two instants, for "reconstituted 9 days ago". */
export function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - Date.parse(fromIso)) / 86_400_000)
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatRelativeDays(days: number): string {
  return relative.format(-days, 'day')
}

/** Human duration for PK figures: "11 min", "5.0 h", "7.0 days". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Number(hours.toFixed(1))} h`
  return `${Number((hours / 24).toFixed(1))} days`
}
