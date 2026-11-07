---
id: hikerppl-map
type: module-design
title: Map
status: active
parent: hikerppl-architecture
tags: [leaflet, mapping, layers]
---

# Map

## Purpose

The single Leaflet map with its selectable base layers: OpenTopoMap (default), the offline OSM base +
Waymarked Trails hiking overlay, and the optional Ordnance Survey layer.

## Owns

- The Leaflet instance and the layer stack.
- Layer switching (OpenTopoMap / OSM + Waymarked / OS Outdoor).
- Rendering the leader's route and waypoints, and the member's own position and heading arrow.
- Attribution strings (OpenTopoMap, OSM, Waymarked Trails, Ordnance Survey).

## Boundary

- No knowledge of Firebase or positioning sources — it renders only what it is given.
- Exposes `addLeaderRoute` / `clearLeaderRoute`, `addWaypoint` / `clearWaypoints`, `setOwnPosition`.
- The OS Maps layer is drawn here, but its never-cache rule is enforced by app-shell's service worker.

## Contracts

- Coordinates are WGS84 lat/lng.
- The leader's route is an ordered point array, replaced wholesale on each update (never diffed here).

## Decisions

- **OpenTopoMap is the default base layer** (contours + OSM footpaths); OSM + Waymarked Trails is the
  offline fallback; OS `Outdoor_3857` is an optional third layer when the OS key is present.
- The OS layer uses the `Outdoor_3857` Web Mercator style: the iconic `Leisure` style is British National
  Grid only, so it cannot sit beside the Web Mercator OSM base on one Leaflet map. The free OS OpenData
  plan serves Outdoor at roughly 1:50k detail; the premium `Leisure` 1:25k/1:50k cartography is not
  available on it.
