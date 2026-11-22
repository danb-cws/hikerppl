import { createMap } from './map/map';
import { startPositioning } from './positioning/positioning';
import { createLeader } from './leader-publish/leader-publish';
import { createFollower } from './follower-sync/follower-sync';
import { createRecorder } from './track-recorder/track-recorder';
import { createToolbar } from './toolbar/toolbar';
import { loadSettings, saveSettings, formatDistance } from './settings';
import { registerServiceWorker } from './app-shell/register-sw';
import './style.css';

const map = createMap(document.getElementById('map')!);

let settings = loadSettings();
const recorder = createRecorder();
const leader = createLeader();
const follower = createFollower(
  {
    showBroadcastPrompt(name) {
      toolbar.showBroadcastPrompt(name);
    },
    hideBroadcastPrompt() {
      toolbar.hideBroadcastPrompt();
    },
    setLiveIndicator(visible) {
      toolbar.setLiveIndicator(visible);
    },
    showNotice(from, text) {
      toolbar.showNotice(from, text);
    },
    renderShared(points, waypoints) {
      map.addLeaderRoute(points);
      map.addWaypoints(waypoints);
    },
    clearShared() {
      map.clearLeaderRoute();
      map.clearWaypoints();
    },
    centerOnLeader(point) {
      map.centerOn(point);
    },
  },
  () => leader.isSignedIn(),
);

const renderPersonalTracks = () => {
  map.setPersonalTracks(
    recorder.listSavedTracks().map((t) => ({ id: t.id, points: t.points, color: settings.trackColor })),
  );
};

const pushLeaderState = () => {
  toolbar.setLeaderState({
    signedIn: leader.isSignedIn(),
    name: leader.getName(),
    broadcasting: leader.isBroadcasting(),
  });
};

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
};

const toolbar = createToolbar(document.getElementById('app')!, {
  onLayerSelect(name) {
    map.setLayer(name);
  },
  onToggleFullscreen() {
    toggleFullscreen();
  },
  onRecord() {
    if (recorder.getState() === 'paused') recorder.resume();
    else recorder.start();
  },
  onPause() {
    recorder.pause();
  },
  onStopSave() {
    recorder.stopAndSave();
  },
  onDropWaypoint() {
    const waypoint = recorder.dropWaypoint();
    if (waypoint && leader.isBroadcasting()) {
      leader.pushWaypoint({ lat: waypoint.lat, lng: waypoint.lng, label: waypoint.name });
    }
  },
  onSettingsChange(next) {
    settings = next;
    saveSettings(settings);
    toolbar.setSettings(settings);
    renderPersonalTracks();
  },
  onLeaderSignIn(name, password) {
    leader.signIn(name, password).catch((error: Error) => {
      window.alert(error.message);
    });
  },
  onLeaderSignOut() {
    leader.signOut();
  },
  onToggleBroadcast() {
    leader.setBroadcasting(!leader.isBroadcasting());
    if (leader.isBroadcasting()) showToast('Tracking started');
  },
  onSendNotice(text) {
    leader.sendNotice(text);
  },
  onBroadcastShow() {
    follower.show();
  },
  onBroadcastDismiss() {
    follower.dismiss();
  },
  onRejoin() {
    follower.rejoin();
  },
  onNoticeDismiss() {
    follower.dismissNotice();
  },
  onTrackDelete(id) {
    recorder.deleteTrack(id);
  },
});

recorder.onChanged(() => {
  toolbar.setRecorderState(recorder.getState());
  toolbar.setDistance(recorder.getDistanceMeters());
  renderPersonalTracks();
});

leader.onStateChanged(pushLeaderState);
leader.onConnectionLost(() => showToast('Connection lost'));
leader.onConnectionRestored(() => showToast('Reconnected'));

map.onPersonalTrackLongPress((id) => {
  const track = recorder.listSavedTracks().find((t) => t.id === id);
  if (!track) return;
  toolbar.showTrackDetails({
    id: track.id,
    length: formatDistance(track.distanceMeters, settings.units),
    date: new Date(track.savedAt).toLocaleDateString(),
  });
});

document.addEventListener('fullscreenchange', () => {
  toolbar.setFullscreen(Boolean(document.fullscreenElement));
});

// initial render
toolbar.setLayers(map.listLayers(), map.activeLayer());
toolbar.setSettings(settings);
toolbar.setRecorderState(recorder.getState());
toolbar.setDistance(0);
pushLeaderState();
renderPersonalTracks();

let bestAccuracy = Infinity;
let locationHintShown = false;
const positioningStartedAt = Date.now();

startPositioning((fix) => {
  map.setOwnPosition(fix);
  recorder.onFix(fix);
  leader.onFix(fix);
  toolbar.setDistance(recorder.getDistanceMeters());

  bestAccuracy = Math.min(bestAccuracy, fix.accuracy);
  if (!locationHintShown && Date.now() - positioningStartedAt > 30_000 && bestAccuracy > 1000) {
    locationHintShown = true;
    showLocationHint();
  }
});

if (import.meta.env.PROD) {
  registerServiceWorker();
}

/**
 * Shown once when the device keeps reporting ~1 km+ accuracy, which almost
 * always means the browser was granted "approximate" rather than "precise"
 * location. Guides the user to the OS setting that fixes it.
 */
function showLocationHint(): void {
  if (document.getElementById('hikerppl-location-hint')) return;
  const hint = document.createElement('div');
  hint.id = 'hikerppl-location-hint';
  hint.style.cssText = [
    'position: fixed',
    'left: 12px',
    'right: 12px',
    'bottom: 16px',
    'z-index: 2000',
    'display: flex',
    'align-items: center',
    'gap: 10px',
    'background: rgba(20,23,28,.96)',
    'color: #fff',
    'border: 1px solid rgba(255,255,255,.12)',
    'border-radius: 12px',
    'padding: 12px 14px',
    'font: 13px/1.4 system-ui, sans-serif',
    'box-shadow: 0 12px 34px rgba(0,0,0,.5)',
  ].join(';');

  const text = document.createElement('span');
  text.style.flex = '1';
  text.textContent =
    'Location is approximate. For precise GPS, enable \u201cPrecise location\u201d for this site in your browser\u2019s Location settings.';

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.textContent = 'OK';
  ok.style.cssText = [
    'flex: 0 0 auto',
    'background: #1a7a4c',
    'color: #fff',
    'border: 0',
    'border-radius: 8px',
    'padding: 8px 14px',
    'font: 600 13px/1 system-ui, sans-serif',
    'cursor: pointer',
  ].join(';');
  ok.addEventListener('click', () => hint.remove());

  hint.append(text, ok);
  document.body.appendChild(hint);
}

/** Brief auto-dismissing toast. */
function showToast(text: string): void {
  const existing = document.getElementById('hikerppl-toast');
  const toast = existing ?? document.createElement('div');
  if (!existing) {
    toast.id = 'hikerppl-toast';
    toast.style.cssText = [
      'position: fixed',
      'left: 50%',
      'bottom: 16px',
      'transform: translateX(-50%)',
      'z-index: 2000',
      'background: rgba(20,23,28,.96)',
      'color: #fff',
      'border-radius: 999px',
      'padding: 10px 18px',
      'font: 600 14px/1 system-ui, sans-serif',
      'box-shadow: 0 8px 24px rgba(0,0,0,.5)',
      'pointer-events: none',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.remove('hikerppl-hidden');
  window.setTimeout(() => toast.classList.add('hikerppl-hidden'), 2500);
}
