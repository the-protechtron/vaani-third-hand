# Third Hand

**A voice agent that can see what you are looking at.**

You are elbow-deep in a machine. You cannot type, you cannot scroll a PDF, and
the service manual is 180 pages. You say *"my extruder is clicking"* — and a
technician's voice walks you through it while the 3D model on the bench screen
explodes itself, spins to the part that matters, and lights it orange.

Then you point at something and say *"what's this bit?"* — and it knows.

Three machines ship with it: a **desktop 3D printer**, a **1.5T MRI scanner**,
and a **centrifugal pump** that was imported from a `.glb` and labelled in about
two minutes. Same agent, same fourteen tools, same code. Only the manifest changes.

**Voice: Vaani's Indus stack** — Saaras v3 (ears), vaani-105b-conversations
(brain), Bulbul v3 (voice). **Live web: Anakin.io** (search + scrape).

> **New to the repo?** Read **[TEAM_SETUP.md](TEAM_SETUP.md)** first — accounts,
> keys, the Indus Voice-Agent configuration, running the app, and the demo
> script, all step by step.

---

## The problem

Someone is standing at a broken machine. The knowledge they need exists — it's
in a 180-page PDF, a 22-minute video, or a senior colleague's head. All three
are unreachable **because their hands and eyes are busy.** The PDF can't be
scrolled with greasy hands. The video can't be scrubbed to minute 14. The
colleague is on another site, and even on the phone they can't see what you see.

That is an interface problem, which is why a voice agent is the right shape of
answer — and why the answer needs a screen it can drive.

The 3D model is not standing in for the real machine. No service software shows
you your literal machine; every OEM parts catalogue is an exploded diagram. The
difference here is that **you never have to put your tools down to operate it.**

---

## Why this one wins the room

Every other team at a voice hackathon ships a talking head. Audio in, audio out,
maybe a transcript. The audience has seen that.

Third Hand has a **closed loop**:

```
        agent  ──── focus / highlight / explode / step ────►  3D viewport
          ▲                                                        │
          └──────── get_user_pointer / get_view_state ◄────────────┘
```

Tools going *out* mean the agent changes what you are looking at **mid-sentence**.
Tools coming *back* mean the agent is not blind — it can ask the screen what the
human is pointing at before it answers. That second direction is the part nobody
builds, and it is eight seconds of demo that makes people put their phone down.

---

## It is not only for repair

The same rig does three jobs, and they share every tool:

| Mode | What happens | Why the 3D matters |
|---|---|---|
| **Repair** | Fault → procedure → guided steps → parts → service record | Shows *which* screw |
| **Learn** | "Walk me through this machine" → outside-in tour, two sentences per part | Peeling the seven shells off an MRI *is* the mental model |
| **Quiz** | "Point at the part that fails when the chiller blocks" → `get_user_pointer` marks the answer | The answer is a gesture, not a multiple-choice box |

Learn mode is not a bolt-on. On an MRI you **cannot** practise on the hardware —
it is multi-crore, it is in clinical use, and downtime is measured in cancelled
patients. Digital-first is not a compromise there, it is the only option. And
because the same agent then stands next to you in the field, a trainee learns on
exactly the model they will later be guided through. That continuity is the
pitch: **one voice, one model, one set of part names, from training to the job.**

---

## Architecture

```
┌──────────────────────── browser ────────────────────────┐
│  React + Vite                                            │
│                                                          │
│  voiceAgent.ts   talk (VAD) ──► record utterance         │
│        │  CLIENT TOOLS (8, unchanged — the scene tools)  │
│        ▼                                                 │
│   zustand store ◄──── browser tools ──────┐              │
│        ▼                                  │              │
│   react-three-fiber viewport              │              │
│   (camera rig, explode, glow, dim,        │              │
│    callouts, pointer)                     │              │
└───────────────────────────────────────────┼──────────────┘
             │ POST /api/stt → /api/agent/turn → /api/tts  │
             ▼                                            │
┌──────────── FastAPI — the whole agent loop ─────────────┘
│  /api/stt            utterance → saaras:v3 transcript    │
│  /api/agent/turn     vaani-105b-conversations +         │
│                      14 tools, tool-calling loop         │
│  /api/tts            reply → bulbul:v3 → base64 WAV      │
│  /api/tools/get_procedure   symptom → ordered steps      │
│  /api/tools/lookup_part     specs, torque, safety, price │
│  /api/tools/order_part      writes to the live cart      │
│  /api/tools/log_repair      writes the service record    │
│  /api/tools/search_web      Anakin live web search       │
│  /api/tools/read_page       Anakin scrape any page       │
│  /api/machine        which catalogue the tools read from │
└──────────────────────────────────────────────────────────┘
```

