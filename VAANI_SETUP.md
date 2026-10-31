# Vaani Indus + Anakin setup — paste-ready

Third Hand's brain and voice now run on **Vaani's Indus stack** (the same key
from `vaani.dev`). Live web facts run on **Anakin.io**. Nothing else
changed: same 3D scene, same part data, same closed pointer loop.

> Team onboarding? Start with **TEAM_SETUP.md** — it covers accounts, the
> Indus Voice-Agent configuration, running the app, and the demo script.
> This file is the deeper API reference.

The agent loop is OURS now, not a third-party dashboard's:

```
talk (VAD) ──► mic→wav16k ──► /api/stt (saaras:v3)
                                    │ transcript
                                    ▼
     /api/agent/turn (vaani-105b-conversations, 14 tools, tool calling)
        │                          │
   BROWSER tools              SERVER tools
   (clientTools.ts —          (get_procedure, lookup_part, order_part,
    unchanged, executed        log_repair  +  NEW: search_web, read_page
    in the browser)              │                  │
        │                        ▼                  ▼
        │                 FastAPI answers    Anakin.io live web
        │                        │
        ▼                        ▼
   scene moves ───────►  /api/tts (bulbul:v3) ──► voice plays
```

**No ngrok. No ElevenLabs. Two API keys total.** Vaani calls nothing of ours —
our backend orchestrates the whole loop, so the #1 demo-day failure from last
time (stale tunnel URLs) is gone.

---

## 0. Keys — 10 minutes, do this first

| What | Where | Looks like |
|---|---|---|
| Vaani API key | Dashboard **API Keys** page (`dashboard.vaani.dev`), or the Indus portal's key-management. ⚠️ Keys prefixed `sk_samvaad` are Samvaad/Voice-Agents scoped — chat/STT/TTS reject them with 403. | `sk_...` |
| Anakin API key | Anakin dashboard → API keys. Search is synchronous; the scraper is a job (submit → poll). | `ask_...` |

Both go in `backend/.env` and NOWHERE ELSE. Never in frontend code.

```env
VAANI_API_KEY=sk_xxxxxxxx
ANAKIN_API_KEY=ak_xxxxxxxx
TOOL_SECRET=third-hand-dev
```

One Vaani key covers every model we use:

| Stage | Model | Why this one |
|---|---|---|
| Ears (STT) | `saaras:v3` | 22 Indian languages + English, auto-detect, code-mixed |
| Brain (LLM) | `vaani-105b-conversations` | Vaani's flagship tuned for real-time voice agents, native tool calling |
| Voice (TTS) | `bulbul:v3`, speaker `shubh` | calm, low, handles code-mixed text; `pace 1.05` |
| Live web | Anakin Search + URL Scraper | fresh sources with citations |

---

## 1. First calls — print REAL output before building any UI

This is the 11:40–12:05 milestone of the sprint. Two scripts, zero UI:

```bash
cd backend
.venv/Scripts/activate          # Windows; `source .venv/bin/activate` on mac/linux
pip install -U vaaniai
python test_vaani.py           # 3 checks: chat + tts + stt
python test_anakin.py           # 2 checks: search + scrape
```

`test_vaani.py` exercises all three Vaani stages end-to-end (it even
transcribes the audio the TTS step just produced). `test_anakin.py` searches
the live web and scrapes the first hit. When all five lines print ✅, every
sponsor API in the rubric is proven and everything after this is your own code.

---

## 2. What the backend runs (`backend/main.py`)

| Endpoint | Job |
|---|---|
| `POST /api/stt` | browser uploads the utterance (16 kHz mono WAV, transcoded client-side) → saaras:v3 → `{text, language}` |
| `POST /api/agent/turn` | transcript + view state → vaani-105b-conversations with 14 tool schemas → runs SERVER tools itself → **streams NDJSON**: one `{type:"tool"}` event per scene tool the moment it queues (the scene fires mid-turn), then `{type:"final", speech, sources}` |
| `POST /api/tts` | reply text → bulbul:v3 → `{audio_b64}` (base64 WAV) |
| `POST /api/tools/search_web` | **NEW — Anakin** Search API, cached per query, sources saved for the panel |
| `POST /api/tools/read_page` | **NEW — Anakin** URL Scraper → markdown the agent can read |
| `POST /api/tools/get_procedure` etc. | the original four — untouched, still machine-scoped |

