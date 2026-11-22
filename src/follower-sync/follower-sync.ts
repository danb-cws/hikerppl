import { onValue, ref } from 'firebase/database';
import { db, firebaseConfigured } from '../firebase';
import { todayKey } from '../day';
import type { LatLng, Waypoint } from '../map/map';

const NOTICE_KEY = 'hikerppl.dismissedNotice';
// Generous grace period so a leader who simply loses signal (dead zones are normal
// on a hike) is not treated as stopped. The broadcast recovers when heartbeats resume.
const STALE_BROADCAST_MS = 30 * 60_000;

export interface FollowerCallbacks {
  showBroadcastPrompt(name: string): void;
  hideBroadcastPrompt(): void;
  setLiveIndicator(visible: boolean): void;
  showNotice(from: string, text: string): void;
  renderShared(points: LatLng[], waypoints: Waypoint[]): void;
  clearShared(): void;
  centerOnLeader(point: LatLng): void;
}

export interface Follower {
  /** Member chose "show" for the active broadcast. */
  show(): void;
  /** Member chose "dismiss" for the active broadcast. */
  dismiss(): void;
  /** Member tapped the live indicator to reconsider. */
  rejoin(): void;
  dismissNotice(): void;
  dispose(): void;
}

export function createFollower(
  cb: FollowerCallbacks,
  isLeader: () => boolean = () => false,
): Follower {
  let points: LatLng[] = [];
  let waypoints: Waypoint[] = [];
  let activeStartedAt: number | null = null;
  let activeName = 'Leader';
  let currentNoticeAt: number | null = null;
  let optedInStartedAt: number | null = null;
  let dismissedStartedAt: number | null = null;
  let promptingStartedAt: number | null = null;
  let dismissedNoticeAt: number | null = readDismissedNotice();

  const noop: Follower = {
    show() {},
    dismiss() {},
    rejoin() {},
    dismissNotice() {},
    dispose() {},
  };

  if (!firebaseConfigured || !db) return noop;
  const dbInstance = db;

  const unsubscribe = onValue(ref(dbInstance, 'days'), (snapshot) => {
    const today = snapshot.child(todayKey());

    points = [];
    today.child('track').forEach((child) => {
      const value = child.val() as { lat?: unknown; lng?: unknown } | null;
      if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
        points.push({ lat: value.lat, lng: value.lng });
      }
    });

    waypoints = [];
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

    const broadcast = today.child('broadcast').val() as
      | { active?: unknown; name?: unknown; startedAt?: unknown; lastBeat?: unknown }
      | null;
    const lastBeat = typeof broadcast?.lastBeat === 'number' ? broadcast.lastBeat : 0;
    const fresh = Date.now() - lastBeat < STALE_BROADCAST_MS;
    const bcActive = Boolean(
      broadcast?.active && typeof broadcast.startedAt === 'number' && fresh,
    );
    const startedAt = bcActive ? (broadcast?.startedAt as number) : null;
    activeName =
      (broadcast && typeof broadcast.name === 'string' && broadcast.name) || 'Leader';

    if (isLeader()) {
      // This device is the leader: never prompt or render its own broadcast.
      cb.setLiveIndicator(false);
      cb.hideBroadcastPrompt();
      cb.clearShared();
    } else {
      if (startedAt !== activeStartedAt) {
        if (startedAt != null) {
          // a fresh broadcast replaces the previous last-seen route until the user opts in
          cb.clearShared();
        }
        activeStartedAt = startedAt;
        dismissedStartedAt = null;
        promptingStartedAt = null;
        if (startedAt == null) optedInStartedAt = null;
      }

      if (startedAt != null) {
        if (optedInStartedAt === startedAt) {
          cb.renderShared(points, waypoints);
          cb.setLiveIndicator(false);
          cb.hideBroadcastPrompt();
        } else if (dismissedStartedAt === startedAt) {
          cb.setLiveIndicator(true);
          cb.hideBroadcastPrompt();
        } else if (promptingStartedAt !== startedAt) {
          promptingStartedAt = startedAt;
          cb.showBroadcastPrompt(activeName);
          cb.setLiveIndicator(false);
        }
      } else {
        cb.setLiveIndicator(false);
        cb.hideBroadcastPrompt();
        // keep the last-seen route on screen until the next broadcast
      }
    }

    const notice = today.child('notice').val() as
      | { text?: unknown; name?: unknown; at?: unknown }
      | null;
    if (
      notice &&
      typeof notice.text === 'string' &&
      typeof notice.at === 'number' &&
      notice.at !== dismissedNoticeAt
    ) {
      currentNoticeAt = notice.at;
      cb.showNotice((notice.name as string) || 'Leader', notice.text);
    }
  });

  return {
    show() {
      if (activeStartedAt == null) return;
      optedInStartedAt = activeStartedAt;
      dismissedStartedAt = null;
      cb.hideBroadcastPrompt();
      cb.setLiveIndicator(false);
      cb.renderShared(points, waypoints);
      const last = points[points.length - 1];
      if (last) cb.centerOnLeader(last);
    },
    dismiss() {
      if (activeStartedAt == null) return;
      dismissedStartedAt = activeStartedAt;
      optedInStartedAt = null;
      cb.hideBroadcastPrompt();
      cb.setLiveIndicator(true);
      cb.clearShared();
    },
    rejoin() {
      if (activeStartedAt == null) return;
      dismissedStartedAt = null;
      promptingStartedAt = null;
      cb.setLiveIndicator(false);
      cb.showBroadcastPrompt(activeName);
    },
    dismissNotice() {
      if (currentNoticeAt != null) {
        dismissedNoticeAt = currentNoticeAt;
        writeDismissedNotice(dismissedNoticeAt);
      }
    },
    dispose() {
      unsubscribe();
    },
  };
}

function readDismissedNotice(): number | null {
  try {
    const raw = localStorage.getItem(NOTICE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeDismissedNotice(at: number): void {
  try {
    localStorage.setItem(NOTICE_KEY, String(at));
  } catch {
    // storage unavailable; the notice may reappear on the next update
  }
}
