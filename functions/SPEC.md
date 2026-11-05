---
id: hikerppl-firebase-backend
type: module-design
title: Firebase Backend
status: active
parent: hikerppl-architecture
tags: [firebase, backend]
---

# Firebase Backend

## Purpose

The single source of truth for the day's shared data: the schema, who may read or write it, and the
daily wipe.

## Owns

- RTDB schema: `/days/{YYYY-MM-DD}/track` (ordered point array) and `/days/{YYYY-MM-DD}/waypoints`.
- Security rules: `.read: true`; `.write` only by the leader's UID.
- The scheduled wipe Cloud Function.

## Boundary

- Not part of the PWA; deployed from the same repo via the Firebase CLI.
- Owns the data contract that leader-publish and follower-sync code against.

## Decisions

- Dates and the wipe use Europe/London time (the group is UK-based and the OS layer is UK-only).
- The wipe runs at 03:00 Europe/London and deletes every `/days/{date}` node whose date is before today
  (Europe/London). Today's node — and an in-progress hike crossing midnight — is untouched, and the
  previous day's data stays readable until 03:00.

## Deployment

- Firebase config and the OS Maps API key are build-time `VITE_*` env vars (see `.env.example`); the app
  runs without them — the OS layer is hidden and live sync is disabled.
- `database.rules.json` carries a `LEADER_UID` placeholder and `.firebaserc` a `hikerppl` project alias:
  replace both once the Firebase project and the leader account exist. The wipe function deploys from CI
  with a `FIREBASE_TOKEN` secret.
