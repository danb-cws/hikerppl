---
id: hikerppl-architecture
type: architecture-design
title: HikerPPL Architecture
status: active
parent: hikerppl-goal-and-requirements
tags: [architecture, firebase, pwa, mapping]
---

# HikerPPL Architecture

## Overview

HikerPPL is a static PWA on GitHub Pages plus one managed realtime backend (Firebase). The PWA is a
single-page map; the backend is the only place shared state lives. The leader writes today's track and
waypoints to Firebase, and every member subscribes to the same node and watches the route update live.
The app shell and the OSM-based tile layer work offline; the OS Maps layer and live updates need signal.

## Decisions

### Backend: Firebase Realtime Database + Cloud Functions

The live route and the 3am wipe need somewhere to live, and GitHub Pages runs no server code. Firebase
Realtime Database (RTDB) was chosen over Firestore and over a self-hosted backend:

- **RTDB over Firestore.** One shared node read by ~100 anonymous listeners is RTDB's sweet spot —
  bandwidth-based and cheap for many readers on a single path. Firestore bills per read/write, which
  would charge for every member's every update.
- **Cloud Functions + Cloud Scheduler for the wipe.** A scheduled function deletes the day's node.
- **Not RNS/LXMF now.** The distributed option stays a non-goal: Reticulum can't run in a browser, so it
  would block the pure-browser PWA. The backend is the only reason the app needs network at all.

### Map: Leaflet with raster tile layers

Leaflet drives the map, on vanilla TypeScript (no framework — the UI is one map plus a publish toggle,
so a framework adds nothing). All three layers are raster tiles, which is exactly what Leaflet is for;
MapLibre's vector-tile machinery is unnecessary here.

- OSM base layer (raster), tile-cached offline.
- Waymarked Trails hiking overlay (raster), tile-cached offline.
- Ordnance Survey Maps API (online-only), keyed with an OS API key that ships client-side (unavoidable
  for a tile API).

### Auth: anonymous members, one fixed leader credential

Members are anonymous and read-only. The leader signs into Firebase Auth with one fixed email/password
account; the credential is entered at publish time and is not shipped in the app bundle. RTDB rules:
`.read: true`, `.write: auth.uid == <leader-uid>`.

## Components

The PWA is one SPA with five modules; each gets a module spec as it is built.

| Module | Owns | Depends on |
| --- | --- | --- |
| app-shell | manifest, service worker, install/update, offline tile cache | map, positioning |
| map | Leaflet instance and the three layers | — |
| positioning | Geolocation position and the heading arrow | — |
| leader-publish | Firebase sign-in, track and waypoint upload | firebase-backend |
| follower-sync | subscribe to today's node, render the leader's route | map, firebase-backend |

The daily wipe is backend-only — a Cloud Function, not part of the PWA (see `hikerppl-firebase-backend`).

## Repository layout

- `src/` — the PWA SPA, one directory per module (`app-shell`, `map`, `positioning`, `leader-publish`,
  `follower-sync`), each with its own `SPEC.md`.
- `functions/` — the Firebase backend: security rules and the wipe Cloud Function
  (`hikerppl-firebase-backend`).

## Data model

Shared state is keyed by calendar date and wiped wholesale at the daily wipe; the full schema, date
convention, and security rules live in `hikerppl-firebase-backend`. Publishing cadence and point thinning
are a leader-publish concern, not an architecture invariant.

## Offline

- The service worker caches the app shell and, cache-first, the OSM and Waymarked Trails tiles as they
  are viewed (on-demand — no region pre-caching in the first build).
- The OS Maps layer is never cached, per its terms.
- Firebase RTDB's offline persistence keeps the last-seen route locally, so members without signal still
  see the map plus the leader's last published route.

## Deployment

- GitHub Actions builds the SPA and deploys to GitHub Pages.
- The wipe Cloud Function deploys via the Firebase CLI from the same repo.

## Invariants

- Shared state lives only in Firebase, keyed by date; nothing shared is stored in the PWA beyond the
  SDK's local cache.
- The wipe deletes the whole day's node — waypoints and tracks always go together.
- The OS Maps layer is never cached offline.
