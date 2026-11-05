const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });

/** Today's date key (YYYY-MM-DD) in Europe/London, matching the backend convention. */
export function todayKey(date = new Date()): string {
  return dateFormatter.format(date);
}
