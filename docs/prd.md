# Scooter Rideshare Demo App — Product Requirements Document (PRD)

## 1 Overview

Build a browser‑based demo that lets viewers **unlock a virtual scooter and "ride" it across a cute 2‑D side‑scrolling scene** while a mock rideshare panel shows live ride stats (distance, time, token cost) and control buttons (New Ride, End Ride).

---

## 2 Objectives

* **Showcase Temporal‑backed ride workflows** in a playful way (the Temporal piece is off‑screen for this demo).
* Deliver a self‑contained web app that runs without a real back‑end by default, but can point at stubbed REST/WebSocket endpoints when available.
* Keep the codebase modern, approachable, and 100 % open source.

---

## 3 Target Audience & Personas

| Persona                         | Goals                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Demo host (Solutions Architect) | Showcase Temporal concepts quickly, customise visuals, run locally or deploy to Vercel. |
| Prospective customer engineer   | Inspect code, understand how Temporal fits, extend the demo.                            |
| Casual viewer                   | Play with scooter animation, see counters change in real time.                          |

---

## 4 Success Metrics

* ≤ 10 min from git clone to running locally.
* 60 fps animation on modern desktop browsers.
* ≤ 200 ms lag between button press and UI update (with local mock API).
* Clean Lighthouse score > 90 for performance & best‑practices.

---

## 5 Key Features

### 5.1 Side‑Scroller Game Layer

* Rider sprite that moves right when the **→** key is held.
* Parallax scrolling background layers (sky, distant skyline, road).
* Obstacles/landmarks purely decorative—no collision logic required.
* Game state is authoritative **only** for distance travelled; time & cost come from API.

### 5.2 Rideshare HUD (Heads‑Up Display)

* **New Ride** button → POST /ride/start.
* **End Ride** button → POST /ride/end.
* Live counters:

  * **Distance (km)** — derived from game layer or GET /ride/state.
  * **Elapsed Time (hh\:mm)**.
  * **Cost (tokens)** — calculated server‑side, polled every 1 s.
* Disabled state & loading spinners for in‑flight requests.

---

## 6 Technical Architecture

| Layer               | Choice                                  | Rationale                                                            |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| **Bundler**         | **Vite + Vitest**                       | Fast DX, hot‑reload, native TS support.                              |
| **UI Framework**    | **React 18 + TypeScript**               | Familiar to most web devs, strong ecosystem.                         |
| **Game Engine**     | **Phaser 3** (via react‑phaser‑fiber) | Mature 2‑D engine, physics & asset pipeline handled.                 |
| **State Mgmt**      | **Zustand**                             | Simple, TS‑friendly, avoids Redux boilerplate.                       |
| **Data Fetching**   | **React Query (SWR option)**            | Handles retries, cache, polling intervals.                           |
| **Styling**         | **Tailwind CSS + daisyUI**              | Utility‑first, easy theming, playful look.                           |
| **Mock API**        | **msw (Mock Service Worker)**           | Intercepts fetch/WebSocket in dev; switch off to hit real endpoints. |
| **Back‑end (stub)** | Node + Express or FastAPI               | Simple JSON endpoints; eventual hook to Temporal.                    |
| **Deployment**      | Vercel / Netlify static build           | Zero‑config, preview URLs for PRs.                                   |

---

## 7 API Contract (stub)

| Method & Path                 | Req Body     | Resp Body                                                    |
| ----------------------------- | ------------ | ------------------------------------------------------------ |
| **POST** /ride/start        | { userId } | { rideId, startedAt }                                      |
| **POST** /ride/end          | { rideId } | { rideId, endedAt, totalDistanceKm, totalSeconds, tokens } |
| **GET** /ride/state?rideId= | –            | { distanceKm, elapsedSeconds, tokens }                     |

Responses use application/json; error shape { error: string }.

---

## 8 Implementation Plan / Milestones

|  Step                        | Deliverable                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| 0 — Bootstrap                | pnpm create vite@latest scooter-demo --template react-ts; add ESLint + Prettier. |
| 1 — Phaser Scene             | Rider sprite moves & background parallax; mock distance counter in console.        |
| 2 — HUD Skeleton             | React component with buttons & static counters; Tailwind styles.                   |
| 3 — Local State              | Wire HUD to Phaser distance via Zustand; timer via useInterval.                  |
| 4 — Mock API                 | Add msw handlers for /ride/*; switch HUD to pull/push via React Query.           |
| 5 — Visual Polish            | Add sounds, cute sprites, emoji tokens, responsive layout.                         |
| 6 — Back‑end Stub            | Minimal Express server echoing expected JSON; deploy alongside front‑end.          |
| 7 — Temporal Hook (optional) | Replace Express logic with Temporal Workflow invocation for ride lifecycle.        |
| 8 — CI/CD                    | GitHub Actions: lint, test, build, deploy preview to Vercel.                       |

---

## 9 Risks & Mitigations

* **Game performance on low‑end laptops** → keep sprite sheet small; avoid heavy physics.
* **API latency demoing live** → default to local msw mocks; fallback polling interval.
* **Key‑press conflicts** → capture key events only when game canvas is focused.

---

## 10 Out of Scope / Nice‑to‑Have

* Multiplayer riders
* Mobile touch controls
* Real payment gateway
* Leaderboard & social sharing

---

## 11 Timeline (suggested)

Week 0 → Scaffold & Phaser POC
Week 1 → HUD, msw mocks
Week 2 → Styling polish, deployment
Week 3 → Optional Temporal integration & blog post

---

## 12 Acceptance Criteria

* Demo loads in modern Chrome / Safari without errors.
* Starting a ride zeroes all counters; ending a ride freezes counters and returns a token total.
* Distance increments visibly while **→** key is held.
* All network calls hit either msw or a live server without code changes (env var switch).

---

*End of Document*