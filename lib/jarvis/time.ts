/**
 * J.A.R.V.I.S. Standardized Timezone Substrate
 * Strictly enforces Indian Standard Time (IST - Asia/Kolkata, UTC+5:30)
 * across all client UI, server telemetry, logs, and notification timestamps.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowInIST(): Date {
  return new Date();
}

/**
 * Formats date/timestamp to standard IST time string (e.g. "08:15:30 PM IST")
 */
export function formatISTTime(dateOrIso?: Date | string | number | null): string {
  if (!dateOrIso) return '---';
  try {
    const d = typeof dateOrIso === 'string' || typeof dateOrIso === 'number' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' IST';
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Formats date/timestamp to compact short IST time (e.g. "08:15 PM")
 */
export function formatShortISTTime(dateOrIso?: Date | string | number | null): string {
  if (!dateOrIso) return '---';
  try {
    const d = typeof dateOrIso === 'string' || typeof dateOrIso === 'number' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Formats date/timestamp to full IST date & time (e.g. "15 Sep 2026, 08:15:30 PM IST")
 */
export function formatFullISTDateTime(dateOrIso?: Date | string | number | null): string {
  if (!dateOrIso) return '---';
  try {
    const d = typeof dateOrIso === 'string' || typeof dateOrIso === 'number' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d) + ' IST';
  } catch {
    return String(dateOrIso);
  }
}