**The split that matters.** Anything that changes *what you see* is a client tool
(instant, runs in the browser, no round trip). Anything that is *truth about the
world* — specs, stock, orders, records — is a server tool. Get this split wrong
and the demo feels laggy; get it right and the scene moves while the agent is
still mid-sentence.

---

## Where the 3D actually comes from

The printer and the scanner are hand-authored from primitives, because zero
asset dependencies is the right call for a demo. That is not the real path.

**The real input is not a 3D model. It is a labelled one.** An unlabelled mesh
off Sketchfab is useless here — the agent needs a stable id per part that the
renderer and the parts catalogue both agree on. A crude box model with 13
correctly-named parts works perfectly; a beautiful 400k-triangle scan with no
node names does not.

That reframes the onboarding cost, because labelled assemblies already exist:

| Where the model comes from | What you get | What a human still does |
|---|---|---|
| **CAD / STEP from the OEM** | Full assembly tree with real part numbers — it was built from a bill of materials | Almost nothing. Confirm which parts are serviceable. |
| **Well-authored GLB** | Named meshes (`Pump_Casing`, `Impeller`) | Confirm ids, fix a few labels |
| **Sloppy GLB** | `Mesh_001` … `Mesh_247` | Name the 20 that matter, ignore the rest |
| **Photogrammetry scan** | One blob, no parts | Segmentation — this is the hard case |

Two things make this tractable. First, **you never need every mesh** — you need
the fifteen or thirty a technician would ever touch, and the OEM's parts
catalogue already tells you exactly which those are. Second, **labelling is
one-time per model, not per session**, so it amortises over thousands of
service calls.

### The labelling studio

Run the app and go to **`#label`**. Drop in a `.glb`.

```
localhost:5173/#label
```

It reads the assembly tree out of the file and does the parts a human should
not have to type:

- **part ids and labels** from the node names (`Bearing_Housing` → `bearing_housing`, "Bearing Housing")
- **explode vectors** from geometry — direction from the part's centroid
  relative to the assembly, distance from its size *and its nesting depth*.
  That last one matters: a naive centroid explode fails on any nested assembly,
  because an impeller sitting inside a casing shares its centre and the two fly
  together, so the impeller never becomes visible. Counting how many larger
  boxes enclose a part fixes it — inner parts get a shell's worth of extra travel.
- **scale, floor height and camera framing** so an imported model lands the
  right way up at a sensible size whatever units it arrived in

You answer two questions per row: *would a technician ever touch this*, and
*what do they call it*. Then Export writes three files.

### If your .glb will not load

Real models in the wild are almost never plain glTF, and `GLTFLoader` refuses
compressed ones with an error that reads like your file is broken when it is
not. All three common cases are wired up:

| Symptom | What it is | Handled |
|---|---|---|
| `setMeshoptDecoder must be called…` | Ran through `gltfpack`, or downloaded from Sketchfab | ✅ meshopt decoder is bundled |
| `no DRACOLoader instance provided` | Draco compressed, common out of Blender | ✅ decoder served from `public/decoders/draco/` |
| `no KTX2Loader instance provided` | KTX2 / Basis textures | ✅ transcoder served from `public/decoders/basis/` |
| `Failed to load buffer "scene.bin"` | A `.gltf` with its data in a sibling file | Select the `.gltf` **and** its `.bin` and textures together — the studio takes multiple files |

The decoders are vendored into `public/decoders/` rather than pulled from a
CDN, deliberately: the one network you will run this on is a venue wifi that
blocks `gstatic.com`.

Two sample models are checked in — `pump.glb` (single-file binary) and
`valve.gltf` (embedded buffers) — and `tools/` regenerates both if you want to
change them.

### Proof: the third machine

`frontend/src/machines/pump.ts` is **generated output, checked in unedited**.
It came from dropping `public/models/pump.glb` into the studio, unticking three
structural nodes, and clicking Export. 19 meshes in, 16 serviceable parts out.

Everything works on it identically — focus, highlight, explode, and the pointer
loop resolving a hover three levels deep in someone else's scene graph back to
`pump_casing`.

What the studio could *not* generate is `backend/data/pump/parts.json` and
`procedures.json` — the torque figures, the safety notes, the order in which a
good technician actually checks things. That took about twenty minutes to write
by hand, and that is the honest measure of what onboarding a machine costs:
**the geometry is free, the knowledge is the work.** Which is the right answer,
because the knowledge is also the thing worth owning.

