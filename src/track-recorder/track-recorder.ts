import type { LatLng } from '../map/map';
import type { PositionFix } from '../positioning/positioning';

export interface PersonalWaypoint extends LatLng {
  name: string;
}

export interface SavedTrack {
  id: string;
  points: LatLng[];
  waypoints: PersonalWaypoint[];
  distanceMeters: number;
  savedAt: number;
}

export type RecorderState = 'idle' | 'recording' | 'paused';

const CADENCE_METERS = 10;
const CADENCE_SECONDS = 15;
const STORAGE_KEY = 'hikerppl.tracks.v1';

export interface RecorderApi {
  /** Begin a new recording, or resume a paused one. */
  start(): void;
  pause(): void;
  resume(): void;
  /** Save the current recording (GPX download + local storage) and reset to idle. */
  stopAndSave(): void;
  dropWaypoint(): PersonalWaypoint | null;
  onFix(fix: PositionFix): void;
  getState(): RecorderState;
  getDistanceMeters(): number;
  listSavedTracks(): SavedTrack[];
  deleteTrack(id: string): void;
  /** Fires on structural changes (state, saved tracks) — not on every position fix. */
  onChanged(cb: () => void): void;
}

export function createRecorder(): RecorderApi {
  let state: RecorderState = 'idle';
  let points: LatLng[] = [];
  let waypoints: PersonalWaypoint[] = [];
  let distanceMeters = 0;
  let lastFix: LatLng | null = null;
  let lastPoint: LatLng | null = null;
  let lastRecordedAt = 0;
  let savedTracks: SavedTrack[] = loadTracks();
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const cb of listeners) cb();
  };

  const reset = () => {
    points = [];
    waypoints = [];
    distanceMeters = 0;
    lastFix = null;
    lastPoint = null;
    lastRecordedAt = 0;
  };

  return {
    start() {
      if (state === 'recording') return;
      if (state === 'idle') reset();
      state = 'recording';
      emit();
    },
    pause() {
      if (state !== 'recording') return;
      state = 'paused';
      emit();
    },
    resume() {
      if (state !== 'paused') return;
      state = 'recording';
      emit();
    },
    stopAndSave() {
      if (state === 'idle') return;
      if (points.length >= 2) {
        const track: SavedTrack = {
          id: makeId(),
          points: [...points],
          waypoints: [...waypoints],
          distanceMeters,
          savedAt: Date.now(),
        };
        savedTracks = [...savedTracks, track];
        persistTracks(savedTracks);
        downloadGpx(track);
      }
      reset();
      state = 'idle';
      emit();
    },
    dropWaypoint() {
      if (state === 'idle' || !lastFix) return null;
      const name = (window.prompt('Waypoint name', 'Waypoint') ?? '').trim() || 'Waypoint';
      const waypoint: PersonalWaypoint = { lat: lastFix.lat, lng: lastFix.lng, name };
      waypoints = [...waypoints, waypoint];
      emit();
      return waypoint;
    },
    onFix(fix) {
      if (state !== 'recording') return;
      if (lastFix) distanceMeters += haversineMeters(lastFix, fix);
      const now = Date.now();
      const moved = lastPoint ? haversineMeters(lastPoint, fix) >= CADENCE_METERS : true;
      const elapsed = now - lastRecordedAt >= CADENCE_SECONDS * 1000;
      if (moved || elapsed) {
        points = [...points, { lat: fix.lat, lng: fix.lng }];
        lastPoint = { lat: fix.lat, lng: fix.lng };
        lastRecordedAt = now;
      }
      lastFix = { lat: fix.lat, lng: fix.lng };
    },
    getState() {
      return state;
    },
    getDistanceMeters() {
      return distanceMeters;
    },
    listSavedTracks() {
      return savedTracks;
    },
    deleteTrack(id) {
      savedTracks = savedTracks.filter((t) => t.id !== id);
      persistTracks(savedTracks);
      emit();
    },
    onChanged(cb) {
      listeners.add(cb);
    },
  };
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadTracks(): SavedTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedTrack[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistTracks(tracks: SavedTrack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    // storage may be full or unavailable; the track stays in memory for this session
  }
}

function downloadGpx(track: SavedTrack): void {
  const blob = new Blob([buildGpx(track)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hikerppl-${new Date(track.savedAt).toISOString().slice(0, 10)}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildGpx(track: SavedTrack): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="HikerPPL" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <trk><name>HikerPPL track</name><trkseg>`,
  ];
  for (const p of track.points) {
    lines.push(`    <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`);
  }
  lines.push('  </trkseg></trk>');
  for (const w of track.waypoints) {
    lines.push(`  <wpt lat="${w.lat}" lon="${w.lng}"><name>${escapeXml(w.name)}</name></wpt>`);
  }
  lines.push('</gpx>');
  return lines.join('\n');
}

function escapeXml(value: string): string {
  const map: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  };
  return value.replace(/[<>&'"]/g, (c) => map[c]);
}
