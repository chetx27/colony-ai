# ColonyIQ

> India does 8 million deliveries a day. 2.7 million fail in the last 50 meters.
> Not because of bad logistics. Because Indian addresses are conversational — and every system built to fix them assumed they shouldn't be.
> ColonyIQ doesn't fix the address. It understands it.

---

## The problem

Flipkart and Amazon report 34% of delivery failures happen within the last 500 meters. Delivery agents make 3–4 phone calls per difficult address. Each failed attempt costs ₹45–80 in redelivery. At 8 million deliveries a day, that's ₹3.5 crore wasted daily — not on logistics, on navigation.

The root cause isn't solvable with better maps. India never had systematic street addressing. "3rd cross, near water tank, opposite Ganesh temple, white gate" isn't a broken address. It's a working one — it's worked for 40 years. The problem is that no system speaks that language.

ColonyIQ does.

---

## How it works

**Customer side**
A delivery notification links to ColonyIQ's PWA — no install required. The customer drops a GPS pin (accurate to ~100m is enough) and records a 15-second voice note in any language: Kannada, Hindi, Tamil, Telugu, English. That's it.

**AI pipeline**
Gemini 1.5 Pro transcribes the voice note, extracts spatial entities (landmarks, directions, floor info, gate identifiers), and cross-references them against Google Maps satellite imagery and a self-building landmark database. It generates structured navigation steps and synthesizes turn-by-turn audio in the delivery agent's preferred language.

**Agent side**
Google Maps handles routing until the agent is 500 meters from the pin. ColonyIQ takes over from there — full-screen landmark-based guidance with WaveNet audio:
- "Look for the HDFC ATM on your left"
- "Turn left immediately after the ATM"
- "Red gate on the right — second house"
- "Go to the 2nd floor"

Every successful delivery trains the system. The landmark database builds itself.

---

## Architecture
colonyiq/
├── apps/
│   ├── customer-pwa/        # React 18 + Vite + TypeScript — pin drop + voice flow
│   ├── agent-app/           # React 18 + Vite + TypeScript — landmark navigation
│   └── ops-dashboard/       # Internal analytics + landmark DB management
├── packages/
│   ├── api/                 # Node.js + Express (TypeScript)
│   │   ├── routes/          # delivery, navigate, agent, ops
│   │   ├── services/        # gemini, maps, tts, landmark, feedback
│   │   └── prompts/         # versioned Gemini prompt files (.txt)
│   ├── db/                  # Supabase schema, PostGIS migrations, seed data
│   └── shared/              # Types, constants, utils

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS | All three apps — customer PWA, agent app, ops dashboard |
| Backend | Node.js 20 LTS + Express + TypeScript | Monorepo API, split by domain |
| Database | Supabase (PostgreSQL + PostGIS) | Spatial queries, Realtime, Auth, Storage in one |
| AI | Gemini 1.5 Pro (multimodal) | Voice transcription + landmark extraction + step generation |
| Maps | Google Maps JS SDK + Places API + Static API | Pin drop + landmark verification + satellite cross-reference |
| TTS | Google Cloud TTS (WaveNet) | Agent audio in Kannada, Hindi, Tamil, Telugu, English |
| Infra | Vercel (frontends) + Railway (API) + Supabase | Production-ready, zero cold-start on API |

---

## AI pipeline

The core of ColonyIQ is a 5-stage sequential pipeline triggered the moment a customer submits their voice note.
Voice note (WAV/OGG)
↓
[1] Transcription         — Gemini 1.5 Pro speech-to-text, language detection
↓
[2] Entity extraction     — landmarks, directions, floor, gate identifiers (structured JSON)
↓
[3] Satellite verification — PostGIS radius query → Google Maps Places API fallback
↓
[4] Step generation       — typed NavigationStep[] array, verified + fallback per step
↓
[5] TTS synthesis         — WaveNet audio per step, stored in Supabase Storage

P95 target: under 20 seconds end-to-end.

All Gemini prompts are versioned flat files in `/packages/api/prompts/` — never hardcoded in service files.