### Adding a machine by hand

Three files, no engine changes:

```
frontend/src/machines/<id>.ts      geometry: primitives, or glbUrl + meshName per part
backend/data/<id>/parts.json       specs, torque, safety, price, stock
backend/data/<id>/procedures.json  symptom → ordered steps
```

Register it in `frontend/src/machines/index.ts` and drop the folder in
`backend/data/`. The backend picks it up on boot. The agent discovers the part
ids at runtime from `switch_machine` — its prompt never names a single part.

---

## What's built

| | |
|---|---|
| `frontend/src/machines/` | Three machines as data. Printer: 13 parts. MRI: 18 parts, seven concentric shells that telescope apart. Pump: 16 parts, generated from a GLB. |
| `frontend/src/components/MachineModel.tsx` | Every part its own mesh — movable, glowable, hoverable. Non-highlighted parts dim so the subject pops on a projector. |
| `frontend/src/components/Scene.tsx` | Camera rig that flies to the focused part. Lighting is **local** (Lightformers, not an HDR preset) so nothing downloads on venue wifi. |
| `frontend/src/clientTools.ts` | All 8 client tools, machine-aware, plus `window.__th` to drive the scene from the console. |
| `frontend/src/label/` | The labelling studio at `#label`. Turns a `.glb` into a working machine. |
| `backend/main.py` | The whole agent loop: Vaani STT → vaani-105b-conversations with 14 tools → Bulbul TTS, plus the machine-scoped server tools (4 original + 2 Anakin web tools). |
| `backend/data/` | 47 parts with real torque figures and safety notes. 13 full procedures. |
| `AGENT_SETUP.md` | The original prompt and tool schemas, paste-ready. *(Reference — the prompt now lives in `backend/main.py`.)* |
| `VAANI_SETUP.md` | Keys, first calls, smoke tests — the paste-ready Vaani + Anakin walk-through. |

**Zero asset dependencies on the demo path.** The printer and scanner are built from primitives. No GLB to
download, no draco decoder, no CORS, no "the model didn't load" five minutes
before you go on. The pump proves the GLB path works when
you want it; it is the only machine that loads a file.

---

## Run it

