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

Lets the one identified leader live-publish their track and post waypoints.

## Owns

- Firebase sign-in with the fixed leader credential (entered at publish time, never in the bundle).
- The publish on/off toggle; while on, appends the leader's position to today's track node.
- Waypoint posting.

## Boundary

- The only PWA module that writes to Firebase; reads position from positioning.
- Renders nothing itself — follower-sync draws the published route via map.

## Decisions

- Cadence: while publishing, a track point is appended every ~10 m moved or every ~15 s, whichever comes
  first.
