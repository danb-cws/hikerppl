# HikerPPL

> **Status: archived** — this prototype is no longer maintained and is left as-is for reference.

One installable map for the group — see your own location and the leader's live route, even offline.

A progressive web app (PWA) served from GitHub Pages. The leader live-publishes their track; every
member sees that route alongside their own GNSS position and heading. Works without signal: the app
shell and OSM-based tiles are cached, and the last-published route stays on screen.

## Architecture

- **Static PWA** (Vite + TypeScript + Leaflet) on GitHub Pages — no app-store review, installable,
  self-updating via the service worker.
- **Firebase Realtime Database** backend — the leader writes today's track/waypoints, members subscribe;
  a scheduled Cloud Function wipes the previous day's data at 03:00 Europe/London.
- **Map layers** (all raster):
  - OpenTopoMap — the default: contours + OSM footpaths, tile-cached.
  - OSM base + Waymarked Trails hiking overlay — the offline fallback, tile-cached.
  - Ordnance Survey Maps API, `Outdoor_3857` style — optional (needs an OS key), online-only.

Module specs live beside each module under `src/*/SPEC.md`; the architecture is in `architecture.md`.

## Local development

```bash
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # dev server
npm run build          # type-check + production bundle
```

Without any env values the app still runs: the OS layer is hidden and live sync is disabled.

## Environment variables

| Variable | Purpose | Required |
| --- | --- | --- |
| `VITE_OS_MAPS_API_KEY` | Ordnance Survey Maps API key | No — hides the OS layer when absent |
| `VITE_FIREBASE_API_KEY` | Firebase web app config | No — disables live sync when absent |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web app config | No |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database URL | No |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project id | No |

## Deployment

The site is live at **https://scaledsimplicity.co.uk/hikerppl/** (repo is public; GitHub Pages uses the
GitHub Actions source). `deploy-pages.yml` builds on every push to `main`; `deploy-firebase.yml` deploys
the security rules and the wipe function.

### 1. Ordnance Survey maps (OS Maps API)

- At [osdatahub.os.uk](https://osdatahub.os.uk), create an API project and add the **OS Maps API**
  (raster) — *not* the OS Vector Tile API or OS NGD API – Tiles (those are vector and need MapLibre).
- Create an **API Key** (not OAuth2) for that project.
- The app uses the **`Outdoor_3857`** layer (Web Mercator Outdoor style). To change the look, edit the
  layer name in `src/map/map.ts` — options are `Outdoor_3857`, `Road_3857`, `Light_3857`.
  (`Leisure_*` is British National Grid only and cannot sit beside the Web Mercator OSM base.)
- Add the key as the `OS_MAPS_API_KEY` GitHub secret (and as `VITE_OS_MAPS_API_KEY` in `.env`).

The free **OS OpenData** plan is enough for the OS OpenData layers in these styles.

### 2. Firebase (live sync + 3am wipe)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and enable
   **Realtime Database**.
2. In **Authentication**, add the leader as an email/password user, then copy that user's **UID**.
3. Replace `LEADER_UID` in `database.rules.json` with that UID.
4. Replace `hikerppl` in `.firebaserc` with your project id.
5. From **Project settings → Your apps → web app**, copy `apiKey`, `authDomain`, `databaseURL`, and
   `projectId` into the `VITE_FIREBASE_*` GitHub secrets.
6. Create a **service account** for deploys and add its JSON key as the `FIREBASE_SERVICE_ACCOUNT`
   secret:
   - GCP Console → **IAM & Admin → Service Accounts → Create service account** (name e.g.
     `firebase-deploy`).
   - Grant it **Firebase Admin** and **Service Account User**.
   - **Keys → Add key → JSON** to download the key file.
   - Store the key file's *entire JSON contents* as the `FIREBASE_SERVICE_ACCOUNT` secret.

### 3. GitHub secrets

| Secret | Used by | Source |
| --- | --- | --- |
| `OS_MAPS_API_KEY` | `deploy-pages.yml` | OS Data Hub API key |
| `VITE_FIREBASE_API_KEY` | `deploy-pages.yml` | Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `deploy-pages.yml` | Firebase web app config |
| `VITE_FIREBASE_DATABASE_URL` | `deploy-pages.yml` | Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | `deploy-pages.yml` | Firebase web app config |
| `FIREBASE_SERVICE_ACCOUNT` | `deploy-firebase.yml` | GCP service account JSON key (whole file) |

The `VITE_*` values are baked into the client bundle at build time. That is by design for a static PWA:
the Firebase `apiKey`/`databaseURL`/`projectId` are not secrets (data is protected by the security
rules), and the leader password is entered at publish time, never shipped.

### 4. Re-run a deploy

```bash
git push origin main            # or
gh workflow run deploy-pages.yml
gh workflow run deploy-firebase.yml
```

## The leader

The leader signs in from the app's bottom-right panel with the Firebase account's email and password,
taps **Start publishing**, and their track plus any **Drop waypoint** taps go live for every member.
