---
id: hikerppl-track-recorder
type: module-design
title: Track Recorder
status: draft
parent: hikerppl-architecture
---

# Track Recorder

## Purpose

Lets any user record their own track and named waypoints locally, export a GPX, and manage their saved
tracks — personal only, never shared.

## Owns

- The record / pause / resume / stop+save state machine.
- Haversine distance accumulation and km/mi formatting (via `settings`).
- Named waypoints during a recording (prompted at drop time).
- GPX 1.1 export (Blob download) and browser-local persistence (`localStorage`) of saved tracks.
- Delete, and the track metadata (length, date) shown in the long-press details dialog.

## Boundary

- Personal only — never writes to Firebase; the 3am wipe does not touch saved tracks.
- Reads position from positioning; rendering happens in map (personal polylines in the user's colour)
  and the toolbar (record buttons, distance readout, details dialog).

## Decisions

- Point thinning: a point is recorded every ~10 m moved or ~15 s, matching the leader cadence.
- Saved tracks live in `localStorage` under `hikerppl.tracks.v1`; deletion is manual via long-press.
- The personal track colour defaults to pink (`#ec4899`) and is user-changeable in Settings.
