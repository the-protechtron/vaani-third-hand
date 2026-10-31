# SUBMISSION_ANSWERS — paste these into the form

Answer style: detailed but tight enough to paste as-is. Written from the code
that actually runs (`backend/main.py`, `frontend/src/voiceAgent.ts`, 14 tools).

---

## Q1. What does your project do? What problem does it solve, and who is it for?

Third Hand is a hands-free voice agent for field-service technicians repairing
industrial machines. A technician walks up to a broken 3D printer, MRI machine
or industrial pump, opens Third Hand in a browser, and the machine appears as
an interactive 3D model. Then they just talk — the agent can see what they are
looking at (it tracks the cursor and reads the live 3D view state before every
answer), and it guides the repair one step at a time.

The problems it solves:

- **Manuals don't fit the job.** Technicians stand inside machines with greasy,
  busy hands — they can't scroll a PDF or type. Third Hand is speech-first:
  you say "my extruder is clicking," and it explodes the 3D model, highlights
  the part, and walks you through the official procedure with a safety warning
  first.
- **One place for knowing + the web.** The agent has 14 tools: official
  procedures, part lookup (price, torque, tool, safety, service interval),
  parts ordering with ETAs, automatic service records — plus live web search so
  it can quote *current* market prices, community fixes and recalls, with
  source cards shown on screen.
- **Local language matters.** Indian field service is reported in Hindi or
  code-mixed Hinglish as often as English. Third Hand understands 22 Indian
  languages and replies in the language the technician speaks.

Who it is for: technicians maintaining 3D printers, MRI/radiology equipment and
industrial pumps in clinics, print shops and factories — and, at its core, any
repair setting that has a parts-and-procedures database. Our demo runs against
three machine manifests (printer, MRI, pump).

---

## Q2. How did you use Vaani in your project?

Vaani is the entire brain, ears and voice of the agent — three models in one
voice loop, all server-side (keys never touch the frontend):

1. **Speech-to-text — Saaras v3.** The browser mic listens hands-free
   (voice-activity detection ends the utterance on ~1.3 s of silence). Each
   clip is transcoded to 16 kHz mono WAV and sent to `/speech-to-text`. Saaras
   auto-detects the language, so a fault can be reported in Hindi, English or
   code-mixed Hinglish, and the detected language is threaded through the turn
   so the reply comes back in the same language.

2. **Reasoning + tool calling — vaani-105b-conversations** (chat completions,
   OpenAI-compatible). This is the agent brain. Every turn sends the full
   14-tool schema plus the current 3D view state; the model decides which
   procedure to fetch, which part to highlight, whether to search the web, and
   whether to place an order. Tool calls are **streamed as NDJSON in real
   time**, so scene tools (explode, highlight, step) fire in the browser while
   the model is still composing the spoken reply — the scene moves before the
   answer is even spoken.

3. **Text-to-speech — Bulbul v3** (speaker "Shubh", pace 1.05). Replies are
   split into sentences and synthesized in parallel, so the first sentence
   starts playing in ~1 s while the rest generate. Saaras's detected language
   flows straight into Bulbul — a Hindi query gets a spoken Hindi answer with
   no translation layer.

We also built a twin of the same agent on Vaani's no-code **Voice Agents**
platform (Indus / Samvaad): same persona, safety-first, one-step-at-a-time,
deployable to a phone number — which we show in the demo as the "one click from
a phone line" beat.

---

## Q3. How did you use Anakin in your project?

Anakin is our live-web layer, called from the backend only. We use two Anakin
APIs, exposed to the agent as two tools:

1. **Search API** (`POST https://api.anakin.io/v1/search` with `{prompt, limit}`)
   — the `search_web` tool. When a technician asks "what does a replacement
   nozzle actually cost?", "has anyone else seen this clicking extruder?" or
   "is there a recall?", the agent runs a live web search. The results — title,
   URL, snippet — appear in the UI as **LIVE WEB source cards** with the domain
   name and an auto-extracted price pill, so judges see the real source behind
   the agent's answer. Responses are cached per query, so the same question on
   stage is instant.

2. **URL crawler/scraper** — the `read_page` tool. When a search snippet isn't
   enough, the agent submits the URL to Anakin's crawl API, polls the job, and
   reads the page's markdown before answering — e.g. pulling a product page or
   a forum thread as grounding.

Why Anakin is central: the agent doesn't just recite its built-in catalogue.
When it says a part costs ₹X, that's a **live, current market price** with a
source card on screen — "two forum threads and the OEM bulletin agree." That
source-backed answer is the moment in the demo where it stops being a static
demo and becomes an agent that checks reality before it speaks.

---

## Bonus fields the form also asks for

**One example input for judges to try:** *"my extruder is clicking"* — the
scene explodes, the part is highlighted, and it walks through the fix; then
*"what does a replacement nozzle actually cost?"* — live Anakin search with
source cards and a price.

**Limitations to declare:** TTS synthesis adds ~1–2 s to replies (we chunk and
stream to hide it); the agent can't be interrupted mid-sentence (the mic closes
while it speaks); Anakin crawls heavy JavaScript pages slowly, so deep reads
degrade gracefully to search snippets; the phone twin answers from a knowledge
base rather than the live scene.