import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { push, ref } from 'firebase/database';
import { auth, db, firebaseConfigured } from '../firebase';
import { todayKey } from '../day';
import type { PositionFix } from '../positioning/positioning';

const CADENCE_METERS = 10;
const CADENCE_SECONDS = 15;

export interface LeaderPublish {
  onPosition(fix: PositionFix): void;
  dispose(): void;
}

export function createLeaderPublish(
  container: HTMLElement,
  getPosition: () => PositionFix | null,
): LeaderPublish {
  const wrap = document.createElement('div');
  wrap.className = 'leader-panel';
  container.appendChild(wrap);

  if (!firebaseConfigured || !auth || !db) {
    wrap.textContent = 'Live sharing not configured (set VITE_FIREBASE_*).';
    return { onPosition() {}, dispose() {} };
  }

  const authInstance = auth;
  const dbInstance = db;

  const state = {
    publishing: false,
    lastPoint: null as { lat: number; lng: number } | null,
    lastSentAt: 0,
  };

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'Leader email';
  emailInput.autocomplete = 'username';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Password';
  passwordInput.autocomplete = 'current-password';

  const signInBtn = document.createElement('button');
  signInBtn.type = 'submit';
  signInBtn.textContent = 'Sign in';

  const form = document.createElement('form');
  form.append(emailInput, passwordInput, signInBtn);

  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.textContent = 'Start publishing';

  const waypointBtn = document.createElement('button');
  waypointBtn.type = 'button';
  waypointBtn.textContent = 'Drop waypoint';

  const signOutBtn = document.createElement('button');
  signOutBtn.type = 'button';
  signOutBtn.textContent = 'Sign out';

  const controls = document.createElement('div');
  controls.className = 'leader-controls';
  controls.style.display = 'none';
  controls.append(publishBtn, waypointBtn, signOutBtn);

  const status = document.createElement('div');
  status.className = 'leader-status';

  wrap.append(form, controls, status);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    signInBtn.disabled = true;
    signInWithEmailAndPassword(authInstance, emailInput.value, passwordInput.value)
      .catch((err: Error) => {
        status.textContent = err.message;
      })
      .finally(() => {
        signInBtn.disabled = false;
      });
  });

  const unsubscribe = onAuthStateChanged(authInstance, (user) => {
    const signedIn = Boolean(user);
    form.style.display = signedIn ? 'none' : '';
    controls.style.display = signedIn ? '' : 'none';
    if (!signedIn) {
      state.publishing = false;
      publishBtn.textContent = 'Start publishing';
    }
  });

  publishBtn.addEventListener('click', () => {
    state.publishing = !state.publishing;
    publishBtn.textContent = state.publishing ? 'Stop publishing' : 'Start publishing';
  });

  waypointBtn.addEventListener('click', () => {
    const pos = getPosition();
    if (!pos) return;
    push(ref(dbInstance, `days/${todayKey()}/waypoints`), {
      lat: pos.lat,
      lng: pos.lng,
      label: 'Waypoint',
    }).catch(() => {});
  });

  signOutBtn.addEventListener('click', () => {
    void signOut(authInstance);
  });

  return {
    onPosition(fix) {
      if (!state.publishing) return;
      const now = Date.now();
      const moved = state.lastPoint
        ? Math.hypot(fix.lat - state.lastPoint.lat, fix.lng - state.lastPoint.lng) * 111_000 >=
          CADENCE_METERS
        : true;
      const elapsed = now - state.lastSentAt >= CADENCE_SECONDS * 1000;
      if (moved || elapsed) {
        state.lastPoint = { lat: fix.lat, lng: fix.lng };
        state.lastSentAt = now;
        push(ref(dbInstance, `days/${todayKey()}/track`), { lat: fix.lat, lng: fix.lng }).catch(
          () => {},
        );
      }
    },
    dispose() {
      unsubscribe();
    },
  };
}
