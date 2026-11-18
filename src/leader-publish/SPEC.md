---
id: hikerppl-leader-publish
type: module-design
title: Leader Publish
status: active
parent: hikerppl-architecture
tags: [firebase, auth, publishing]
---

# Leader Publish

## Purpose

Lets the one leader sign in with a name + fixed password, broadcast a live track, and send text notices.

## Owns

- Firebase sign-in with the shared leader account: the leader types a display **name** + the fixed
  **password**, authenticated against the build-time `VITE_LEADER_EMAIL`.
- The broadcast on/off toggle; while on, appends the leader's position to today's track node and writes
  the `/days/{date}/broadcast` session node (`active`, `name`, `startedAt`).
- Shared waypoint posting (only while broadcasting) and the text notice node (`text`, `name`, `at`).

## Boundary

- The only PWA module that writes to Firebase; reads position from positioning.
- Renders nothing itself — follower-sync draws the published route via map; the toolbar renders the
  sign-in dialog and leader controls.

## Decisions

- Cadence: while broadcasting, a track point is appended every ~10 m moved or every ~15 s, whichever
  comes first.
- The leader's **name** is a self-asserted display label (persisted in `localStorage`), not a credential;
  the password is the shared secret and is never shipped in the bundle.
