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

Lets each member opt in to the leader's broadcast and receive text notices, and keeps the last-seen
route on screen when signal is lost.

## Owns

- Subscribing to `/days` in Firebase RTDB and reading today's node, so the date rolls over without a
  re-subscribe.
- The opt-in flow: when today's broadcast is active, prompt "`<name>` is live tracking" once per session;
  *show* renders the route and waypoints, *dismiss* leaves a toolbar rejoin indicator.
- The text notice popup, dismissed per-member and keyed by the notice's `at` timestamp.
- Offline last-seen: relies on RTDB's offline persistence so the last shown route stays visible without
  signal; a broadcast stop keeps the route, a new broadcast clears it.

## Boundary

- Read-only on Firebase; never writes.
- No positioning dependency; renders via map and prompts via the toolbar.

## Contracts

- "Today" follows the backend's date convention (see `hikerppl-firebase-backend`); a day change
  re-subscribes to the new node.
- A broadcast session is identified by its `startedAt`; opt-in/dismiss state is per session and reset
  when a new session starts.
