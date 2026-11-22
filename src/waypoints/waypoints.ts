import type { LatLng } from '../map/map';

export interface PersonalWaypoint extends LatLng {
  id: string;
  name: string;
  createdAt: number;
}

const STORAGE_KEY = 'hikerppl.waypoints.v1';

export interface WaypointStore {
  list(): PersonalWaypoint[];
  add(point: LatLng, name: string): PersonalWaypoint;
  delete(id: string): void;
  onChanged(cb: () => void): void;
}

export function createWaypointStore(): WaypointStore {
  let waypoints: PersonalWaypoint[] = load();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const cb of listeners) cb();
  };

  return {
    list() {
      return waypoints;
    },
    add(point, name) {
      const waypoint: PersonalWaypoint = {
        id: makeId(),
        lat: point.lat,
        lng: point.lng,
        name,
        createdAt: Date.now(),
      };
      waypoints = [...waypoints, waypoint];
      persist(waypoints);
      emit();
      return waypoint;
    },
    delete(id) {
      waypoints = waypoints.filter((w) => w.id !== id);
      persist(waypoints);
      emit();
    },
    onChanged(cb) {
      listeners.add(cb);
    },
  };
}

function load(): PersonalWaypoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonalWaypoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(waypoints: PersonalWaypoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
  } catch {
    // storage unavailable; waypoints just won't persist
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
