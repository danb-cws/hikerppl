export type Units = 'km' | 'mi';

export interface Settings {
  units: Units;
  trackColor: string;
}

const STORAGE_KEY = 'hikerppl.settings.v1';
export const DEFAULT_TRACK_COLOR = '#ec4899';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        units: parsed.units === 'mi' ? 'mi' : 'km',
        trackColor: typeof parsed.trackColor === 'string' ? parsed.trackColor : DEFAULT_TRACK_COLOR,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { units: 'km', trackColor: DEFAULT_TRACK_COLOR };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage may be unavailable; settings then just don't persist
  }
}

/** Formats a distance in metres using the chosen unit, e.g. "3.42 km" or "2.13 mi". */
export function formatDistance(meters: number, units: Units): string {
  const km = meters / 1000;
  const value = units === 'mi' ? km * 0.621371 : km;
  return `${value.toFixed(2)} ${units === 'mi' ? 'mi' : 'km'}`;
}
