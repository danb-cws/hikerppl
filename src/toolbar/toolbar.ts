import { formatDistance, type Settings } from '../settings';
import type { RecorderState } from '../track-recorder/track-recorder';

export interface LeaderState {
  signedIn: boolean;
  name: string | null;
  broadcasting: boolean;
}

export interface TrackDetails {
  id: string;
  length: string;
  date: string;
}

export interface ToolbarCallbacks {
  onLayerSelect(name: string): void;
  onToggleFullscreen(): void;
  onRecord(): void;
  onPause(): void;
  onStopSave(): void;
  onDropWaypoint(): void;
  onSettingsChange(settings: Settings): void;
  onLeaderSignIn(name: string, password: string): void;
  onLeaderSignOut(): void;
  onToggleBroadcast(): void;
  onSendNotice(text: string): void;
  onBroadcastShow(): void;
  onBroadcastDismiss(): void;
  onRejoin(): void;
  onNoticeDismiss(): void;
  onTrackDelete(id: string): void;
}

export interface ToolbarApi {
  setLayers(names: string[], active: string): void;
  setRecorderState(state: RecorderState): void;
  setDistance(meters: number): void;
  setSettings(settings: Settings): void;
  setLeaderState(state: LeaderState): void;
  setFullscreen(active: boolean): void;
  showBroadcastPrompt(name: string): void;
  hideBroadcastPrompt(): void;
  setLiveIndicator(visible: boolean): void;
  showNotice(from: string, text: string): void;
  showTrackDetails(details: TrackDetails): void;
  dispose(): void;
}

const ICONS = {
  layers:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="9.5" width="16" height="5" rx="1"/><rect x="4" y="15" width="16" height="5" rx="1"/></svg>',
  fullscreen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exitFullscreen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  record:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="4" height="10" rx="1" fill="currentColor"/><rect x="13" y="7" width="4" height="10" rx="1" fill="currentColor"/></svg>',
  stop:
    '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/></svg>',
  waypoint:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 14 6 14s6-9.5 6-14c0-3.3-2.7-6-6-6z"/><circle cx="12" cy="8" r="2.4" fill="currentColor" stroke="none"/></svg>',
  broadcast:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M8 9a5.6 5.6 0 0 0 0 6M16 9a5.6 5.6 0 0 1 0 6M5.4 6.4a9.2 9.2 0 0 0 0 11.2M18.6 6.4a9.2 9.2 0 0 1 0 11.2"/></svg>',
  notice:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5" stroke-linecap="round"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h13M20 12h0"/><circle cx="15.5" cy="7" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="17" r="2"/></svg>',
  hatOutline:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 9.8 a6.2 6.2 0 0 1 12.4 0"/><path d="M5.4 9.8 h13.2 l-1.9 2.3 H7.3 z"/><circle cx="12" cy="14" r="3.4"/><path d="M4.5 21 c1.7-4.4 4.5-6.2 7.5-6.2 s5.8 1.8 7.5 6.2"/></svg>',
  hatSolid:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.6 9.6 a6.4 6.4 0 0 1 12.8 0 z"/><path d="M5.2 9.6 h13.6 l-2 2.5 H7.2 z"/><circle cx="12" cy="14.4" r="3.8"/><path d="M4 21.6 c1.7-4.6 4.6-6.5 8-6.5 s6.3 1.9 8 6.5 z"/></svg>',
};