```bash
# terminal 1
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # put VAANI_API_KEY + ANAKIN_API_KEY in
uvicorn main:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Then run `python test_vaani.py` and `python test_anakin.py` — five ✅ lines
means every sponsor API is live. Full walk-through in `VAANI_SETUP.md`. The
agent's prompt and tool schemas are configured **in code** now
(`backend/main.py`); there is no dashboard step and no ngrok.

### Drive the scene without the agent

Open the console at `localhost:5173`:

```js
__th.switch_machine({ machine: 'mri' })
__th.set_explode({ level: 0.8 })
__th.focus_part({ part_id: 'gradient_coil', zoom: 0.7 })
__th.highlight_part({ part_id: 'chiller', label: 'start here: filter' })
__th.get_view_state()
```

This is how you tune the visuals for free.

---

## Prep checklist

The order is deliberate — everything that needs a third party comes first.

- [ ] **(10 min) Keys.** Vaani key from `vaani.dev/key-management`,
      Anakin key from its dashboard, both into `backend/.env`.
      `pip install -U vaaniai`.
- [ ] **(15 min) First calls.** `python test_vaani.py` (3 ✅) and
      `python test_anakin.py` (2 ✅). Sprint rule: real sponsor output printed
      before any UI is built.
- [ ] **(20 min) Frontend.** `npm install && npm run dev`. Check both machines
      render and hovering a part turns it blue.
- [ ] **(30 min) First end-to-end.** Click Start session, wait for the intro,
      then say *"my extruder is clicking"*. Expect the agent to be too chatty
      and to skip `set_explode` — that is a prompt problem, not a code problem.
- [ ] **(30 min) Prompt tuning.** Where the demo is won or lost. The prompt
      lives in `SYSTEM_PROMPT` in `backend/main.py` now — tighten until it
      *always* does explode → focus → highlight → show_step → speak, in that
      order, and *always* calls `get_user_pointer` on "this".
- [ ] **(15 min) Record a backup video** of one clean run. If the venue wifi dies
      you still have a demo.
- [ ] Wired headset with a boom mic. Laptop mics pick up the room and the
      voice detector will misfire without one.

---

## The demo — 2 min 30

Stand *back* from the laptop with something in both hands. The moment the
audience sees your hands are full, the pitch lands without you arguing for it.

> **0:00** *(printer on screen, assembled)*
> "Both my hands are inside this printer. I can't type. Watch."

> **0:10** *"My extruder is clicking and there are gaps in the walls."*
> — the tool feed lights up, the assembly explodes, the camera flies to the
> extruder, it glows orange, step 1 lands on screen.
> **Say nothing.** Three seconds of silence here beats any sentence you could say.

> **0:35** "Done." → step 2, the PTFE tube. Label reads *"cut 10 mm off, square"*.

> **0:55 — the moment.** Go off script. Hover the heatsink fan.
> *"Hang on — what's this?"*
> — it answers about the 40 mm fan and explains why a stalling one causes exactly
> the clog they're chasing. Then, to the room: **"I never said the word fan."**

> **1:25 — prove it's a system.** *"Switch to the MRI."*
> The scanner loads. *"Helium is dropping faster than usual."* Seven shells
> telescope apart, the cold head lights up, and the first thing it says is that
> the magnet is always on. **"Same agent. Same seven tools. I changed a data
> file."**

> **1:55** *"Order a cold head."* → cart, order id, ETA, ₹18,00,000.

> **2:05 — the live web.** *"Before I commit — what does a cold head actually
> cost out there?"* → `search_web` fires, three source cards with real links
> appear in the panel, and it answers with the price range and *where it came
> from*. **"That's not my catalogue. That's the internet, right now."**

> **2:15** *"That fixed it."* → `log_repair` → the service record writes itself.

> **Optional +10 s — the languages.** *"हिंदी में बताओ — अगला कदम क्या है?"*
> → it answers in spoken Hindi. One prompt line, zero translation layer. Skip
> it if the room is running late.

> **2:20** Close: "Every voice agent you'll see today is blind. This one shares
> your screen — it can point at things, and it can see what *you're* pointing at.
> That's the difference between a chatbot with a voice and a colleague."

**Rehearsal notes.** Do the pointer moment off script — pick a different part each
time so you know it isn't memorised. Never say a part's name before the agent
does. If it stumbles, keep going; recovering gracefully reads as confidence.

---

## Risks and what to do

| Risk | Mitigation |
|---|---|
| **Venue wifi** | Tether to your phone. Nothing downloads assets. Backup video ready. |
| **Anakin credits / rate limit** | 60 req/min, 300 free credits. The backend caches one search per query — don't fire it repeatedly on stage. |
| **TTS latency (~1–2 s)** | Expected, and now hidden: replies stream sentence-by-sentence, so the first audio starts in ~1 s while the scene has already moved — the pipeline is visible, which reads as speed. |
| **Agent skips scene tools** | Prompt problem. Tighten the ordering rules in `SYSTEM_PROMPT` (`backend/main.py`). Temperature stays at 0.2. |
| **Agent uses printer ids on the MRI** | `switch_machine` returns the valid list. If it still slips, add the list to the first message. |
| **Room noise cuts you off** | Wired headset with a boom mic. Not AirPods, not the laptop mic. The mic closes while the agent speaks, so it cannot hear itself — but a loud room can trip the voice detector. |
| **A sponsor call fails live** | `search_web` failures degrade gracefully — the agent says so in one line and continues with `get_procedure`. Nothing on the demo path has a single point of failure. |

---

## Where this goes

**Point a camera at the real thing.** Vaani Vision (Doc AI) reads photos and
scans in 23 languages. Point a phone at the machine's rating plate or the
service PDF and the agent reads the model number itself. That is the version
people pay for.

**Put it in AR.** Same agent, but the highlight lands on the real hardware instead
of a model. The screen just gets closer to the thing you're fixing.

**Put it on a phone line.** The same prompt and tools run on Vaani Voice
Agents (`vaani.dev/samvaad`) with telephony built in. A field technician
with no laptop calls a number and gets the same agent.

**Make it multilingual.** Already wired: Saaras hears 22 languages, Bulbul
speaks 11, and the prompt answers in the caller's language. A Tamil-speaking
technician, an English service manual, no translation layer in between.

**The data flywheel is the real moat.** Every session writes a structured record:
symptom, root cause, steps, parts. Five hundred sessions tells you the PTFE tube
is the actual culprit 40% of the time — which no PDF manual can. It also tells
you where your manual is *wrong*: if technicians keep saying "that didn't work"
at step 3, step 3 is bad.

**And the generalisable bit:** "an agent that shares a canvas with a human and can
ask what they're looking at" isn't about repair at all. It's CAD review,
radiology, architectural walkthroughs, a shopping configurator, a data dashboard.
The pointer loop is the reusable primitive — the machines are just the first
things you hang it on.
