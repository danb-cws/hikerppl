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
const OS_ATTRIBUTION = `&copy; Crown copyright and database rights ${new Date().getFullYear()} Ordnance Survey`;

export function createMap(el: HTMLElement): MapApi {
  const map = L.map(el, { zoomControl: true }).setView([54.5, -2.5], 7);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  });

  const hiking = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: WAYMARKED_ATTRIBUTION,
  });

  const osKey = import.meta.env.VITE_OS_MAPS_API_KEY as string | undefined;
  const osLayer = osKey
    ? L.tileLayer(`https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${osKey}`, {
        maxZoom: 16,
        attribution: OS_ATTRIBUTION,
      })
    : null;

  // OS Outdoor is the default layer when the key is present; otherwise OSM + hiking overlay.
  if (osLayer) {
    osLayer.addTo(map);
  } else {
    osm.addTo(map);
    hiking.addTo(map);
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

  if (osLayer) {
    addLayerSwitch(map, osm, hiking, osLayer);
  }

  return api;
}

function addLayerSwitch(map: L.Map, osm: L.TileLayer, hiking: L.TileLayer, os: L.TileLayer): void {
  let premium = true;

  const control = new L.Control({ position: 'topright' });
  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'hikerppl-layer-switch');
    const osmBtn = L.DomUtil.create('button', 'hikerppl-layer-btn', container);
    const osBtn = L.DomUtil.create('button', 'hikerppl-layer-btn', container);
    osmBtn.textContent = 'OSM';
    osBtn.textContent = 'OS';
    osBtn.classList.add('is-active');

    const setLayer = (premiumLayer: boolean) => {
      if (premiumLayer === premium) return;
      premium = premiumLayer;
      if (premiumLayer) {
        osm.remove();
        hiking.remove();
        os.addTo(map);
      } else {
        map.removeLayer(os);
        osm.addTo(map);
        hiking.addTo(map);
      }
      osmBtn.classList.toggle('is-active', !premiumLayer);
      osBtn.classList.toggle('is-active', premiumLayer);
    };

    osmBtn.addEventListener('click', () => setLayer(false));
    osBtn.addEventListener('click', () => setLayer(true));
    return container;
  };
  control.addTo(map);
}
