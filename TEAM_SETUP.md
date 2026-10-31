# TEAM_SETUP — total setup, zero prior context

Everything below assumes you have **never heard of ElevenLabs** and have never
run this repo. Follow top to bottom. Time: ~25 minutes for Parts A+B, 10 for C.

---

## 0. The big picture

Third Hand is a voice agent for technicians standing inside broken machines.
It has **two halves**, built on **both hackathon sponsors**:

| Sponsor product | What we use it for | Where it lives |
| --- | --- | --- |
| **Vaani** — Model APIs | The whole voice+brain loop: **Saaras v3** (speech→text), **vaani-105b-conversations** (reasoning + 14 tool calls), **Bulbul v3** (text→speech) | Our FastAPI backend calls `api.vaani.dev` directly |
| **Vaani** — Voice Agents (Indus / Samvaad) | A **phone-ready twin** of the same agent, built on the no-code platform: same persona, same rules, deployable to a phone number | `vaani.dev/samvaad` (browser, no code) — **Part A** |
| **Anakin.io** | The **live web**: `search_web` (search API) + `read_page` (scrape) so the agent can quote real prices/sources on stage | Our FastAPI backend calls `api.anakin.io/v1` |

The 3D scene (React + react-three-fiber) is our frontend. The backend
(`backend/main.py`) drives everything: browser listens hands-free (mic + VAD,
no push-to-talk) → `/api/stt` →
`/api/agent/turn` (tool loop; scene tools fire in the browser, web tools call
Anakin) → `/api/tts` → audio plays → straight back to listening.

The system prompt that powers the in-app agent lives in
`backend/main.py` (`SYSTEM_PROMPT`) and is documented in `AGENT_SETUP.md`.
Part A gives you a phone-ready adaptation of the same prompt to paste into
the Indus platform.

---

## 1. Prerequisites

