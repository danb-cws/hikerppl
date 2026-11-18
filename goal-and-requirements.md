---
id: hikerppl-goal-and-requirements
type: goal-and-requirements
title: HikerPPL
status: active
tags: [pwa, mapping, hiking, offline]
---

# HikerPPL

One installable map for the group — see your own location and the leader's live route, even offline.

## Overview

HikerPPL is a progressive web app (PWA) served from GitHub Pages, for a hiking group. The leader
live-publishes their route; every other member installs the app and sees that live route alongside their
own GNSS position and heading, so nobody gets lost when the line stretches out. It works on the hill: the
app shell and the OpenStreetMap-based layer cache for offline use. Anonymous members see the shared route
and contribute nothing; the leader publishes it, and the day's shared data is wiped at 3am.

## Problem Statement

On a group hike the line stretches out, gaps build up, and walkers at the back lose the group. There's no
single place to see where the leader is and where you are. HikerPPL is that map: the leader's live route
and your own location, on one installable map that works without signal.

## Target Users

- **Anonymous member** — a walker who installs the PWA to see their own location and follow the leader's
  live route; contributes nothing. Up to ~100.
- **Identified member (leader)** — the one member in the first build who live-publishes their route for
  everyone else.

## Jobs to Be Done

- When the line stretches out, I want to see the leader's live route and my own position, so I don't get
  lost.
- When I have no signal, I want the map to still work, so I can still follow the route.
- When I'm the leader, I want to live-publish my track, so the group can follow me.

## Key User Story

A walker at the back of the group opens HikerPPL on the hill: the map shows their own position and the
leader's live route, so they can see where to catch up — even with no signal, using the cached map.

## Goals

- Show each walker's own location and the leader's live route.
- Let the leader live-publish their track so the group can follow it.
- Keep the map usable with no signal for areas already cached.
- Remove all shared waypoints and tracks automatically each day at 3am.

## Non-Goals

- No full registration or identity system — one shared leader credential (a fixed password for the
  leader role), where the leader's *name* is a display label rather than a separate account.
- No Identified↔Identified text messaging.
- No distributed-versus-classic architecture decision yet (RNS/LXMF remains an open option for later).
- Google Maps is not included — its tiles cannot legally be cached offline, and OS maps are served through
  the official Ordnance Survey API instead.

## Success Conditions

- A member opens the PWA and sees their own position and the leader's live route on the map.
- A member with no signal opens the PWA and still sees the map plus the leader's last published route.
- The leader's route updates on other members' maps as they walk.
- At 3am, the day's waypoints and tracks are gone.

## Capabilities

- **Installable PWA.** Served from GitHub Pages; installs to the home screen and updates itself via the
  service worker. *(One map every member has.)*
- **Own position with a heading arrow.** The member's GNSS location is shown; a direction arrow appears
  when moving. *(Goal 1.)*
- **Leader broadcast (opt-in).** A leader streams their live track and waypoints to Firebase; members
  get a "`<name>` is live tracking" prompt and choose to *show* or *dismiss* it. *(Goals 1 & 2.)*
- **Text notice.** A leader can send a short notice that pops up for every member until dismissed.
- **Personal track recording.** Any user records their own track and named waypoints locally, shown in
  their chosen colour (pink by default) and exportable as a GPX; never shared. *(Goal 1, personal.)*
- **Selectable map layers.** OpenTopoMap (default), OSM base plus the Waymarked Trails hiking overlay
  (offline fallback), and Ordnance Survey's official Maps API for the premium UK look. *(Goal 1.)*
- **Offline tile caching.** The OSM-based layer caches tiles locally (with OSM attribution) so the map
  works without signal; the OS Maps layer is online-only, per its terms. *(Goal 3.)*
- **Daily wipe at 3am.** All shared waypoints and tracks are deleted automatically each day at 3am.
  *(Goal 4.)*

## Technology

| Aspect | Choice | Rationale |
| --- | --- | --- |
| Delivery | PWA on GitHub Pages | No app-store review; installable and self-updating |
| Offline layer | OSM base + Waymarked Trails hiking overlay, tile-cached with attribution | Free and legal to cache offline; hiking-oriented |
| Premium layer | Ordnance Survey Maps API (online-only) | Official UK OS maps; the-hug.net tiles may not be reused |
| Positioning | Browser Geolocation API (GNSS) | Cross-platform; heading from the device's heading / movement |
| Auth (MVP) | One shared leader account: the leader signs in with a display **name** + a fixed **password** against a fixed Firebase email (name is a label, not a credential) | Placeholder until the registration process is designed |