export function createToolbar(container: HTMLElement, cb: ToolbarCallbacks): ToolbarApi {
  let settings: Settings = { units: 'km', trackColor: '#ec4899' };
  let leaderState: LeaderState = { signedIn: false, name: null, broadcasting: false };
  let activeLayerName = '';

  // ---- toolbar bar ----
  const bar = el('div', 'hikerppl-toolbar');

  const layersBtn = iconBtn(ICONS.layers, 'Layers');
  layersBtn.classList.add('hikerppl-has-menu');
  const fullscreenBtn = iconBtn(ICONS.fullscreen, 'Fullscreen');

  const recordBtn = iconBtn(ICONS.record, 'Record');
  recordBtn.classList.add('hikerppl-rec');
  const pauseBtn = iconBtn(ICONS.pause, 'Pause');
  const stopBtn = iconBtn(ICONS.stop, 'Stop & save GPX');
  const waypointBtn = iconBtn(ICONS.waypoint, 'Drop named waypoint');
  const media = el('div', 'hikerppl-media');
  media.append(recordBtn, pauseBtn, stopBtn);

  const distanceEl = el('span', 'hikerppl-distance', '0.00 km');

  const broadcastBtn = iconBtn(ICONS.broadcast, 'Broadcast live');
  broadcastBtn.classList.add('hikerppl-leader-only', 'hikerppl-hidden');
  const noticeBtn = iconBtn(ICONS.notice, 'Send notice');
  noticeBtn.classList.add('hikerppl-leader-only', 'hikerppl-hidden');
  const liveDot = el('span', 'hikerppl-live-dot hikerppl-hidden');
  liveDot.title = 'Live broadcast — tap to view';
  const settingsBtn = iconBtn(ICONS.settings, 'Settings');
  const hatBtn = iconBtn(ICONS.hatOutline, 'Leader sign-in');

  const leftGroup = el('div', 'hikerppl-toolbar-group');
  leftGroup.append(layersBtn, fullscreenBtn, divider(), media, waypointBtn);

  const rightGroup = el('div', 'hikerppl-toolbar-group');
  rightGroup.append(broadcastBtn, noticeBtn, liveDot, settingsBtn, hatBtn);

  const center = el('div', 'hikerppl-toolbar-center');
  center.appendChild(distanceEl);
  bar.append(leftGroup, center, rightGroup);

  // ---- layers dropdown ----
  const layersMenu = el('div', 'hikerppl-menu hikerppl-menu-left hikerppl-hidden');
  layersMenu.setAttribute('role', 'menu');

  // ---- leader popover (sign-in / signed-in menu) ----
  const leaderPopover = el('div', 'hikerppl-menu hikerppl-menu-right hikerppl-hidden');
  leaderPopover.style.minWidth = '220px';

  // ---- settings sheet ----
  const sheet = el('div', 'hikerppl-sheet hikerppl-hidden');
  const sheetCard = el('div', 'hikerppl-sheet-card');
  sheet.appendChild(sheetCard);

  // ---- fullscreen floating icon ----
  const fsFloat = iconBtn(ICONS.exitFullscreen, 'Exit fullscreen');
  fsFloat.classList.add('hikerppl-fs-float', 'hikerppl-hidden');

  // ---- broadcast prompt popup ----
  const broadcastPrompt = el('div', 'hikerppl-popup hikerppl-hidden');
  const broadcastPromptBody = el('div', '');
  broadcastPrompt.appendChild(broadcastPromptBody);

  // ---- notice popup ----
  const noticePopup = el('div', 'hikerppl-notice hikerppl-hidden');

  // ---- track details popup ----
  const trackDetails = el('div', 'hikerppl-popup hikerppl-hidden');
  trackDetails.style.width = '250px';

  container.append(bar, layersMenu, leaderPopover, sheet, fsFloat, broadcastPrompt, noticePopup, trackDetails);

  // ---- rendering helpers ----
  const renderLayers = () => {
    layersMenu.textContent = '';
    const title = el('div', 'hikerppl-menu-title', 'Map layer');
    layersMenu.appendChild(title);
    for (const name of layerNames) {
      const item = el('div', 'hikerppl-menu-item', name);
      if (name === activeLayerName) item.classList.add('is-active');
      item.addEventListener('click', () => {
        cb.onLayerSelect(name);
        closeMenus();
      });
      layersMenu.appendChild(item);
    }
  };

  const renderLeaderPopover = () => {
    leaderPopover.textContent = '';
    if (leaderState.signedIn) {
      const title = el('div', 'hikerppl-menu-title', `Signed in as ${leaderState.name ?? 'leader'}`);
      leaderPopover.appendChild(title);
      const signOut = el('div', 'hikerppl-menu-item', 'Sign out');
      signOut.addEventListener('click', () => {
        cb.onLeaderSignOut();
        closeMenus();
      });
      leaderPopover.appendChild(signOut);
    } else {
      const title = el('div', 'hikerppl-menu-title', 'Sign in as leader');
      leaderPopover.appendChild(title);
      const nameField = inputField('Name');
      const passwordField = inputField('Password');
      passwordField.querySelector('input')!.type = 'password';
      leaderPopover.append(nameField, passwordField);
      const signIn = el('button', 'hikerppl-btn', 'Sign in');
      signIn.addEventListener('click', () => {
        const name = nameField.querySelector('input')!.value.trim();
        const password = passwordField.querySelector('input')!.value;
        if (name && password) cb.onLeaderSignIn(name, password);
        closeMenus();
      });
      leaderPopover.appendChild(signIn);
    }
  };

  const renderSettings = () => {
    sheetCard.textContent = '';
    const title = el('h3', 'hikerppl-sheet-title', 'Settings');
    sheetCard.appendChild(title);

    sheetCard.appendChild(el('div', 'hikerppl-sheet-sec', 'Units'));
    const unitsOpt = el('div', 'hikerppl-opt', '');
    unitsOpt.appendChild(el('span', '', 'Distance'));
    const seg = el('div', 'hikerppl-seg');
    const km = el('span', settings.units === 'km' ? 'on' : '', 'km');
    const mi = el('span', settings.units === 'mi' ? 'on' : '', 'miles');
    km.addEventListener('click', () => cb.onSettingsChange({ ...settings, units: 'km' }));
    mi.addEventListener('click', () => cb.onSettingsChange({ ...settings, units: 'mi' }));
    seg.append(km, mi);
    unitsOpt.appendChild(seg);
    sheetCard.appendChild(unitsOpt);

    sheetCard.appendChild(el('div', 'hikerppl-sheet-sec', 'Track'));
    const colorOpt = el('div', 'hikerppl-opt', '');
    colorOpt.appendChild(el('span', '', 'Track colour'));
    const swatches = el('div', 'hikerppl-swatches');
    for (const color of ['#ec4899', '#f97316', '#22c55e', '#38bdf8', '#8b5cf6']) {
      const sw = el('span', 'hikerppl-swatch');
      sw.style.background = color;
      if (color === settings.trackColor) sw.classList.add('on');
      sw.addEventListener('click', () => cb.onSettingsChange({ ...settings, trackColor: color }));
      swatches.appendChild(sw);
    }
    colorOpt.appendChild(swatches);
    sheetCard.appendChild(colorOpt);

    if (leaderState.signedIn) {
      sheetCard.appendChild(el('div', 'hikerppl-sheet-sec', 'Leader'));
      const who = el('div', 'hikerppl-opt', '');
      who.appendChild(el('span', '', 'Signed in as'));
      who.appendChild(el('b', '', leaderState.name ?? 'leader'));
      sheetCard.appendChild(who);
      const signOut = el('div', 'hikerppl-opt hikerppl-signout', 'Sign out');
      signOut.addEventListener('click', () => cb.onLeaderSignOut());
      sheetCard.appendChild(signOut);
    }

    const close = el('button', 'hikerppl-btn', 'Close');
    close.addEventListener('click', () => sheet.classList.add('hikerppl-hidden'));
    sheetCard.appendChild(close);
  };

  const closeMenus = () => {
    layersMenu.classList.add('hikerppl-hidden');
    leaderPopover.classList.add('hikerppl-hidden');
  };

  // ---- events ----
  layersBtn.addEventListener('click', () => {
    renderLayers();
    leaderPopover.classList.add('hikerppl-hidden');
    layersMenu.classList.toggle('hikerppl-hidden');
  });

  hatBtn.addEventListener('click', () => {
    renderLeaderPopover();
    layersMenu.classList.add('hikerppl-hidden');
    leaderPopover.classList.toggle('hikerppl-hidden');
  });

  fullscreenBtn.addEventListener('click', () => cb.onToggleFullscreen());
  fsFloat.addEventListener('click', () => cb.onToggleFullscreen());
  recordBtn.addEventListener('click', () => cb.onRecord());
  pauseBtn.addEventListener('click', () => cb.onPause());
  stopBtn.addEventListener('click', () => cb.onStopSave());
  waypointBtn.addEventListener('click', () => cb.onDropWaypoint());
  settingsBtn.addEventListener('click', () => {
    closeMenus();
    renderSettings();
    sheet.classList.remove('hikerppl-hidden');
  });
  broadcastBtn.addEventListener('click', () => cb.onToggleBroadcast());
  noticeBtn.addEventListener('click', () => {
    const text = (window.prompt('Notice text', '') ?? '').trim();
    if (text) cb.onSendNotice(text);
  });
  liveDot.addEventListener('click', () => cb.onRejoin());

  // ---- broadcast prompt ----
  const renderBroadcastPrompt = (name: string) => {
    broadcastPromptBody.textContent = '';
    const h = el('h3', '', `${name} is live tracking`);
    const p = el('p', '', "Show their route and waypoints on your map?");
    const row = el('div', 'hikerppl-btnrow');
    const show = el('span', 'hikerppl-btn hikerppl-btn-green', 'Show');
    const dismiss = el('span', 'hikerppl-btn hikerppl-btn-ghost', 'Dismiss');
    show.addEventListener('click', () => cb.onBroadcastShow());
    dismiss.addEventListener('click', () => cb.onBroadcastDismiss());
    row.append(show, dismiss);
    broadcastPromptBody.append(h, p, row);
  };

  // ---- notice ----
  const renderNotice = (from: string, text: string) => {
    noticePopup.textContent = '';
    const x = el('span', 'hikerppl-notice-x', '✕');
    x.addEventListener('click', () => {
      noticePopup.classList.add('hikerppl-hidden');
      cb.onNoticeDismiss();
    });
    const b = el('b', '', `Notice from ${from}`);
    const t = el('span', '', text);
    noticePopup.append(x, b, t);
  };

  // ---- track details ----
  const renderTrackDetails = (details: TrackDetails) => {
    trackDetails.textContent = '';
    const h = el('h3', '', 'My track');
    const meta = el('p', 'hikerppl-track-meta', `${details.length} · ${details.date}`);
    const del = el('span', 'hikerppl-btn hikerppl-btn-danger', 'Delete');
    del.addEventListener('click', () => {
      cb.onTrackDelete(details.id);
      trackDetails.classList.add('hikerppl-hidden');
    });
    trackDetails.append(h, meta, del);
  };

  // ---- public API ----
  return {
    setLayers(names, active) {
      layerNames = names;
      activeLayerName = active;
      renderLayers();
    },
    setRecorderState(state) {
      recordBtn.classList.toggle('active', state === 'recording');
      pauseBtn.classList.toggle('active', state === 'paused');
    },
    setDistance(meters) {
      currentDistance = meters;
      distanceEl.textContent = formatDistance(meters, settings.units);
    },
    setSettings(next) {
      settings = next;
      distanceEl.textContent = formatDistance(currentDistance, settings.units);
      if (!sheet.classList.contains('hikerppl-hidden')) renderSettings();
    },
    setLeaderState(next) {
      leaderState = next;
      hatBtn.innerHTML = next.signedIn ? ICONS.hatSolid : ICONS.hatOutline;
      broadcastBtn.classList.toggle('hikerppl-hidden', !next.signedIn);
      noticeBtn.classList.toggle('hikerppl-hidden', !next.signedIn);
      broadcastBtn.classList.toggle('active', next.broadcasting);
      if (!sheet.classList.contains('hikerppl-hidden')) renderSettings();
    },
    setFullscreen(active) {
      bar.classList.toggle('hikerppl-hidden', active);
      fsFloat.classList.toggle('hikerppl-hidden', !active);
      if (active) closeMenus();
    },
    showBroadcastPrompt(name) {
      renderBroadcastPrompt(name);
      broadcastPrompt.classList.remove('hikerppl-hidden');
    },
    hideBroadcastPrompt() {
      broadcastPrompt.classList.add('hikerppl-hidden');
    },
    setLiveIndicator(visible) {
      liveDot.classList.toggle('hikerppl-hidden', !visible);
    },
    showNotice(from, text) {
      renderNotice(from, text);
      noticePopup.classList.remove('hikerppl-hidden');
    },
    showTrackDetails(details) {
      renderTrackDetails(details);
      trackDetails.classList.remove('hikerppl-hidden');
    },
    dispose() {
      container.removeChild(bar);
      container.removeChild(layersMenu);
      container.removeChild(leaderPopover);
      container.removeChild(sheet);
      container.removeChild(fsFloat);
      container.removeChild(broadcastPrompt);
      container.removeChild(noticePopup);
      container.removeChild(trackDetails);
    },
  };
}

// ---- small DOM helpers ----
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconBtn(icon: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hikerppl-toolbar-btn';
  btn.title = title;
  btn.innerHTML = icon;
  return btn;
}

function divider(): HTMLElement {
  return el('div', 'hikerppl-toolbar-divider');
}

function inputField(placeholder: string): HTMLElement {
  const wrap = el('div', 'hikerppl-field');
  const input = document.createElement('input');
  input.placeholder = placeholder;
  wrap.appendChild(input);
  return wrap;
}

// module-level state used across render helpers
let layerNames: string[] = [];
let currentDistance = 0;
