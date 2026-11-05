---
id: hikerppl-app-shell
type: module-design
title: App Shell
status: active
parent: hikerppl-architecture
tags: [pwa, service-worker, offline]
---

# App Shell

## Purpose

Makes HikerPPL installable and self-updating, and keeps the map working without signal by caching the
app shell and the OSM-based tiles.

## Owns

- The web app manifest and the service worker.
- The install/update flow: pre-cache the shell, update to the new build when one ships.
- The offline tile cache: cache-first caching of OSM and Waymarked Trails tiles as they are viewed.
- App bootstrap: mounts map and positioning, wires up leader-publish and follower-sync.

## Boundary

- Owns the service worker and the cache; no other module writes to it.
- Never caches the OS Maps layer (online-only per its terms) — that rule lives here, in the SW's URL
  routing.
- Depends on map and positioning to mount them; does not touch Firebase directly.

## Contracts

- Offline caching is on-demand only in the first build — no region pre-caching.
- Attribution is not re-derived here; the map owns the attribution strings, and the SW only caches tiles
  it is asked to fetch.
