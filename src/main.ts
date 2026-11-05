import { createMap } from './map/map';
import { startPositioning, type PositionFix } from './positioning/positioning';
import { createLeaderPublish } from './leader-publish/leader-publish';
import { startFollowing } from './follower-sync/follower-sync';
import { registerServiceWorker } from './app-shell/register-sw';
import './style.css';

const map = createMap(document.getElementById('map')!);
const statusEl = document.getElementById('status')!;

let lastFix: PositionFix | null = null;

const leader = createLeaderPublish(document.getElementById('leader-panel')!, () => lastFix);
startFollowing(map);

startPositioning(
  (fix) => {
    lastFix = fix;
    statusEl.textContent = `±${Math.round(fix.accuracy)} m`;
    map.setOwnPosition(fix);
    leader.onPosition(fix);
  },
  () => {
    statusEl.textContent = 'GPS unavailable';
  },
);

if (import.meta.env.PROD) {
  registerServiceWorker();
}
