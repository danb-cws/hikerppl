import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PositionFix extends LatLng {
  accuracy: number;
  heading?: number | null;
}

export interface Waypoint extends LatLng {
  label?: string;
}

export interface PersonalTrack {
  id: string;
  points: LatLng[];
  color: string;
}

export interface PersonalWaypointView extends LatLng {
  id: string;
  name: string;
  color: string;
}

export interface MapApi {
  setOwnPosition(fix: PositionFix): void;
  addLeaderRoute(points: LatLng[]): void;
  clearLeaderRoute(): void;
  addWaypoints(waypoints: Waypoint[]): void;
  clearWaypoints(): void;
  listLayers(): string[];
  activeLayer(): string;
  setLayer(name: string): void;
  setLeaderColor(color: string): void;
  setLeaderMarker(point: LatLng | null, name: string | null): void;
  setPersonalTracks(tracks: PersonalTrack[]): void;
  onPersonalTrackLongPress(handler: (id: string) => void): void;
  setPersonalWaypoints(waypoints: PersonalWaypointView[]): void;
  onPersonalWaypointLongPress(handler: (id: string) => void): void;
  onMapLongPress(handler: (point: LatLng) => void): void;
  centerOn(point: LatLng, zoom?: number): void;
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const WAYMARKED_ATTRIBUTION =
  '&copy; <a href="https://hiking.waymarkedtrails.org">Waymarked Trails: Hiking</a>';
const TOPO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | ' +
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
  '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
const OS_ATTRIBUTION = `&copy; Crown copyright and database rights ${new Date().getFullYear()} Ordnance Survey`;

const DEFAULT_LEADER_COLOR = '#2563eb';

export function createMap(el: HTMLElement): MapApi {
  const map = L.map(el, { zoomControl: false, attributionControl: false }).setView([54.5, -2.5], 7);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: TOPO_ATTRIBUTION,
  });

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  });

  const hiking = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: WAYMARKED_ATTRIBUTION,
  });

  const osmStack = L.layerGroup([osm, hiking]);

  const osKey = import.meta.env.VITE_OS_MAPS_API_KEY as string | undefined;
  const osLayer = osKey
    ? L.tileLayer(`https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${osKey}`, {
        maxZoom: 16,
        attribution: OS_ATTRIBUTION,
      })
    : null;

  const baseLayers: { name: string; layer: L.Layer }[] = [
    { name: 'Topo', layer: topo },
    { name: 'OSM', layer: osmStack },
  ];
  if (osLayer) baseLayers.push({ name: 'OS', layer: osLayer });

  const DEFAULT_LAYER = 'Topo';
  let activeLayerName = DEFAULT_LAYER;
  baseLayers.find((entry) => entry.name === DEFAULT_LAYER)?.layer.addTo(map);

  const ownDot = L.circleMarker([0, 0], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#1a7a4c',
    fillOpacity: 1,
    interactive: false,
  })
    .bindTooltip('you', {
      permanent: true,
      direction: 'right',
      offset: L.point(9, 0),
      className: 'hikerppl-waypoint-label',
    })
    .addTo(map);

  const ownAccuracy = L.circle([0, 0], {
    radius: 0,
    color: '#1a7a4c',
    weight: 1,
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(map);

  const headingArrow = L.marker([0, 0], {
    interactive: false,
    zIndexOffset: 1001,
    icon: L.divIcon({
      className: 'hikerppl-heading',
      html:
        '<div class="hikerppl-heading-arrow">' +
        '<svg width="30" height="30" viewBox="0 0 30 30"><path d="M15 4 L22 25 L15 20 L8 25 Z" fill="#1a7a4c" stroke="#ffffff" stroke-width="1.5"/></svg>' +
        '</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
  }).addTo(map);

  let leaderColor = DEFAULT_LEADER_COLOR;
  let sharedWaypoints: Waypoint[] = [];

  const leaderRoute = L.polyline([], { color: leaderColor, weight: 4 }).addTo(map);
  const leaderDot = L.circleMarker([0, 0], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: leaderColor,
    fillOpacity: 1,
    interactive: false,
  }).bindTooltip('Leader', {
    permanent: true,
    direction: 'top',
    offset: L.point(0, -12),
    className: 'hikerppl-waypoint-label',
  });
  const waypointLayer = L.layerGroup().addTo(map);
  const personalLayer = L.layerGroup().addTo(map);
  const personalWaypointLayer = L.layerGroup().addTo(map);

  const personalLines = new Map<string, L.Polyline>();
  let personalLongPressHandler: ((id: string) => void) | null = null;
  let personalWaypointLongPressHandler: ((id: string) => void) | null = null;

  let firstFix = true;

  const renderSharedWaypoints = () => {
    waypointLayer.clearLayers();
    for (const wp of sharedWaypoints) {
      L.circleMarker([wp.lat, wp.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: leaderColor,
        fillOpacity: 1,
      })
        .bindTooltip(wp.label ?? 'Waypoint', {
          permanent: true,
          direction: 'top',
          offset: L.point(0, -12),
          className: 'hikerppl-waypoint-label',
        })
        .addTo(waypointLayer);
    }
  };

  const api: MapApi = {
    setOwnPosition(fix) {
      const ll = L.latLng(fix.lat, fix.lng);
      ownDot.setLatLng(ll);
      ownAccuracy.setLatLng(ll);
      ownAccuracy.setRadius(fix.accuracy || 10);
      headingArrow.setLatLng(ll);

      const arrow = headingArrow.getElement()?.querySelector(
        '.hikerppl-heading-arrow',
      ) as HTMLElement | undefined;
      if (arrow) {
        arrow.style.opacity = fix.heading == null ? '0' : '1';
        if (fix.heading != null) arrow.style.transform = `rotate(${fix.heading}deg)`;
      }

      if (firstFix) {
        map.setView(ll, Math.max(map.getZoom(), 15));
        firstFix = false;
      }
    },
    addLeaderRoute(points) {
      leaderRoute.setStyle({ color: leaderColor });
      leaderRoute.setLatLngs(points.map((p) => L.latLng(p.lat, p.lng)));
    },
    clearLeaderRoute() {
      leaderRoute.setLatLngs([]);
    },
    addWaypoints(waypoints) {
      sharedWaypoints = waypoints;
      renderSharedWaypoints();
    },
    clearWaypoints() {
      waypointLayer.clearLayers();
    },
    listLayers() {
      return baseLayers.map((entry) => entry.name);
    },
    activeLayer() {
      return activeLayerName;
    },
    setLayer(name) {
      const entry = baseLayers.find((candidate) => candidate.name === name);
      if (!entry || activeLayerName === name) return;
      for (const base of baseLayers) {
        if (map.hasLayer(base.layer)) map.removeLayer(base.layer);
      }
      entry.layer.addTo(map);
      activeLayerName = name;
    },
    setLeaderColor(color) {
      leaderColor = color;
      leaderRoute.setStyle({ color });
      leaderDot.setStyle({ fillColor: color });
      renderSharedWaypoints();
    },
    setLeaderMarker(point, name) {
      if (!point || !name) {
        leaderDot.remove();
        return;
      }
      leaderDot.setLatLng(L.latLng(point.lat, point.lng));
      leaderDot.setStyle({ fillColor: leaderColor });
      leaderDot.setTooltipContent(name);
      if (!map.hasLayer(leaderDot)) leaderDot.addTo(map);
    },
    setPersonalTracks(tracks) {
      personalLayer.clearLayers();
      personalLines.clear();
      for (const track of tracks) {
        const line = L.polyline(track.points.map((p) => L.latLng(p.lat, p.lng)), {
          color: track.color,
          weight: 4,
          opacity: 0.9,
        });
        line.addTo(personalLayer);
        personalLines.set(track.id, line);
        bindLongPress(line, () => personalLongPressHandler?.(track.id));
      }
    },
    onPersonalTrackLongPress(handler) {
      personalLongPressHandler = handler;
    },
    setPersonalWaypoints(waypoints) {
      personalWaypointLayer.clearLayers();
      for (const wp of waypoints) {
        const marker = L.circleMarker([wp.lat, wp.lng], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: wp.color,
          fillOpacity: 1,
        }).bindTooltip(wp.name, {
          permanent: true,
          direction: 'top',
          offset: L.point(0, -12),
          className: 'hikerppl-waypoint-label',
        });
        marker.addTo(personalWaypointLayer);
        bindLongPress(marker, () => personalWaypointLongPressHandler?.(wp.id));
      }
    },
    onPersonalWaypointLongPress(handler) {
      personalWaypointLongPressHandler = handler;
    },
    onMapLongPress(handler) {
      bindMapLongPress(map, handler);
    },
    centerOn(point, zoom) {
      map.setView(L.latLng(point.lat, point.lng), zoom ?? Math.max(map.getZoom(), 15));
    },
  };

  return api;
}

/** Fires `callback` after a ~550 ms press that does not move beyond a small threshold. */
function bindLongPress(path: L.Path, callback: () => void): void {
  const element = path.getElement();
  if (!element) return;

  let timer: number | null = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  element.addEventListener('pointerdown', (event: Event) => {
    const pointer = event as PointerEvent;
    startX = pointer.clientX;
    startY = pointer.clientY;
    cancel();
    timer = window.setTimeout(() => {
      timer = null;
      callback();
    }, 550);
  });

  element.addEventListener('pointermove', (event: Event) => {
    const pointer = event as PointerEvent;
    if (timer !== null && Math.hypot(pointer.clientX - startX, pointer.clientY - startY) > 12) {
      cancel();
    }
  });

  element.addEventListener('pointerup', cancel);
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('pointerleave', cancel);
}

/** Long-press on empty map space → callback with the pressed lat/lng. */
function bindMapLongPress(map: L.Map, callback: (point: LatLng) => void): void {
  const container = map.getContainer();
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;

  const cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  container.addEventListener('pointerdown', (event: Event) => {
    const pointer = event as PointerEvent;
    startX = pointer.clientX;
    startY = pointer.clientY;
    cancel();
    timer = window.setTimeout(() => {
      timer = null;
      const latlng = map.mouseEventToLatLng(pointer);
      callback({ lat: latlng.lat, lng: latlng.lng });
    }, 550);
  });

  container.addEventListener('pointermove', (event: Event) => {
    const pointer = event as PointerEvent;
    if (timer !== null && Math.hypot(pointer.clientX - startX, pointer.clientY - startY) > 12) {
      cancel();
    }
  });

  container.addEventListener('pointerup', cancel);
  container.addEventListener('pointercancel', cancel);
}
