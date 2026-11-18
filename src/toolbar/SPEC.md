---
id: hikerppl-toolbar
type: module-design
title: Toolbar
status: draft
parent: hikerppl-architecture
---

# Toolbar

## Purpose

The icon-only top toolbar and the app's dialogs and popups, in two states: normal member and signed-in
leader.

## Owns

- The toolbar: layers dropdown, fullscreen toggle (with a top-left restore icon), record media controls,
  waypoint, distance readout, settings gear, and the leader hat icon.
- The Settings sheet (units, track colour, leader section) and the minimal leader sign-in dialog.
- The only two popups — the broadcast prompt and the text notice — plus the rejoin indicator and the
  long-press track details dialog.

## Boundary

- Renders and dispatches only; it holds no business state and writes nothing to Firebase.
- Drives the map's layer API and fullscreen; reads `settings` for units and track colour.

## Decisions

- Fullscreen hides the toolbar and leaves a top-left floating restore icon.
- Leader-only controls (broadcast, notice) appear in the toolbar only when signed in; the hat icon is
  outline when signed out and solid when signed in.