Keys stay server-side. The browser talks only to our FastAPI.

## 3. The tools — 14 total, was 12

Same names, same parameters, same client/server split as `AGENT_SETUP.md`.
They now live in a Python list handed to Vaani instead of a dashboard.

Two new ones, and they slot straight into the machine-scoped pattern:

- **`search_web(query)`** — community fixes, recalls, LIVE part prices from the
  real web. Sources are shown on screen in the panel, with links. Cite out
  loud: "two forum threads and the OEM bulletin agree".
- **`read_page(url)`** — pull one source page when a snippet is not enough.

Add to the system prompt (below `# Machines`):

```
# The live web

You also have search_web and read_page, backed by a live search engine.
Use search_web when a technician asks "has anyone else seen this", "is there
a recall", "what does this part actually cost", or when your built-in
procedure might be stale. Read the results, then say where it came from.
Never invent a URL. If search fails, say so in one line and continue with
get_procedure.
```

And one new line under `# How you speak`:

```
- Reply in the language the technician used - Hindi in, Hindi out, Tamil in,
  Tamil out. Keep it short either way.
```

That second line is the multilingual beat: Saaras auto-detects the language,
the model answers in it, Bulbul speaks it. Zero translation layer.

## 4. Voice loop — how the demo actually sounds

**Shipped: hands-free, no push-to-talk.** Click **Start session** — the agent
introduces itself (TTS), then the mic listens continuously. End-of-utterance
is mic-energy VAD: once you have spoken and stay quiet ~1.3 s, the clip ships.
One utterance → transcript → agent turn (scene moves) → voice plays → back to
listening. The mic is never open while the agent speaks, so it cannot hear
itself. The status chip shows `listening → thinking → speaking`.

**If we ever want true streaming:** Vaani's realtime socket
`wss://api.vaani.dev/speech-to-text-realtime/ws` (`saaras:v3-realtime`) gives
partial transcripts and native endpointing — a drop-in upgrade for the
upload-per-utterance approach above. Don't start there on a 90-minute clock.

## 5. Run it

```bash
# terminal 1
cd backend
.venv/Scripts/activate
uvicorn main:app --reload --port 8000

# terminal 2
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Smoke tests in order:

1. `python test_vaani.py` → 3 ✅
2. `python test_anakin.py` → 2 ✅
3. Browser: click **Start session**, wait for the spoken intro, then say *"my extruder is clicking"* →
   scene explodes, step 1 lands on screen, voice replies.
4. Say *"what does a nozzle actually cost these days"* → `search_web` fires,
   source cards appear in the panel, it quotes a real price with a link.
5. Hover a part, say *"what's this?"* → `get_user_pointer` → answers about the
   part under your cursor. The loop survives the migration intact.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| 403 from Vaani, `invalid_api_key_error` | The key itself was rejected — `sk_samvaad…` keys are Samvaad/Voice-Agents scoped and do not work for chat/STT/TTS. Copy a **general** API key from the dashboard's API Keys page (shown once — save it immediately), paste into `backend/.env`, rerun `test_vaani.py`. |
| Anakin page never finishes reading | Heavy JS pages render for minutes. `read_page` polls ~24 s, then tells the agent to answer from the search snippets instead. Search itself is synchronous and instant. |
| 429 from Anakin | 60 req/min; the backend caches searches, but don't hammer it live |
| Agent skips scene tools | same as before: it's a prompt problem. Re-check the ordering rules survived into the prompt in `main.py` |
| TTS takes 1–2 s | normal. Replies now stream **sentence-by-sentence** — the first sentence starts speaking in ~1 s while the rest synthesises. The LIVE panel shows `thinking → speaking`, which makes the pipeline visible — that's a rubric point, not a bug |
| 422 on transcribe | utterance over 30 s — the VAD force-stops at 25 s, so this now needs a long monologue |
| `agent_configured: false` in `/api/health` | keys missing from `backend/.env` |
| Mic blocked | Chrome needs `localhost` or HTTPS — you're on `localhost:5173`, fine |
| Agent answers in English when you spoke Hindi | say "reply in Hindi" once; the STT language field drives TTS automatically |

