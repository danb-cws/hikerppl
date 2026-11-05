---
id: hikerppl-follower-sync
type: module-design
title: Follower Sync
status: active
parent: hikerppl-architecture
tags: [firebase, realtime]
---

# Follower Sync

## Purpose

Shows every member the leader's live route and waypoints, and keeps the last-seen route on screen when
signal is lost.

## Owns

- Subscribing to `/days` in Firebase RTDB and rendering today's node, so the date rolls over without a
  re-subscribe.
- Passing the leader's route and waypoints to map.
- Offline last-seen: relies on RTDB's offline persistence so the last route stays visible without signal.

## Boundary

- Read-only on Firebase; never writes.
- Depends on map to render; no positioning dependency.

## Contracts

- "Today" follows the backend's date convention (see `hikerppl-firebase-backend`); a day change
  re-subscribes to the new node.