---

## Landmark confidence engine

Every verified landmark in the system carries a confidence score (0–1) that increases with each successful delivery that references it. The score saturates at 50 successful deliveries. Landmarks are spatially deduplicated within a 30-meter radius.

Lookup priority per delivery:
1. PostGIS radius query (500m), confidence > 0.7, type match
2. PostGIS radius query (1km), any confidence, type match
3. Google Maps Places API
4. Accept as unverified (customer-stated, flagged in step output)

The database builds itself. High-density delivery zones like Koramangala or HSR Layout get exponentially more accurate over time.

---

## Database

PostgreSQL via Supabase with the PostGIS extension enabled. Core tables:

- `deliveries` — order lifecycle, status, agent + customer refs
- `customer_locations` — GPS pin (GEOGRAPHY), voice note URL, transcript, detected language
- `navigation_steps` — Gemini output (JSONB), landmark refs, per-step audio URLs
- `landmarks` — persistent spatial landmark DB, confidence score, delivery count, aliases
- `delivery_feedback` — agent outcome, step accuracy, landmark hit/miss counts
- `agents` — agent credentials, preferred language, company ref

Spatial indexes on `landmarks.location` and `customer_locations.pin` using GIST.

---

## Running locally

### Prerequisites
- Node.js 20 LTS
- Supabase account (free tier works for dev)
- Google Cloud project with Maps JS API, Places API, Cloud TTS, and Gemini API enabled

### Setup

```bash
git clone https://github.com/yourusername/colonyiq
cd colonyiq
npm install
```

```bash
# In Supabase dashboard:
# 1. Enable PostGIS extension (Database → Extensions)
# 2. Run packages/db/schema.sql in SQL Editor
# 3. Run packages/db/seed.sql for demo landmarks (Koramangala)
```

```bash
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
#          GOOGLE_MAPS_API_KEY, GEMINI_API_KEY, GOOGLE_CLOUD_TTS_KEY
```

```bash
npm run dev          # starts all apps + API in parallel (turborepo)
```

Customer PWA → http://localhost:5173
Agent app → http://localhost:5174
Ops dashboard → http://localhost:5175
API → http://localhost:3000

### Demo mode

Set `DEMO_MODE=true` in `.env` to run the full end-to-end flow without live API calls. Uses mock Gemini responses, pre-seeded Koramangala landmarks, and a simulated agent location replay. Tracking ID: `DEMO-001`.

---

## API reference
POST   /api/delivery/:trackingId/navigate     Trigger AI pipeline (voice note + pin)
GET    /api/delivery/:trackingId/status        Poll pipeline status + navigation steps
POST   /api/agent/location                     Update agent GPS, trigger agent_nearby event
POST   /api/delivery/:deliveryId/feedback      Submit delivery outcome + landmark accuracy
GET    /api/ops/analytics                      Delivery stats, landmark coverage, failure zones

---

## Roadmap

- [x] DB schema + PostGIS setup
- [x] Gemini pipeline — transcription, extraction, verification, step gen, TTS
- [ ] Customer PWA — pin drop + voice recording + status polling
- [ ] Agent app — Phase 1 (Google Maps) + Phase 2 (ColonyIQ landmark guidance)
- [ ] Realtime events — agent_nearby, delivered (Supabase Realtime)
- [ ] Landmark confidence engine
- [ ] Ops dashboard — live map, landmark DB browser, pipeline monitor
- [ ] i18n — Kannada + Hindi UI (v1)
- [ ] Offline fallback — IndexedDB step cache for agent app
- [ ] Expand to Mysuru, Coimbatore, Patna (tier 2 city push)

---

## SDG alignment

**SDG 9** — Industry, Innovation and Infrastructure
**SDG 11** — Sustainable Cities and Communities
**SDG 8** — Decent Work and Economic Growth (delivery agent efficiency)

---

## Built by

Chethana G

---

*ColonyIQ is an active build. Stars, issues, and brutal feedback welcome.*
