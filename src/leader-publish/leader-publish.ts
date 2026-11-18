import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { push, ref, set } from 'firebase/database';
import { auth, db, firebaseConfigured, leaderEmail } from '../firebase';
import { todayKey } from '../day';
import type { PositionFix } from '../positioning/positioning';

const CADENCE_METERS = 10;
const CADENCE_SECONDS = 15;
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

  const setBroadcastNode = (active: boolean) => {
    const node = ref(dbInstance, `days/${todayKey()}/broadcast`);
    set(node, { active, name: name ?? 'Leader', startedAt: active ? Date.now() : 0 }).catch(() => {});
  };

  const unsubscribe = onAuthStateChanged(authInstance, (user) => {
    if (!user) {
      name = null;
      broadcasting = false;
      lastPoint = null;
      lastSentAt = 0;
      writeName(null);
    }
    emit();
  });

  return {
    async signIn(inputName, password) {
      await signInWithEmailAndPassword(authInstance, email, password);
      name = inputName;
      writeName(inputName);
      emit();
    },
    signOut() {
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
      setBroadcastNode(on);
      emit();
    },
    sendNotice(text) {
      const node = ref(dbInstance, `days/${todayKey()}/notice`);
      set(node, { text, name: name ?? 'Leader', at: Date.now() }).catch(() => {});
    },
    pushWaypoint(waypoint) {
      if (!broadcasting) return;
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
    dispose() {
      unsubscribe();
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
