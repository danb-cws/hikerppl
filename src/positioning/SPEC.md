---
id: hikerppl-positioning
type: module-design
title: Positioning
status: active
parent: hikerppl-architecture
tags: [geolocation, heading]
---

# Positioning

## Purpose

Turns the device's GNSS into the member's dot and heading arrow on the map.

## Owns

- The Geolocation API `watchPosition`; exposes position (lat/lng/accuracy).
- Heading: GPS course (`coords.heading`) when available, else the bearing between consecutive fixes;
  the arrow appears only when moving. The device-orientation compass is deferred (unreliable in a pocket
  and needs calibration).

## Boundary

- Emits position and heading; has no map or Firebase dependency — map consumes them via `setOwnPosition`.
- leader-publish reads position from here when publishing is on.

## Contracts

- Emits at the browser's native rate; consumers set their own cadence — thinning and publishing are not
  done here.
