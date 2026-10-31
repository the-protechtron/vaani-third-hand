# Third Hand

> **A multimodal voice agent that can see what you are looking at.**  
> Hands-free industrial repair copilot, 3D digital twins, and virtual engineering laboratory powered by **Vaani Voice AI** and **Anakin.io**.

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Three.js / R3F](https://img.shields.io/badge/Three.js-R3F-black?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-blue?style=flat-square)](https://livekit.io)
[![Vaani Voice AI](https://img.shields.io/badge/Voice%20AI-Vaani%20Indus-FF6B00?style=flat-square)](https://vaani.dev)
[![Anakin.io](https://img.shields.io/badge/Live%20Web-Anakin.io-8A2BE2?style=flat-square)](https://anakin.io)

---

## Quick Navigation

- [The Core Innovation: The Closed Loop](#the-core-innovation-the-closed-loop)
- [Four Operating Environments](#four-operating-environments)
  - [1. Desktop 3D Printer (Ender-3)](#1-desktop-3d-printer-ender-3-class)
  - [2. 1.5T Superconducting MRI Scanner](#2-15t-superconducting-mri-scanner)
  - [3. End-Suction Centrifugal Pump](#3-end-suction-centrifugal-pump)
  - [4. Pelton Wheel Virtual Lab & Viva Simulator](#4-pelton-wheel-virtual-lab--viva-simulator)
- [Specialized Portals](#specialized-portals)
  - [Teacher Analytics Dashboard (`#teacher`)](#teacher-analytics-dashboard-teacher)
  - [3D CAD Labelling Studio (`#label`)](#3d-cad-labelling-studio-label)
- [System Architecture](#system-architecture)
- [The 16-Tool Ecosystem](#the-16-tool-ecosystem)
- [Live Web & Parts Pricing (Anakin.io)](#live-web--parts-pricing-anakinio)
- [Quickstart & Setup](#quickstart--setup)
- [Environment Variables](#environment-variables)
- [Interactive Scene Driving via Console (`window.__th`)](#interactive-scene-driving-via-console-window__th)
- [Adding New Machines](#adding-new-machines)
- [Troubleshooting](#troubleshooting)
- [Repository Layout](#repository-layout)

---

## The Problem

A technician is elbow-deep inside a malfunctioning machine. Their hands are covered in grease, and their eyes are locked on the hardware. 

The information needed to solve the fault exists — in a 180-page PDF manual, a 20-minute video, or in a senior specialist's memory:
- **PDFs cannot be scrolled** with greasy hands or while holding a multimeter.
- **Videos cannot be scrubbed** to the exact minute without breaking workflow.
- **Remote calls fail** because a remote colleague cannot see the exact part being inspected.

Voice alone is not enough if the agent is blind. Standard voice bots are disembodied talking heads. **Third Hand solves this by pairing speech-first interaction with an interactive 3D digital twin that shares visual context with the user.**

---

## The Core Innovation: The Closed Loop

Third Hand does not just speak — it manipulates and reads the 3D scene in real time:

```
                  ┌──────────────────────────────────────────────┐
                  │             Vaani Voice Agent                │
                  │   Saaras v3 (STT) ──► vaani-105b ──► Bulbul  │
                  └───────────────▲───────────────┬──────────────┘
                                  │               │
  get_user_pointer                │               │  focus_part / highlight_part
  get_view_state (Reads Context)  │               │  set_explode / show_step
                                  │               │  (Manipulates Viewport)
                                  │               ▼
                  ┌───────────────┴──────────────────────────────┐
                  │              3D Canvas & WebRTC              │
                  │        (React Three Fiber / LiveKit)         │
                  └──────────────────────────────────────────────┘
```

1. **Outgoing scene control:** The agent triggers visual actions (`set_explode`, `focus_part`, `highlight_part`, `show_step`) **mid-sentence**. The assembly expands and highlights the faulty component before the spoken explanation finishes playing.
2. **Incoming visual perception:** The agent can poll what part the user's cursor or touch is hovering on (`get_user_pointer`). When a user asks *"what is this bit?"*, the agent inspects the 3D pointer and answers accurately without the user ever naming the component.
3. **Multilingual by default:** Built on Vaani's speech stack, technicians can report faults in English, Hindi, or code-mixed Hinglish (*"मेरा एक्सट्रूडर क्लिक कर रहा है"*), receiving natural responses in their spoken language with zero intermediate translation latency.

---

## Four Operating Environments

### 1. Desktop 3D Printer (Ender-3 Class)
- **13 Addressable Parts | 5 Verified Procedures**
- Diagnostic coverage: Extruder skipping, hot-end clogs, bed levelling, PTFE tube degradation, stepper motor overheating.
- Safety warnings prioritized: Auto-prompts for hot-end burn hazards and power isolation before mechanical disassemblies.

### 2. 1.5T Superconducting MRI Scanner
- **18 Addressable Parts | 5 Clinical Procedures**
- Complex digital twin featuring **7 concentric telescoping shells** (outer gantry, vacuum jacket, radiation shield, cryostat, gradient coils, RF body coil, patient bore).
- Safety-critical workflows: Liquid helium boil-off alarms, quench button protocols, gradient cooling loop inspections, RF coil seating.

### 3. End-Suction Centrifugal Pump
- **16 Addressable Parts | 3 Industrial Procedures**
- Diagnostic coverage: Cavitation damage, mechanical seal leakage, bearing degradation.
- **Automated CAD Pipeline Proof:** Created entirely by importing a raw binary `.glb` model into our `#label` studio, filtering non-serviceable components, and generating production-ready scene code without manual 3D modeling.

### 4. Pelton Wheel Virtual Lab & Viva Simulator
A full-featured virtual fluid mechanics laboratory designed for engineering students and lab instructors:
- **Interactive 3D Pelton Rig:** Realistic water jet animation, spear valve adjustment, casing inspection, and friction brake dynamometer.
- **Learn Tab:** Step-by-step 9-stage standard experimental procedure and theoretical background.
- **Observation Tab:** Dynamic data table tracking head ($H$), nozzle discharge ($Q$), rotational speed ($N$), and spring balance brake loads ($S_1, S_2$).
- **Calculations & Graphing:** Real-time computation of water power ($P_{in}$), shaft power ($P_{out}$), and overall efficiency ($\eta$), accompanied by interactive performance curves.
- **Quiz Mode:** Automated multiple-choice drills on impulse turbines.
- **Spoken AI Tutor:** A hands-free conversational voice tutor explaining fluid principles, bucket splitters, and governing mechanisms.
- **Oral Viva Voce Exam:** An automated voice examiner asking 5 dynamic oral questions. Students can answer verbally or by **clicking the exact part on the 3D rig** to demonstrate spatial and mechanical mastery.

---

## Specialized Portals

### Teacher Analytics Dashboard (`#teacher`)
Navigate to `http://localhost:5173/#teacher` to access the instructor portal:
- Authenticated via the secret `TEACHER_KEY` set in `backend/.env`.
- Live roster of all students who have attempted the Pelton Wheel laboratory and viva exam.
- Detailed question-by-question scoring breakdown (audio answers vs. 3D part-click answers).
- Exportable telemetry and one-click data reset for new class cohorts.

### 3D CAD Labelling Studio (`#label`)
Navigate to `http://localhost:5173/#label` to convert any standard 3D asset into an agent-ready digital twin:
- **Zero-Install glTF/GLB Ingestion:** Drag and drop `.glb`, `.gltf`, or `.bin` files directly into the browser.
- **Automated Hierarchical Parsing:** Extracts mesh IDs, normalizes scale, and establishes ground-plane framing.
- **Nesting-Aware Explode Computation:** Standard centroid explode formulas fail on nested assemblies (e.g. an impeller inside a casing). The studio counts enclosing bounding boxes so internal components receive additional travel distance, ensuring complete visibility when exploded.
- **Bundled Offline Decoders:** Pre-packaged with Draco, Meshopt, and KTX2 decoders in `public/decoders/` for venue-safe reliability without external CDN calls.
- **One-Click Code Export:** Produces TypeScript component code and JSON manifest boilerplate ready to drop into `frontend/src/machines/` and `backend/data/`.

---

## System Architecture

```
                                  USER (Browser)
                      Mic / Speakers / WebGL / LiveKit WebRTC
                                       │
                      ┌────────────────┴────────────────┐
                      │    React 18 + Vite (Port 5173)   │
                      │  - Three.js / React Three Fiber │
                      │  - Zustand State Store          │
                      │  - 8 Browser Scene Tools        │
                      └────────────────┬────────────────┘
                                       │ /api proxy
                                       ▼
                       FastAPI Server (Port 8765)
          ┌─────────────────────────────────────────────────────────┐
          │  main.py & lab.py                                       │
          │  - Speech Session Controller (/api/vaani/session)       │
          │  - Fallback Audio Pipeline (/api/stt, /api/agent/turn)  │
          │  - 16 Server Tool Endpoints (/api/tools/*)              │
          │  - Local Data Stores (data/ & lab_store.json)          │
          └────────────┬───────────────────────────────┬────────────┘
                       │                               │
       Incoming Tool Webhooks                   Live Search Queries
         via ngrok Tunnel                       & Scraping Calls
                       │                               │
                       ▼                               ▼
            Vaani Cloud Platform                   Anakin.io
      ┌─────────────────────────────┐    ┌───────────────────────────┐
      │  - Saaras v3 (STT)          │    │  - Real-Time Search API   │
      │  - vaani-105b Reasoning     │    │  - Page Crawler / Scraper │
      │  - Bulbul v3 (TTS)          │    │  - Live Part Price Feed   │
      │  - WebRTC Room / LiveKit    │    └───────────────────────────┘
      └─────────────────────────────┘
```

### Dual-Loop Operation
1. **Primary WebRTC Voice Session:** The browser initiates a call with Vaani via `/api/vaani/session`. Audio streams full-duplex over WebRTC (LiveKit). Vaani dispatches tool calls through your public ngrok tunnel directly into `/api/tools/*`, and the frontend synchronizes 3D view states via WebSocket captions and telemetry polling.
2. **Local Direct API Loop (Fallback):** The repository also supports a discrete turn-based loop (`POST /api/stt` $\to$ `POST /api/agent/turn` with NDJSON streaming $\to$ `POST /api/tts`), enabling local experimentation and smoke-testing without third-party dashboards.

---

## The 16-Tool Ecosystem

Third Hand equips the reasoning model (`vaani-105b-conversations`) with 16 dedicated tools defined in `backend/agent_template.json` and `backend/main.py`:

### Machine & Web Tools (8 Tools)
| Tool | Target | Description |
|---|---|---|
| `get_procedure` | Server | Fetches official diagnostic and repair procedures for a machine symptom. |
| `lookup_part` | Server | Retrieves part specifications, torque values, service intervals, and stock status. |
| `order_part` | Server | Adds a replacement component to the active dispatch cart with an ETA. |
| `log_repair` | Server | Generates an auditable digital service record containing root cause and steps taken. |
| `search_web` | Anakin | Searches the live web for real-time market prices, forums, and recall notices. |
| `read_page` | Anakin | Scrapes and summarizes product documentation or technical bulletin URLs. |
| `set_view` | Browser | Adjusts camera angle, explode level, and focused component. |
| `show_step` | Browser | Pins current repair step, safety note, and tool requirement on screen. |

### Lab & Viva Voce Tools (8 Tools)
| Tool | Target | Description |
|---|---|---|
| `lab_open_tab` | Lab UI | Switches between Learn, Observe, Calculate, Quiz, Tutor, and Viva tabs. |
| `lab_show` | Lab UI | Highlights relevant equations, data rows, or graphs during tutoring. |
| `viva_ask` | Viva Engine | Issues an oral examination question to the student. |
| `viva_wait` | Viva Engine | Signals the agent to pause and listen for the student's verbal or spatial response. |
| `viva_check` | Viva Engine | Validates student verbal response against correct technical answers. |
| `viva_record` | Viva Engine | Records score and telemetry for the current question into `lab_store.json`. |
| `viva_answer_number`| Viva Engine | Submits a calculated numerical value during quantitative oral prompts. |
| `viva_finish` | Viva Engine | Concludes the oral viva, tallies points, and emits the final grading report. |

### Browser Scene Tools (`frontend/src/clientTools.ts`)
| Tool | Description |
|---|---|
| `switch_machine` | Hot-swaps the active 3D model (`printer`, `mri`, `pump`). |
| `set_explode` | Linearly drives the exploded view slider ($0.0 \to 1.0$). |
| `focus_part` | Animates the camera to zoom and frame a target component. |
| `highlight_part` | Applies an accent glow and callout billboard to a component while dimming others. |
| `clear_scene` | Resets camera position, highlights, and collapse state. |
| `get_user_pointer` | Identifies which part the technician is hovering or pointing at. |
| `get_view_state` | Returns active camera coordinates, focused part, and explode level. |

---

## Live Web & Parts Pricing (Anakin.io)

Third Hand does not rely solely on static internal catalogues. When a technician asks:
> *"What does a replacement nozzle actually cost right now?"*

1. The agent executes `search_web` via the Anakin.io search API.
2. The search query retrieves live snippets, vendor titles, and retail URLs.
3. The UI automatically displays **Live Web Source Cards** with domain badges and extracted price pills.
4. If deeper analysis is required, the agent calls `read_page` to crawl technical specifications from external documentation.

---

## Quickstart & Setup

### Prerequisites

| Dependency | Minimum Version | Notes |
|---|---|---|
| **Python** | 3.11+ | Python 3.12 recommended |
| **Node.js** | 18+ | Node 20 or 24 recommended (includes npm) |
| **Google Chrome** | Latest | Required for WebRTC and microphone permissions |
| **ngrok** | Latest | Free account required to expose local port 8765 |
| **Vaani Account** | Active with credits | [platform.vaani.dev](https://platform.vaani.dev) (API Keys page) |
| **Anakin.io Key** | Active account | [anakin.io](https://anakin.io) (Optional: for live search/prices) |

---

### Step 1: Backend Setup

Open a terminal in the `backend/` directory:

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate       # On Windows PowerShell: .\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create your environment configuration
cp .env.example .env
```

Open `backend/.env` and supply your credentials:
```env
VAANI_API_KEY=vaani_your_key_here
ANAKIN_API_KEY=ak_your_key_here
TOOL_SECRET=your_custom_secret_key_here
TEACHER_KEY=your_teacher_dashboard_password
VAANI_AGENT_ID=
```

---

### Step 2: Frontend Setup

Open a second terminal in the `frontend/` directory:

```bash
cd frontend
npm install
```

---

### Step 3: Run the Application

You will run three lightweight processes simultaneously:

#### Terminal 1 — Backend (Port 8765)
```bash
cd backend
source .venv/bin/activate
python -m uvicorn main:app --port 8765
```
*Verify health check:* Visit [http://localhost:8765/api/health](http://localhost:8765/api/health) — should return `"ok": true`.

#### Terminal 2 — Frontend (Port 5173)
```bash
cd frontend
npm run dev
```
*Access Web App:* Open [http://localhost:5173](http://localhost:5173) in Google Chrome.

#### Terminal 3 — Tunnel (ngrok)
```bash
ngrok http 8765
```
Copy the public forwarding address printed in your terminal (e.g., `https://abc-123.ngrok-free.dev`).

---

### Step 4: Register the Vaani Voice Agent (One-Time Command)

In your `backend` terminal (with `.venv` active), run the provisioning script using your ngrok URL:

```bash
python setup_vaani_agent.py --base-url https://YOUR-NGROK-URL
```

This single command:
1. Provisions the "Third Hand" voice agent in your Vaani account.
2. Synchronizes system prompts, greetings, and all 16 webhooks pointing to your ngrok tunnel with your `TOOL_SECRET`.
3. Writes the resulting `VAANI_AGENT_ID` directly into `backend/.env`.

**Restart the backend** (Ctrl+C in Terminal 1, then restart `uvicorn`) so it loads the new `VAANI_AGENT_ID`.

> **Note:** If your free ngrok URL changes after a restart, update the agent anytime with:
> ```bash
> python setup_vaani_agent.py --base-url https://NEW-NGROK-URL --update
> ```

---

## Environment Variables

All secrets remain server-side in `backend/.env` and are never exposed to the browser client:

| Variable | Required | Description | Example |
|---|---|---|---|
| `VAANI_API_KEY` | **Yes** | Your master API key from [platform.vaani.dev](https://platform.vaani.dev). | `vaani_abcdef123...` |
| `VAANI_AGENT_ID` | **Yes** | Populated automatically by `setup_vaani_agent.py`. | `agt_987654321...` |
| `ANAKIN_API_KEY` | Optional | API key for live web search and product price cards. | `ak_123456789...` |
| `TOOL_SECRET` | **Yes** | Shared authentication secret sent in the `X-Tool-Secret` header. | `random_hex_string` |
| `TEACHER_KEY` | **Yes** | Passcode required to unlock the Teacher Analytics View (`#teacher`). | `instructor_pass` |

---

## Interactive Scene Driving via Console (`window.__th`)

You can test and manipulate the 3D scene directly from the browser developer console without speaking:

```javascript
// Switch machines
__th.switch_machine({ machine: 'mri' })

// Drive the explode animation (0.0 to 1.0)
__th.set_explode({ level: 0.75 })

// Fly camera to a specific part
__th.focus_part({ part_id: 'gradient_coil', zoom: 0.8 })

// Highlight with custom label
__th.highlight_part({ part_id: 'chiller', label: 'Check fluid level' })

// Query current view coordinates and focused part
__th.get_view_state()

// Reset the scene back to normal
__th.clear_scene()
```

---

## Adding New Machines

Third Hand is designed with zero hardcoding in the core engine. To introduce a new machine:

1. **Geometry definition:** Add `frontend/src/machines/<machine_id>.ts` (specifying Three.js primitives or referencing a `.glb` asset from `/public/models/`).
2. **Parts catalogue:** Add `backend/data/<machine_id>/parts.json` (part IDs, torque values, safety advisories, stock status).
3. **Procedures guide:** Add `backend/data/<machine_id>/procedures.json` (symptom identifiers, ordered diagnostic steps, recommended tools).
4. **Registration:** Export the new machine in `frontend/src/machines/index.ts`. The backend automatically indexes any directory in `backend/data/` on startup.

---

## Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `402 Payment Required` on start session | Vaani account balance is ₹0 or exhausted. | Top up credits at [platform.vaani.dev](https://platform.vaani.dev). |
| Microphone blocked error | Chrome blocked audio input. | Click the lock/tune icon in Chrome's URL bar, allow Microphone access, and reload. |
| Tool calls fail with `401 Unauthorized` | `TOOL_SECRET` mismatch between backend and Vaani. | Check `TOOL_SECRET` in `backend/.env`, restart backend, and rerun `python setup_vaani_agent.py --base-url <url> --update`. |
| `localhost:5173` loads but API calls fail | Backend is not listening on port **8765**. | Vite proxies `/api` to `http://localhost:8765`. Ensure uvicorn is running with `--port 8765`. |
| Ngrok shows 404 or connection refused | Ngrok tunnel is pointing at the wrong local port. | Run `ngrok http 8765`. |
| Live web price cards do not appear | `ANAKIN_API_KEY` is missing or invalid. | Verify your Anakin API key in `backend/.env`. Check `python test_anakin.py`. |
| Agent speaks but 3D model does not move | Agent prompt skipped calling scene tools. | Ensure your spoken prompt describes a physical symptom (e.g. *"my extruder is clicking"*) rather than a generic greeting. |

---

## Repository Layout

```
vaani-third-hand/
├── backend/
│   ├── data/                   # Parts manifests and repair procedures
│   │   ├── mri/                # 1.5T MRI parts & procedure data
│   │   ├── printer/            # Ender-3 3D printer parts & procedures
│   │   └── pump/               # Centrifugal pump parts & procedures
│   ├── .env.example            # Environment variable template
│   ├── agent_template.json     # Vaani voice agent blueprint & 16 tool schemas
│   ├── lab.py                  # Pelton lab logic, viva grading & store
│   ├── main.py                 # FastAPI server, tool endpoints & WebRTC session
│   ├── requirements.txt        # Python library dependencies
│   ├── setup_vaani_agent.py    # Automated Vaani voice agent provisioning
│   ├── test_anakin.py          # Anakin API connectivity smoke test
│   └── test_vaani.py           # Vaani chat/STT/TTS connectivity smoke test
│
├── frontend/
│   ├── public/
│   │   ├── decoders/           # Offline Draco, Meshopt, and KTX2 decoders
│   │   └── models/             # Binary GLB models (pump, rig assets)
│   ├── src/
│   │   ├── components/         # 3D Viewport, Camera Rig, Panel, Sidebar
│   │   ├── label/              # 3D CAD Labelling Studio (accessible via #label)
│   │   ├── lib/                # Panel splitters and utility helpers
│   │   ├── machines/           # Machine definitions (printer, mri, pump)
│   │   ├── pelton/             # Pelton Wheel Lab (Learn, Observe, Calc, Viva)
│   │   │   ├── tabs/           # Lab tab views (CalcTab, VivaTab, ObserveTab...)
│   │   │   ├── PeltonLab.tsx   # Master Pelton lab container
│   │   │   ├── PeltonScene.tsx # 3D Pelton turbine scene with water dynamics
│   │   │   └── store.ts        # Zustand lab telemetry & calculation state
│   │   ├── clientTools.ts      # 8 browser-side 3D scene tools
│   │   ├── TeacherView.tsx     # Instructor Viva results dashboard (#teacher)
│   │   ├── voiceAgent.ts       # LiveKit WebRTC client & caption parser
│   │   └── App.tsx             # Root application orchestrator
│   ├── package.json            # Node.js dependencies and build scripts
│   └── vite.config.ts          # Vite bundler configuration (proxies /api -> :8765)
│
├── AGENT_SETUP.md              # Detailed prompt and tool schema reference
├── DEMO_SCRIPT.md              # 90-second synchronized presentation guide
├── SETUP.md                    # Core developer setup checklist
├── SUBMISSION_ANSWERS.md       # Technical submission questionnaire responses
└── README.md                   # Project documentation
```

---

## License

This project was built for the Vaani Voice AI Hackathon. Licensed under the MIT License.
