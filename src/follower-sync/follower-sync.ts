import { onValue, ref } from 'firebase/database';
import { db, firebaseConfigured } from '../firebase';
import { todayKey } from '../day';
import type { MapApi, LatLng, Waypoint } from '../map/map';

export function startFollowing(map: MapApi): () => void {
  if (!firebaseConfigured || !db) return () => {};
  const dbInstance = db;

  return onValue(ref(dbInstance, 'days'), (snapshot) => {
    const today = snapshot.child(todayKey());

    const points: LatLng[] = [];
    today.child('track').forEach((child) => {
      const value = child.val() as { lat?: unknown; lng?: unknown } | null;
      if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
        points.push({ lat: value.lat, lng: value.lng });
      }
    });

    const waypoints: Waypoint[] = [];
    today.child('waypoints').forEach((child) => {
      const value = child.val() as { lat?: unknown; lng?: unknown; label?: unknown } | null;
      if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
        waypoints.push({
          lat: value.lat,
          lng: value.lng,
          label: typeof value.label === 'string' ? value.label : 'Waypoint',
        });
      }
    });

    map.addLeaderRoute(points);
    map.addWaypoints(waypoints);
  });
}
