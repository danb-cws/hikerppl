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
const follower = createFollower({
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
});

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

startPositioning((fix) => {
  map.setOwnPosition(fix);
  recorder.onFix(fix);
  leader.onFix(fix);
  toolbar.setDistance(recorder.getDistanceMeters());
});

if (import.meta.env.PROD) {
  registerServiceWorker();
}
