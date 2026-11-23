/**
 * Time-zone helpers — so every guest hears from us at a decent hour in *their*
 * day, not the resort's. Built on the standard Intl API (no dependencies).
 *
 * Vale Palheiro's guests come mainly from Germany, the UK, France, Switzerland,
 * the Netherlands and Poland, but the logic works for any IANA zone.
 */

export const RESORT_TZ = "Europe/Lisbon";

interface Parts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock date/time of `date` in time zone `tz`. */
export function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const { type, value } of formatter(tz).formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
  };
}

/** Offset of `tz` from UTC at `date`, in minutes. */
function offsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** The instant at which the wall clock in `tz` reads the given date and time. */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes handle DST boundaries.
  let t = guess - offsetMinutes(new Date(guess), tz) * 60000;
  t = guess - offsetMinutes(new Date(t), tz) * 60000;
  return new Date(t);
}

/** Same calendar day as `date` (in tz), at hh:mm local. */
function atLocal(date: Date, tz: string, hour: number, minute = 0, dayShift = 0): Date {
  const p = zonedParts(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + dayShift));
  return zonedTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute, tz);
}

export interface Window {
  /** Earliest local hour a message may arrive (inclusive). */
  startHour: number;
  /** Latest local hour (exclusive): a message must land before this. */
  endHour: number;
}

/**
 * Move `date` into the guest's acceptable hours.
 *   direction "later"   — push forward to the next window opening (most messages)
 *   direction "earlier" — pull back to the end of the previous window (messages
 *                          that must arrive *before* something, like arrival info)
 * Returns the adjusted date and a human note if it moved.
 */
export function fitToWindow(
  date: Date,
  tz: string,
  win: Window,
  direction: "later" | "earlier",
): { date: Date; note?: string } {
  const { hour } = zonedParts(date, tz);
  if (hour >= win.startHour && hour < win.endHour) return { date };

  let adjusted: Date;
  if (direction === "later") {
    adjusted = hour < win.startHour
      ? atLocal(date, tz, win.startHour)
      : atLocal(date, tz, win.startHour, 0, 1);
  } else {
    adjusted = hour >= win.endHour
      ? atLocal(date, tz, win.endHour - 1, 30)
      : atLocal(date, tz, win.endHour - 1, 30, -1);
  }
  const was = localLabel(date, tz);
  return {
    date: adjusted,
    note: `Moved from ${was} to ${localLabel(adjusted, tz)} so it doesn't arrive at an awkward hour`,
  };
}

/** Pin `date` to a fixed local time of day (e.g. 10:00) on the same local day. */
export function atLocalTime(date: Date, tz: string, hour: number, minute = 0): Date {
  return atLocal(date, tz, hour, minute);
}

/** "Tue 10:00 (Europe/Berlin)"-style label for staff. */
export function localLabel(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const hh = String(p.hour).padStart(2, "0");
  const mm = String(p.minute).padStart(2, "0");
  return `${WEEKDAYS[p.weekday]} ${p.day}/${p.month} ${hh}:${mm}`;
}

/** Best guess of a guest's zone from their country, when the booking lacks one. */
export const COUNTRY_TZ: Record<string, string> = {
  PT: "Europe/Lisbon",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  CH: "Europe/Zurich",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  PL: "Europe/Warsaw",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  US: "America/New_York",
  CA: "America/Toronto",
  BR: "America/Sao_Paulo",
};

export function timeZoneFor(country: string, explicit?: string): string {
  return explicit || COUNTRY_TZ[country.toUpperCase()] || RESORT_TZ;
}