| # | Thing | Where | Status |
| --- | --- | --- | --- |
| 1 | Vaani account + **general API key** (starts `sk_`, NOT `sk_samvaad`) | `dashboard.vaani.dev` → API Keys (shown once — save it) | ✅ done — in `backend/.env` |
| 2 | Anakin API key | Anakin dashboard → API keys | ✅ done — in `backend/.env` |
| 3 | Indus account (same login as #1 works) | `vaani.dev` | free — sign in for Part A |
| 4 | Node 18+, Python 3.11+ | — | needed for Part B |

---

## 2. PART A — configure the Indus Voice Agent (Samvaad)

This is the no-code half. It does **not** replace the app; it is the
sponsor-visible, phone-deployable twin. Do it once, show it in the demo.

1. **Sign in** at `https://vaani.dev` (same account as the dashboard).
   Voice Agents lives at `vaani.dev/samvaad`.
2. Left menu → **Build → Agents** (direct: `vaani.dev/samvaad/build/my-agents`).
3. Click **Create from Scratch**. (Alternative: paste this into the
   "What should your agent do?" box and let **Genie** draft it — then fix it
   with the prompt in step 5:
   > "A voice agent named Third Hand that guides factory technicians through
   > 3D printer, MRI and pump repairs hands-free — one short step at a time,
   > safety warning first, replying in the caller's language (Hindi, English
   > or code-mixed). Includes a learn/tour mode and a quiz mode.")
4. You land on the **Canvas** (visual builder).
5. Open the agent's **Instructions** tab:
   - **Greeting** (initial message) — paste:
     > Third Hand here. Which machine are you at, and what's it doing?
   - **System prompt** — paste the block below (it is the in-app agent's
     prompt adapted for "no screen on this call"):

```text
# Who you are

You are Third Hand, a repair assistant for industrial machines. You speak to
a technician who is standing at the machine with their hands inside it -
hands busy, eyes on the hardware, not on you. You are their second pair of
eyes and their memory. There is no screen on this call: your words ARE the
interface.

# How you speak

- Short sentences. One instruction at a time. Their hands are busy.
- Never read out a list longer than three items - break it up and confirm.
- Never say part codes or identifiers. Say "the nozzle", "the silver ring".
- No filler. No "great question". If they interrupt, stop and answer them.
- Reply in the language they use - Hindi in, Hindi out, English in, English
  out, code-mixed in, code-mixed out. Keep it short either way.

# Repair mode (the default)

1. Let them describe the fault in their own words.
2. Say the safety step FIRST, always, before any fix: power off where it
   applies, hot-end burn risk on printers, quench rules on the MRI bay,
   lockout-tagout on pumps.
3. Give ONE step. Stop. Wait. Do not read the next step until they say this
   one is done, or that it did not work.
4. If the obvious fix fails, go one level deeper (belt tension, then extruder
   gear, then hot-end assembly). Never more than one guess ahead.
5. Once it works: one-line wrap-up plus the one habit that prevents it.

# Learn mode

If they say they are new or ask to be walked through the machine: give a
thirty-second mental model first (printer: outside-in. MRI: shells peel off
the cover towards the magnet - that is the whole machine in one move. Pump:
follow the water, impeller up). Then one part at a time - what it does, and
what it feels like when it fails. Stop every three parts and ask if they
want to go deeper.

# Quiz mode

If they ask to be tested: ask them to NAME the part that fails first in a
scenario, wait, then say right or wrong in one short sentence - and if they
were wrong, explain in one sentence why the two parts get confused. Five
questions maximum.

# Honesty

Never invent a price, torque value or service interval. If you do not know,
say "I'd have to look that up" and give the safest general answer instead.
```

6. Open **Settings**:
   - **Language personalisation** → **Starting language**: English;
     turn **Switch language during call** **ON**; **Languages allowed**:
     English + Hindi (code-mixed speech works out of the box).
   - **Speakers & voice** → pick any voice; if pace is adjustable, nudge it up
     (technicians talk fast).
7. **Knowledge base — why this is NOT a blocker.** The in-app agent (the
   live demo) needs **zero uploads**: its knowledge is
   `backend/data/printer/procedures.json` + `parts.json`, read straight from
   disk by our own `get_procedure` / `lookup_part` tools — that pipeline is
   already proven (test_vaani.py chats with it). The only place an upload
   matters is this Indus phone twin. *(Optional, 2 min, strong demo)* here:
   1. On the agent's Canvas open the **Knowledge** tab → **+ Add source** /
      **Upload**.
   2. Turn `backend/data/printer/procedures.json` + `parts.json` into one
      readable text file (plain readable text beats raw JSON when the platform
      parses it — `parts.json` → lines like "nozzle — part name, price ... ,
      torque ..."). If the picker only accepts PDF/DOCX/URL, save the text as
      a PDF in Word and upload that instead.
   3. Upload and wait for the status to flip to indexed/trained/ready (a
      minute or two — keep an eye on the chip).
   4. Re-test: "मेरा एक्सट्रूडर क्लिक कर रहा है" — it should answer from the
      uploaded steps and refuse fabricated prices.
8. Open **test agent** and actually talk to it. Check: greeting → describe a
   fault in **Hindi** ("मेरा एक्सट्रूडर क्लिक कर रहा है") → it must answer in
   Hindi, safety first, one step at a time → interrupt mid-sentence → ask
   something it can't know (price) → it must refuse to invent.
9. **Deploy is NOT needed for the hackathon demo** — `test agent` is enough.
   If you want the flex for Q&A: **Deploy → Phone Numbers** (rent from Vaani
   or bring your own telephony) → assign to the agent → **Inbound Calls** →
   call it from any phone. **Monitor → Agent Analytics** then shows real
   transcripts + recordings (screenshot this for a slide).

---

## 3. The 14 tools — nothing to set up, everything to know

**There is no per-tool setup.** All 14 are already declared in
`backend/main.py` (`TOOL_SCHEMAS`, handed to the model with every turn) and
all 14 implementations are live. `/api/health` must report `tools: 14`.
Your job is to know what each one does and how to show it in 5 seconds.

**How the loop routes them:** the model returns `tool_calls` → tools in the
`SERVER_TOOLS` dict run inside the backend and their results feed the next
model round → tools in `BROWSER_TOOL_NAMES` are queued, returned to the
frontend, and fired in `clientTools.ts` right after the reply arrives — so
**the scene moves while the agent is still talking.**

### The 8 BROWSER tools (`frontend/src/clientTools.ts`)

| Tool | Does | Prove it by saying |
| --- | --- | --- |
| `switch_machine` | Loads printer / mri / pump | "I'm at the scanner now" |
| `set_explode` | 0 = assembled → 1 = fully exploded | "show me everything inside" |
| `focus_part` | Camera flies to a part | "where's the cold head?" |
| `highlight_part` | Glow + label a part | "which part fails first?" |
| `show_step` | Pins the current instruction on screen | fires on every repair step |
| `clear_scene` | Reset to assembled view | "start over" |
| `get_user_pointer` *(read)* | Which part is the cursor on | "what's THIS bit?" — the money shot |
| `get_view_state` *(read)* | Machine + focus + highlights + step | agent self-checks before answering |

### The 6 SERVER tools (`backend/main.py`, `SERVER_TOOLS` dict)

| Tool | Does | Prove it by saying |
| --- | --- | --- |
| `get_procedure` | Official steps + safety warning from the manifest | "my extruder is clicking" |
| `lookup_part` | Price, torque, tool, safety, service interval | "how much torque on the nozzle?" |
| `order_part` | Cart + order id + ETA (asks yes first) | "order me a new nozzle" |
| `log_repair` | Writes the structured service record | "log the repair" → report URL |
| `search_web` *(Anakin)* | Live search, cached per query | "what does a nozzle actually cost?" |
| `read_page` *(Anakin)* | Reads one URL via scrape job | "read that page and tell me" |

### Verify all 14 in 5 minutes

1. `http://127.0.0.1:8000/api/health` → `"tools": 14`.
2. Click **Start session**, wait for the spoken intro, then just say the phrases above; every call is logged in the
   panel's service log (`tool: get_procedure`, `highlight -> …`, `order …`,
   `web: search …`).
3. No mic? Drive the scene from DevTools console: `__th.set_explode({ level: 0.7 })`
   (`window.__th` exposes all 8 browser tools).
4. Server tools via curl (same code path the agent uses):
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/tools/lookup_part -ContentType 'application/json' -Headers @{ 'X-Tool-Secret'='third-hand-dev' } -Body '{"part_id":"nozzle"}'
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/tools/search_web -ContentType 'application/json' -Headers @{ 'X-Tool-Secret'='third-hand-dev' } -Body '{"query":"nozzle price"}'
   ```
5. Tool calls not firing? Speak a fault phrase, not a greeting — the model
   picks tools off the system prompt; check `SYSTEM_PROMPT` in `main.py`
   is intact and `/api/health` says 14.

### Adding tool #15 (if ever needed, ~15 min)

1. **Schema** — add `_fn("new_tool", "one-line description", {params}, [required])`
   to `SERVER_AND_WEB_SCHEMAS` (or the browser lists for scene tools) in
   `main.py`. The description steers the model — write it like an order.
2. **Implement** — server tool: `def _tool_new_tool(...)` + one line in the
   `SERVER_TOOLS` dict. Browser tool: same name in `clientTools.ts`.
3. **Restart uvicorn** → `/api/health` says 15 → speak the trigger phrase.

**Note:** the Indus (Samvaad) twin agent intentionally has **no tools** — it
is the phone-ready, knowledge-only persona. (Advanced, post-hackathon: Samvaad
supports webhook tools — point one at `/api/agent/turn` with the
`X-Tool-Secret` header and it inherits the full 14.)

---

## 4. PART B — run the app

**Env gotcha:** global `pip`/`python` on these machines belong to a *different*
project's venv. ALWAYS use `backend\.venv\Scripts\python.exe` explicitly.

Backend (PowerShell, repo root):
```powershell
cd backend
# first time only: python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env   # then paste BOTH keys into it (VAANI_API_KEY, ANAKIN_API_KEY)
.\.venv\Scripts\python.exe test_vaani.py   # expect: 3/3 Vaani checks passed
.\.venv\Scripts\python.exe test_anakin.py   # expect: 2/2 Anakin checks passed
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000   # keep this window open
```

Frontend (new terminal, repo root):
```powershell
cd frontend
npm install          # first time only
npm run dev          # open the printed http://localhost:5173
```

---

## 5. PART C — 10-minute verification checklist

1. Backend health: `http://127.0.0.1:8000/api/health` → `tools: 14`,
   machines `printer / mri / pump`, keys configured.
2. Page loads, red hint visible, machine tabs switch the 3D scene.
3. Click **Start session** → the agent introduces itself out loud, then the
   status chip flips to **listening - just talk**. Say *"my extruder is
   clicking"*. Expected: agent speaks, safety warning first, scene explodes
   + highlights a part, service log and procedure step appear in the panel.
4. Say *"what does a replacement nozzle actually cost?"* → agent searches
   live (Anakin), answers with a source; **LIVE WEB** cards appear in the
   panel; click one.
5. Switch machine tab to **MRI**, say *"where is the quench button?"* →
   scene refocuses on the MRI part.
6. Say something in Hindi → reply comes back in Hindi.
7. Sponsor smoke tests (optional): `.\.venv\Scripts\python.exe test_vaani.py`
   then `test_anakin.py` inside `backend` (3 + 2 checks).

If any step fails → troubleshooting table below.

---

## 6. PART D — the 90-second demo

> The **screen-recorder version** — exact narration, timestamps, OBS settings,
> click-by-click — is in **`DEMO_SCRIPT.md`** at the repo root. Rehearse this
> live version first, then record from the script.

1. **(0:00)** Scene on printer. *"This is Third Hand — a voice agent that can
   see what you're looking at."*
2. **(0:10)** Click **Start session** — spoken intro (first thing the judges
   hear). Then just talk, no buttons: *"my extruder is clicking"* — safety
   first, scene explodes and highlights the part while the agent speaks.
   **(Vaani ears + brain + voice + our 14 tools.)**
3. **(0:35)** Point-and-ask: *"what's this bit?"* — it reads your pointer
   and answers about THAT part.
4. **(0:45)** *"What does a nozzle actually cost?"* — live Anakin search,
   source cards appear. **(Sponsor #2.)**
5. **(0:55)** Hindi: *"हिंदी में बताओ, पावर ऑफ़ कैसे करें?"* — replies in Hindi.
6. **(1:05)** Tab to the Indus **test agent** (phone or browser): same persona
   talking — *"and here's the same agent as a no-code Voice Agent on Indus,
   one click from a phone number."* **(Sponsor platform #1.)**
7. **(1:20)** Wrap: *"Three machines, one manifest. The technician never puts
   their tools down."*

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Vaani 403 `invalid_api_key_error` | Key is wrong/scoped. Use a **general** `sk_` key from `dashboard.vaani.dev` API Keys (NOT `sk_samvaad…`). Paste into `backend/.env`, rerun `test_vaani.py`. |
| Anakin search/scrape fails | Check `ANAKIN_API_KEY` in `backend/.env`; run `test_anakin.py` for the exact status. Heavy pages: `read_page` polls ~24 s, then the agent answers from search snippets — that is by design. |
| `python test_vaani.py` imports fail | You used the wrong python. Use `backend\.venv\Scripts\python.exe`. |
| STT endpoint 422 | `python-multipart` missing → `.\.venv\Scripts\python.exe -m pip install python-multipart` (it is in requirements.txt). |
| Browser: agent never answers | Backend not running, or `vite.config.ts` proxy target not `:8000`. Check the dev-server terminal for proxy errors. |
| Agent never calls scene tools | Speak a fault phrase ("extruder clicking", "pump leaking") — greetings alone may not trigger tools. Check `/api/health` says `tools: 14`. |
| Mic permission denied | Use Chrome/Edge on `localhost`, allow mic when prompted (hands-free: the mic stays open for the whole session). |
| Agent cuts you off / talks over you | It sends ~1.3 s after you stop. A noisy hall can trip the voice detector — use a headset mic, and Escape or End session to hang up. |

---

## 8. Repo map

| Path | What it is |
| --- | --- |
| `backend/main.py` | The entire agent: prompt, 14 tools, `/api/stt` `/api/agent/turn` `/api/tts`, session |
| `backend/data/*/` | Machine manifests: `parts.json`, `procedures.json` (+ GLB in `frontend`) |
| `backend/test_vaani.py` / `test_anakin.py` | Sponsor API smoke tests (run these first, always) |
| `frontend/src/voiceAgent.ts` | Hands-free voice hook: VAD → STT → turn → tools → TTS |
| `frontend/src/clientTools.ts` | The 8 browser (scene) tools |
| `AGENT_SETUP.md` | Deep doc on the prompt + tool contract |
| `VAANI_SETUP.md` | Vaani/Anakin API details: models, endpoints, curl examples |
| `DEMO_SCRIPT.md` | Screen-recorder version of the demo: narration, timestamps, OBS setup |


