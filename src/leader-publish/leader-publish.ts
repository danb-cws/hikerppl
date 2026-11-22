import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { get, onValue, push, ref, runTransaction, set } from 'firebase/database';
import { auth, db, firebaseConfigured, leaderEmail } from '../firebase';
import { todayKey } from '../day';
import type { PositionFix } from '../positioning/positioning';

const CADENCE_METERS = 10;
const CADENCE_SECONDS = 15;
const HEARTBEAT_MS = 60_000;
const SESSION_HEARTBEAT_MS = 60_000;
const SESSION_STALE_MS = 20 * 60_000;
const NAME_KEY = 'hikerppl.leaderName';

export interface SharedWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface LeaderApi {
  signIn(name: string, password: string): Promise<void>;
  signOut(): void;
  isSignedIn(): boolean;
  getName(): string | null;
  isBroadcasting(): boolean;
  setBroadcasting(on: boolean): void;
  sendNotice(text: string): void;
  pushWaypoint(waypoint: SharedWaypoint): void;
  onFix(fix: PositionFix): void;
  onStateChanged(cb: () => void): void;
  onConnectionLost(cb: () => void): void;
  onConnectionRestored(cb: () => void): void;
  dispose(): void;
}

export function createLeader(): LeaderApi {
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const cb of listeners) cb();
  };

  const disabled: LeaderApi = {
    signIn: async () => {},
    signOut() {},
    isSignedIn: () => false,
    getName: () => null,
    isBroadcasting: () => false,
    setBroadcasting() {},
    sendNotice() {},
    pushWaypoint() {},
    onFix() {},
    onStateChanged(cb) {
      listeners.add(cb);
    },
    onConnectionLost() {},
    onConnectionRestored() {},
    dispose() {},
  };

  if (!firebaseConfigured || !auth || !db || !leaderEmail) return disabled;

  const authInstance = auth;
  const dbInstance = db;
  const email = leaderEmail;

  let name: string | null = readName();
  let broadcasting = false;
  let lastPoint: { lat: number; lng: number } | null = null;
  let lastSentAt = 0;
  let broadcastStartedAt: number | null = null;
  let heartbeatTimer: number | null = null;
  let sessionId: string | null = null;
  let sessionStartedAt: number | null = null;
  let sessionHeartbeatTimer: number | null = null;

  const writeBroadcast = (active: boolean) => {
    const node = ref(dbInstance, `days/${todayKey()}/broadcast`);
    const now = Date.now();
    const payload = active
      ? { active: true, name: name ?? 'Leader', startedAt: broadcastStartedAt ?? now, lastBeat: now }
      : { active: false, name: name ?? 'Leader', startedAt: 0, lastBeat: 0 };
    return set(node, payload);
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    clearHeartbeat();
    heartbeatTimer = window.setInterval(() => {
      if (broadcasting) writeBroadcast(true).catch(() => {});
    }, HEARTBEAT_MS);
  };

  const sessionRef = () => ref(dbInstance, 'leaderSession');

  const clearSessionHeartbeat = () => {
    if (sessionHeartbeatTimer !== null) {
      window.clearInterval(sessionHeartbeatTimer);
      sessionHeartbeatTimer = null;
    }
  };

  const startSessionHeartbeat = (activeName: string, sid: string) => {
    clearSessionHeartbeat();
    sessionHeartbeatTimer = window.setInterval(() => {
      set(sessionRef(), {
        active: true,
        name: activeName,
        sessionId: sid,
        startedAt: sessionStartedAt ?? Date.now(),
        lastBeat: Date.now(),
      }).catch(() => {});
    }, SESSION_HEARTBEAT_MS);
  };

  const clearSession = async () => {
    clearSessionHeartbeat();
    if (sessionId !== null) {
      await set(sessionRef(), {
        active: false,
        name: name ?? '',
        sessionId,
        startedAt: sessionStartedAt ?? 0,
        lastBeat: 0,
      }).catch(() => {});
    }
    sessionId = null;
    sessionStartedAt = null;
  };

  const claimSession = async (
    activeName: string,
    sid: string,
  ): Promise<{ claimed: boolean; activeName?: string }> => {
    const result = await runTransaction(sessionRef(), (current) => {
      const cur = current?.val() as
        | { active?: boolean; name?: string; sessionId?: string; lastBeat?: number }
        | null;
      const fresh = Boolean(
        cur?.active && typeof cur?.lastBeat === 'number' && Date.now() - cur.lastBeat < SESSION_STALE_MS,
      );
      if (fresh && cur?.sessionId !== sid) {
        return; // abort — another leader holds the session
      }
      return {
        active: true,
        name: activeName,
        sessionId: sid,
        startedAt: Date.now(),
        lastBeat: Date.now(),
      };
    });

    if (result.committed) return { claimed: true };
    const cur = result.snapshot.val() as { name?: string } | null;
    return { claimed: false, activeName: (cur?.name as string) || 'Another leader' };
  };

  const makeId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const unsubscribe = onAuthStateChanged(authInstance, (user) => {
    if (!user) {
      name = null;
      broadcasting = false;
      lastPoint = null;
      lastSentAt = 0;
      broadcastStartedAt = null;
      clearHeartbeat();
      clearSessionHeartbeat();
      sessionId = null;
      sessionStartedAt = null;
      writeName(null);
      emit();
      return;
    }

    emit();
    if (!name) {
      // Restore the display name from the leader session when it's missing
      // locally (e.g. site data was cleared but auth persisted).
      get(sessionRef())
        .then((snap) => {
          const cur = snap.val() as { name?: string } | null;
          if (cur?.name) {
            name = cur.name;
            writeName(cur.name);
            emit();
          }
        })
        .catch(() => {});
    }
  });

  let connected = true;
  let disconnectTimer: number | null = null;
  let lostNotified = false;
  const lostListeners = new Set<() => void>();
  const restoredListeners = new Set<() => void>();

  const notifyLost = () => {
    for (const cb of lostListeners) cb();
  };
  const notifyRestored = () => {
    for (const cb of restoredListeners) cb();
  };

  const unsubscribeConnected = onValue(ref(dbInstance, '.info/connected'), (snap) => {
    const isConnected = snap.val() === true;
    if (isConnected === connected) return;
    connected = isConnected;

    if (connected) {
      if (disconnectTimer !== null) {
        window.clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      if (lostNotified) {
        lostNotified = false;
        notifyRestored();
      }
    } else if (broadcasting) {
      // Two missed heartbeats ≈ two minutes: brief dropouts don't alarm the leader.
      disconnectTimer = window.setTimeout(() => {
        if (!connected && broadcasting) {
          lostNotified = true;
          notifyLost();
        }
      }, 2 * HEARTBEAT_MS);
    }
  });

  return {
    async signIn(inputName, password) {
      try {
        await signInWithEmailAndPassword(authInstance, email, password);
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }

      // Set the display name right away so the UI reflects it immediately.
      name = inputName;
      writeName(inputName);
      emit();

      const sid = makeId();
      let claim: { claimed: boolean; activeName?: string };
      try {
        claim = await claimSession(inputName, sid);
      } catch {
        await signOut(authInstance).catch(() => {});
        throw new Error('Could not sign in as leader — check your connection.');
      }
      if (!claim.claimed) {
        await signOut(authInstance).catch(() => {});
        throw new Error(`${claim.activeName} is already the active leader — they must sign out first.`);
      }
      sessionId = sid;
      sessionStartedAt = Date.now();
      startSessionHeartbeat(inputName, sid);
      emit();
    },
    async signOut() {
      if (broadcasting) {
        broadcasting = false;
        lastPoint = null;
        lastSentAt = 0;
        clearHeartbeat();
        await writeBroadcast(false).catch(() => {});
      }
      await clearSession();
      emit();
      void signOut(authInstance);
    },
    isSignedIn() {
      return authInstance.currentUser != null;
    },
    getName() {
      return name;
    },
    isBroadcasting() {
      return broadcasting;
    },
    setBroadcasting(on) {
      if (on === broadcasting) return;
      broadcasting = on;
      lastPoint = null;
      lastSentAt = 0;
      if (on) {
        broadcastStartedAt = Date.now();
        writeBroadcast(true).catch(() => {});
        startHeartbeat();
      } else {
        clearHeartbeat();
        writeBroadcast(false).catch(() => {});
      }
      emit();
    },
    sendNotice(text) {
      const node = ref(dbInstance, `days/${todayKey()}/notice`);
      set(node, { text, name: name ?? 'Leader', at: Date.now() }).catch(() => {});
    },
    pushWaypoint(waypoint) {
      push(ref(dbInstance, `days/${todayKey()}/waypoints`), waypoint).catch(() => {});
    },
    onFix(fix) {
      if (!broadcasting) return;
      const now = Date.now();
      const moved = lastPoint
        ? Math.hypot(fix.lat - lastPoint.lat, fix.lng - lastPoint.lng) * 111_000 >= CADENCE_METERS
        : true;
      const elapsed = now - lastSentAt >= CADENCE_SECONDS * 1000;
      if (moved || elapsed) {
        lastPoint = { lat: fix.lat, lng: fix.lng };
        lastSentAt = now;
        push(ref(dbInstance, `days/${todayKey()}/track`), { lat: fix.lat, lng: fix.lng }).catch(
          () => {},
        );
      }
    },
    onStateChanged(cb) {
      listeners.add(cb);
    },
    onConnectionLost(cb) {
      lostListeners.add(cb);
    },
    onConnectionRestored(cb) {
      restoredListeners.add(cb);
    },
    dispose() {
      clearHeartbeat();
      clearSessionHeartbeat();
      unsubscribe();
      unsubscribeConnected();
    },
  };
}

function readName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

function writeName(name: string | null): void {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // storage unavailable; name just won't persist across reloads
  }
}

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'auth/network-request-failed') return 'Network error — check your connection.';
  if (code === 'auth/too-many-requests') return 'Too many sign-in attempts — try again later.';
  return 'Incorrect password.';
}
