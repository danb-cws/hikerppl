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

export interface MapApi {
  setOwnPosition(fix: PositionFix): void;
  addLeaderRoute(points: LatLng[]): void;
  clearLeaderRoute(): void;
  addWaypoints(waypoints: Waypoint[]): void;
  clearWaypoints(): void;
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

export function createMap(el: HTMLElement): MapApi {
  const map = L.map(el, { zoomControl: true }).setView([54.5, -2.5], 7);

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

  const baseLayers: { name: string; layer: L.Layer; active: boolean }[] = [
    { name: 'Topo', layer: topo, active: true },
    { name: 'OSM', layer: osmStack, active: false },
  ];
  if (osLayer) baseLayers.push({ name: 'OS', layer: osLayer, active: false });

  for (const entry of baseLayers) {
    if (entry.active) entry.layer.addTo(map);
  }

  const ownDot = L.circleMarker([0, 0], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#1a7a4c',
    fillOpacity: 1,
    interactive: false,
  }).addTo(map);

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

  const leaderRoute = L.polyline([], { color: '#e63946', weight: 4 }).addTo(map);
  const waypointLayer = L.layerGroup().addTo(map);

  let firstFix = true;

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
      leaderRoute.setLatLngs(points.map((p) => L.latLng(p.lat, p.lng)));
    },
    clearLeaderRoute() {
      leaderRoute.setLatLngs([]);
    },
    addWaypoints(waypoints) {
      waypointLayer.clearLayers();
      for (const wp of waypoints) {
        L.circleMarker([wp.lat, wp.lng], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: '#e63946',
          fillOpacity: 1,
        })
          .bindTooltip(wp.label ?? 'Waypoint')
          .addTo(waypointLayer);
      }
    },
    clearWaypoints() {
      waypointLayer.clearLayers();
    },
  };

  addLayerSwitch(map, baseLayers);

  return api;
}

function addLayerSwitch(
  map: L.Map,
  layers: { name: string; layer: L.Layer; active: boolean }[],
): void {
  const control = new L.Control({ position: 'topright' });
  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'hikerppl-layer-switch');
    const buttons: HTMLElement[] = [];
    for (const entry of layers) {
      const btn = L.DomUtil.create('button', 'hikerppl-layer-btn', container);
      btn.textContent = entry.name;
      if (entry.active) btn.classList.add('is-active');
      btn.addEventListener('click', () => {
        for (let i = 0; i < layers.length; i++) {
          if (layers[i].active) {
            layers[i].active = false;
            map.removeLayer(layers[i].layer);
            buttons[i].classList.remove('is-active');
          }
        }
        entry.active = true;
        map.addLayer(entry.layer);
        btn.classList.add('is-active');
      });
      buttons.push(btn);
    }
    return container;
  };
  control.addTo(map);
}
