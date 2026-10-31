"""
Third Hand - backend.

The WHOLE agent loop lives here now:

    browser records an utterance
      -> POST /api/stt        saaras:v3 turns it into text
      -> POST /api/agent/turn vaani-105b-conversations reasons with 14 tools;
                               server tools run here, browser tools STREAM to the
                               screen the moment they are queued (NDJSON)
      -> POST /api/tts        bulbul:v3 turns the reply into base64 WAV

Vaani = ears + brain + voice. Anakin = live web (search_web / read_page).
No third-party dashboard, no ngrok: our process drives every call, and both
API keys stay in backend/.env.

Run:
    uvicorn main:app --reload --port 8000
Smoke:
    python test_vaani.py     (3 checks: chat / tts / stt)
    python test_anakin.py     (2 checks: search / scrape)
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import lab

load_dotenv()

DATA = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Load every machine folder under data/
# ---------------------------------------------------------------------------
MACHINE_NAMES = {
    "printer": "Ender-3 class FDM printer",
    "mri": "1.5T Superconducting MRI",
    "pump": "End-Suction Centrifugal Pump",
    "scooter": "110 cc Commuter Scooter (DIY-safe checks)",
}

MACHINES: Dict[str, Dict[str, Any]] = {}
for folder in sorted(p for p in DATA.iterdir() if p.is_dir()):
    MACHINES[folder.name] = {
        "id": folder.name,
        "name": MACHINE_NAMES.get(folder.name, folder.name),
        "parts": json.loads((folder / "parts.json").read_text()),
        "procedures": json.loads((folder / "procedures.json").read_text()),
    }

DEFAULT_MACHINE = "printer" if "printer" in MACHINES else next(iter(MACHINES))

# ---------------------------------------------------------------------------
# Sponsor APIs
# ---------------------------------------------------------------------------
VAANI_API_KEY = os.getenv("VAANI_API_KEY", "")
ANAKIN_API_KEY = os.getenv("ANAKIN_API_KEY", "")
TOOL_SECRET = os.getenv("TOOL_SECRET", "third-hand-dev")

VAANI_BASE = "https://api.vaanivoice.ai"
VAANI_AGENT_ID = os.getenv("VAANI_AGENT_ID", "")
ANAKIN_BASE = "https://api.anakin.io/v1"
STT_MODEL = "saaras:v3"
LLM_MODEL = "vaani-105b-conversations"
TTS_MODEL = "bulbul:v3"
TTS_SPEAKER = "shubh"
TTS_PACE = 1.05          # technicians talk fast; so should the agent
TTS_LANGS = {
    "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN",
    "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
}
MAX_TOOL_ROUNDS = 6      # guard on the tool-calling loop
LLM_MAX_TOKENS = 400     # spoken replies are short; a low cap = faster replies

app = FastAPI(title="Third Hand")
app.include_router(lab.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # hackathon setting. Tighten for anything real.
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# In-memory session state. The frontend polls /api/session so the on-screen
# cart, service log and web sources update the moment the agent calls a tool.
# --------------------------------------------------------------------------
SESSION: Dict[str, Any] = {
    "session_id": uuid.uuid4().hex[:8],
    "machine": DEFAULT_MACHINE,
    "cart": [],          # [{part_id, name, sku, qty, price_inr, order_id}]
    "log": [],           # [{ts, kind, detail}]
    "procedure": None,   # the active procedure dict
    "reports": {},       # session_id -> report
    "sources": [],       # last web sources for the panel (title + url)
    # What the browser should show. `seq` bumps on every change; the frontend
    # polls it and replays the scene (focus, highlight, explode, step card).
    "looked_up": [],     # [(machine_id, part_id)] the agent has asked about
    "scene": {"seq": 0, "machine": None, "part_id": None, "label": None, "explode": 0.0, "step": None},
}

_SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}   # query -> search_web result
_PAGE_CACHE: Dict[str, Dict[str, Any]] = {}     # url -> read_page result


def _log(kind: str, detail: str) -> None:
    SESSION["log"].append({"ts": time.time(), "kind": kind, "detail": detail})
    SESSION["log"][:] = SESSION["log"][-60:]


def _set_scene(machine_id: str, part_id: Optional[str], label: Optional[str],
               explode: float = 0.0, step: Optional[Dict[str, Any]] = None) -> None:
    sc = SESSION["scene"]
    sc.update(seq=sc["seq"] + 1, machine=machine_id, part_id=part_id, label=label,
              explode=explode, step=step)


def _step_card(proc: Dict[str, Any], s: Dict[str, Any]) -> Dict[str, Any]:
    return {"n": s["n"], "total": len(proc["steps"]), "instruction": s["instruction"],
            "tool": s.get("tool"), "check": s.get("check")}


def _auth(secret: Optional[str]) -> None:
    """HTTP wrappers around the tools send this header, so randoms who find
    the port cannot drive your cart. Curl /api/tools/* with X-Tool-Secret."""
    if TOOL_SECRET and secret != TOOL_SECRET:
        raise HTTPException(status_code=401, detail="bad tool secret")


def _vaani_headers() -> Dict[str, str]:
    """Vaani accepts either auth header; send both so OpenAI-style tooling
    pointed at /v1/chat/completions just works."""
    return {
        "api-subscription-key": VAANI_API_KEY,
        "Authorization": f"Bearer {VAANI_API_KEY}",
    }


# --------------------------------------------------------------------------
# Tools may name a machine explicitly. If they don't, use whatever the
# browser last switched to. The agent should rarely need to pass it.
# --------------------------------------------------------------------------
def _machine(requested: Optional[str]) -> Dict[str, Any]:
    key = (requested or "").strip().lower()
    if key in MACHINES:
        if key != SESSION["machine"]:
            SESSION["machine"] = key
            _log("machine", MACHINES[key]["name"])
        return MACHINES[key]
    return MACHINES[SESSION["machine"]]


# --------------------------------------------------------------------------
# The system prompt. Ported 1:1 from AGENT_SETUP.md, plus two new blocks:
# the live web, and reply-in-the-same-language. This is where demos are won.
# --------------------------------------------------------------------------
SYSTEM_PROMPT = """
# Who you are

You are Third Hand. You guide someone who is standing at a real machine with
their hands inside it. Their hands are busy and their eyes are on the hardware,
not on you. You are their second pair of eyes and their memory.

You share a screen with them. A live 3D model of the machine is on that screen
and YOU CONTROL IT. This is the single most important thing about you: you do
not describe parts in words, you show them.

# Machines

Three machines are loaded:
  - "printer" - an Ender-3 class desktop FDM 3D printer
  - "mri"     - a 1.5T superconducting MRI scanner
  - "pump"    - an end-suction centrifugal pump and its motor

The moment the technician mentions which machine they are on, call
switch_machine. Its return value lists every part id available on that machine -
read that list and use those ids for the rest of the session. Never guess a
part id. Never use a printer part id while the scanner is on screen.

If you cannot tell which machine they mean, ask once, in four words.

# How you speak

- Short sentences. One instruction at a time. Their hands are busy.
- HARD CAP: at most THREE sentences per spoken answer, fewer when you can.
  Anything longer belongs on screen (show_step), not in the air.
- Never read a list out loud. Put it on screen with show_step instead.
- Never say "part_id nozzle" or any other identifier out loud. Say "the nozzle".
- Refer to what is on screen: "the part now glowing orange", "the ring that
  just slid out towards you".
- No filler. No "great question". No repeating what they just said back.
- If they interrupt you, stop immediately and answer what they asked.
- Reply in the language the technician used - Hindi in, Hindi out, Tamil in,
  Tamil out. Keep it short either way.

# MODE 1 - REPAIR (the default)

1. They describe a fault in their own words.
2. Call get_procedure with their exact words as `symptom`.
3. Read the safety_warning out loud FIRST, always. Do not skip it, do not
   summarise it, do not save it for later.
4. Then, for EVERY step, in this order:
     a. call set_explode with that step's `explode` value
     b. call focus_part on that step's `part_id`
     c. call highlight_part on that step's `part_id`, with a SHORT label
        (3-5 words, e.g. "cut 10 mm off here")
     d. call show_step with the step number, instruction, tool and check
     e. ONLY THEN speak - a one or two sentence version of the instruction
5. Stop. Wait. Do not read the next step until they say the current one is
   done, or that it did not work.
6. If a step fixes it, skip to the wrap-up.



# MODE 2 - LEARN

If they say they are new to the machine, or ask you to walk them through it, or
say "teach me" / "explain this" / "what am I looking at", switch to a tour:

- Start assembled. set_explode 0. clear_scene.
- Go outside-in or upstream-down, whichever suits the machine. On the scanner,
  peel the shells from the cover inwards - that is the whole mental model of an
  MRI in thirty seconds and it is the reason the 3D exists.
- For each part: set_explode, focus_part, highlight_part, then TWO sentences.
  What it does, and what it feels like when it fails. Nothing else.
- Call lookup_part when you want the real service interval or safety note -
  never invent one.
- Stop every three parts and ask if they want to go deeper or move on.

# MODE 3 - QUIZ

If they ask to be tested, or you have just finished a tour, offer a quick check.
Then:

- Ask them to POINT at a part: "point at the part that fails first when the
  chiller filter blocks."
- Wait. Then call get_user_pointer.
- If they are right, say so in four words and ask the next one.
- If they are wrong, do NOT just correct them. Highlight what they picked AND
  the right answer in a different colour, and say in one sentence why the two
  get confused.
- Five questions maximum, then stop.

# When they point at something

If they say "this", "that", "here", "this bit", "the thing I'm looking at" -
they are pointing at the screen. Call get_user_pointer to find out what. Then
answer about THAT part. Call lookup_part if you need its price, torque, safety
note, tool or service interval.

Never ask "which part do you mean?" before calling get_user_pointer. Look first.

If you are about to mention a part and are unsure it is on screen, call
get_view_state.

# Parts and ordering

- Quote torque figures, tool sizes and safety notes exactly as lookup_part
  returns them. Getting a torque wrong damages the machine.
- Some parts are not field-orderable. order_part will refuse them and tell you
  why. Pass that on plainly - do not try again with a different quantity.
- Only call order_part after they say yes. Confirm part and price first, then
  read back the order id and the ETA.



# The live web

You also have search_web and read_page, backed by a live search engine.
Use search_web when a technician asks "has anyone else seen this", "is there
a recall", "what does this part actually cost", or when your built-in
procedure might be stale. Read the results, then say where it came from.
Never invent a URL. If search fails, say so in one line and continue with
get_procedure.

# Wrapping up

When the job is resolved or they want to stop, call log_repair with a
one-sentence summary, the root_cause part id, the steps completed and any parts
used. Then tell them the service record is on screen, and stop talking.

# Safety

You are the only one who remembers safety. Before any step involving heat,
stored energy, or the magnet, say the hazard out loud before the instruction.

Three absolute rules:
- On the printer, for a thermal runaway fault, the first words out of your
  mouth are "unplug it at the wall" - before the procedure title, before
  anything.
- On the scanner, the magnet is ALWAYS on, even when the system is powered
  down. Any time you send someone into the magnet room, say it. For a quench,
  the first words are "do not enter that room" - helium displaces oxygen and
  that is what kills people, not the cold.
- On the pump, before any step that opens the casing, say lock out the motor
  AND shut both the suction and discharge valves. A pump opened against a live
  line empties the system over the technician.

# Hard rules

- Never invent a part, price, torque spec, safety note or step. If a tool did
  not give it to you, say you do not have it.
- Never move to the next step without confirmation.
- Never let the screen go stale. If you are talking about a part, that part
  should be focused and highlighted.
"""

# Browser tools do not answer back mid-turn: they are queued during
# /api/agent/turn and fire on the scene the moment it returns. Tell the model
# that plainly so it never waits on them. The fresh screen state is appended
# to the system prompt every turn, so it can trust what it "sees".
BROWSER_NOTE = """

# How your tools run

Scene tools (switch_machine, set_explode, focus_part, highlight_part,
show_step, clear_scene, get_user_pointer, get_view_state) act on the screen
the instant your turn ends; you will not receive their return value. When you
need DATA about a part, call lookup_part - do not wait on a scene tool.
"""



# --------------------------------------------------------------------------
# TOOL SCHEMAS - all 14, OpenAI function format, handed to Vaani every turn.
# The 8 scene tools mirror frontend/src/clientTools.ts exactly.
# --------------------------------------------------------------------------
BROWSER_TOOL_NAMES = {
    "switch_machine", "focus_part", "highlight_part", "set_explode",
    "show_step", "clear_scene", "get_user_pointer", "get_view_state",
}


def _fn(name: str, description: str, props: Dict[str, Any], required: List[str]) -> Dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": props, "required": required},
        },
    }


BROWSER_SCHEMAS_A: List[Dict[str, Any]] = [
    _fn(
        "switch_machine",
        "Put a different machine on screen. Call this the moment the technician "
        "mentions a machine that is not the one currently loaded. The response "
        "lists every part id on that machine - use only those ids afterwards.",
        {"machine": {"type": "string", "description": "printer, mri or pump. Loose words like 'scanner' or 'Ender' also work."}},
        ["machine"],
    ),
    _fn(
        "focus_part",
        "Fly the on-screen camera to a part so the technician can see it. Call "
        "this before you talk about any part.",
        {
            "part_id": {"type": "string", "description": "A part id from the current machine"},
            "zoom": {"type": "number", "description": "1 = normal, 2 = close up, 0.7 = pull back for context. Default 1."},
        },
        ["part_id"],
    ),
    _fn(
        "highlight_part",
        "Make a part glow on screen and hang a short label on it. This is how "
        "you point at things. Everything else dims, so use it on every step.",
        {
            "part_id": {"type": "string", "description": "A part id from the current machine"},
            "color": {"type": "string", "description": "Hex. Default orange #ff7a1a. #ef4444 danger, #38bdf8 reference/second answer."},
            "label": {"type": "string", "description": "3-5 words max. Shown next to the part on screen."},
        },
        ["part_id"],
    ),
    _fn(
        "set_explode",
        "Pull the assembly apart so buried parts become visible. 0 = assembled, "
        "1 = fully exploded. On the scanner this telescopes the seven concentric "
        "shells apart - use it generously.",
        {"level": {"type": "number", "description": "0 to 1. Use the `explode` value from the current procedure step."}},
        ["level"],
    ),
]



BROWSER_SCHEMAS_B: List[Dict[str, Any]] = [
    _fn(
        "show_step",
        "Put the current instruction on screen so the technician can re-read it "
        "with dirty hands.",
        {
            "step_number": {"type": "integer", "description": "Which step this is"},
            "total_steps": {"type": "integer", "description": "Total steps in the procedure"},
            "instruction": {"type": "string", "description": "The step, in one short line"},
            "tool": {"type": "string", "description": "Tool needed, e.g. '2.5 mm hex'"},
            "check": {"type": "string", "description": "How the technician knows this step is done"},
        },
        ["step_number", "instruction"],
    ),
    _fn(
        "clear_scene",
        "Reset to the fully assembled view with no highlights. Call when starting "
        "a new fault or beginning a tour.",
        {},
        [],
    ),
    _fn(
        "get_user_pointer",
        "Find out which part the technician's cursor is on. Call this the instant "
        "they say 'this', 'that', 'here' or 'this bit', instead of asking them "
        "which part they mean. Also use it to mark answers in quiz mode.",
        {},
        [],
    ),
    _fn(
        "get_view_state",
        "Read back what is on screen: current machine, focused part, explode "
        "level, highlights, step, and the full list of available parts. Use it "
        "if you are unsure whether a part is visible.",
        {},
        [],
    ),
]



SERVER_AND_WEB_SCHEMAS: List[Dict[str, Any]] = [
    _fn(
        "get_procedure",
        "Look up the official service procedure for a fault. ALWAYS call this "
        "first, with the technician's own words.",
        {
            "symptom": {"type": "string", "description": "What the technician described, in their own words"},
            "machine": {"type": "string", "enum": ["printer", "mri", "pump"], "description": "Omit to use what is on screen."},
        },
        ["symptom"],
    ),
    _fn(
        "lookup_part",
        "Get price, stock, torque spec, required tool, safety note and service "
        "interval for a part.",
        {
            "part_id": {"type": "string", "description": "Part identifier, e.g. nozzle, cold_head, chiller"},
            "machine": {"type": "string", "enum": ["printer", "mri", "pump"], "description": "Omit to use what is on screen."},
        },
        ["part_id"],
    ),
    _fn(
        "order_part",
        "Order a replacement part. Only call after the technician says yes. "
        "Refuses parts that are not field-serviceable.",
        {
            "part_id": {"type": "string"},
            "quantity": {"type": "integer", "description": "Default 1"},
            "machine": {"type": "string", "enum": ["printer", "mri", "pump"], "description": "Omit to use what is on screen."},
        },
        ["part_id"],
    ),
    _fn(
        "log_repair",
        "Write the service record at the end of the job.",
        {
            "summary": {"type": "string", "description": "One sentence, plain language"},
            "root_cause": {"type": "string", "description": "The part id that caused it, if known"},
            "steps_completed": {"type": "array", "items": {"type": "string"}, "description": "Step titles that were completed"},
            "parts_used": {"type": "array", "items": {"type": "string"}, "description": "Part ids used"},
            "outcome": {"type": "string", "enum": ["resolved", "escalated", "abandoned"]},
        },
        ["summary"],
    ),
    _fn(
        "search_web",
        "Search the LIVE web (Anakin) for community fixes, recalls, or current "
        "part prices beyond our catalogue. Results arrive as a list of sources "
        "with titles and URLs - say where your answer came from.",
        {"query": {"type": "string", "description": "The search query, plain words"}},
        ["query"],
    ),
    _fn(
        "read_page",
        "Fetch and read one web page (Anakin scraper) when a search snippet is "
        "not enough. Pass the exact URL from search_web results.",
        {"url": {"type": "string", "description": "The page URL to read"}},
        ["url"],
    ),
]

TOOL_SCHEMAS: List[Dict[str, Any]] = (
    BROWSER_SCHEMAS_A + BROWSER_SCHEMAS_B + SERVER_AND_WEB_SCHEMAS
)



# --------------------------------------------------------------------------
# TOOL IMPLEMENTATIONS - the agent's server-side hands.
# --------------------------------------------------------------------------
def _tool_get_procedure(symptom: str, machine: Optional[str] = None) -> Dict[str, Any]:
    """Fuzzy-match a spoken complaint to a repair procedure."""
    m = _machine(machine)
    q = symptom.lower()

    best, best_score = None, 0
    for proc in m["procedures"].values():
        score = 0
        for s in proc["symptoms"]:
            if s in q:
                score += len(s.split()) * 3
            else:
                score += sum(1 for w in s.split() if len(w) > 3 and w in q)
        for w in proc["title"].lower().split():
            if len(w) > 4 and w in q:
                score += 2
        if score > best_score:
            best, best_score = proc, score

    if not best:
        return {
            "found": False,
            "machine": m["id"],
            "message": "No matching procedure. Ask one clarifying question, then try again.",
            "available": [
                {"id": p["id"], "title": p["title"]} for p in m["procedures"].values()
            ],
        }

    SESSION["procedure"] = best
    _log("procedure", best["title"])
    s1 = best["steps"][0]
    _set_scene(m["id"], s1["part_id"], s1.get("label") or s1["part_id"].replace("_", " "),
               s1.get("explode", 0.0), _step_card(best, s1))
    return {
        "found": True,
        "machine": m["id"],
        "machine_name": m["name"],
        "procedure_id": best["id"],
        "title": best["title"],
        "estimated_minutes": best["est_minutes"],
        "safety_warning": best["safety"],
        "total_steps": len(best["steps"]),
        "steps": best["steps"],
        "likely_parts": best["likely_parts"],
        "instruction_to_agent": (
            "Step 1 is ALREADY exploded, highlighted and pinned on screen for you - "
            "do NOT call scene tools for it. Speak the safety warning first, then "
            "the step 1 instruction, in at most three sentences total, and wait. "
            "For every LATER step: call set_explode, focus_part, highlight_part "
            "and show_step for that step's part, then speak one or two sentences. "
            "Wait for the technician to confirm each step before moving on."
        ),
    }


def _tool_lookup_part(part_id: str, machine: Optional[str] = None) -> Dict[str, Any]:
    m = _machine(machine)
    part = m["parts"].get((part_id or "").strip().lower())
    if not part:
        return {"found": False, "machine": m["id"], "known_parts": sorted(m["parts"].keys())}
    _log("lookup", part["name"])
    seen = SESSION["looked_up"]
    if (m["id"], part["id"]) not in seen:
        seen.append((m["id"], part["id"]))
    _set_scene(m["id"], part["id"], part["name"], SESSION["scene"]["explode"], SESSION["scene"]["step"])
    return {"found": True, "machine": m["id"], **part}


def _tool_set_view(level: float, part_id: Optional[str] = None, machine: Optional[str] = None) -> Dict[str, Any]:
    """Explodes or reassembles the on-screen model; optionally focuses one part."""
    m = _machine(machine)
    try:
        lv = max(0.0, min(1.0, float(level)))
    except (TypeError, ValueError):
        return {"ok": False, "error": "level must be a number from 0 (assembled) to 1 (fully exploded)"}
    pid = (part_id or "").strip().lower() or None
    if pid and pid not in m["parts"]:
        return {"ok": False, "error": f"unknown part {pid}", "known_parts": sorted(m["parts"].keys())}
    label = m["parts"][pid]["name"] if pid else None
    _set_scene(m["id"], pid, label, lv, SESSION["scene"]["step"])
    return {"ok": True, "explode": lv, "focused_part": pid}


def _part_card(machine_id: str, part: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": part["id"], "machine": machine_id, "name": part["name"], "sku": part.get("sku"),
        "price_inr": part.get("price_inr"), "in_stock": part.get("in_stock"),
        "lead_time_days": part.get("lead_time_days"), "tool_required": part.get("tool_required"),
        "torque": part.get("torque"), "source": "Third Hand Parts Store",
    }


def _tool_show_step(step_number: int, machine: Optional[str] = None) -> Dict[str, Any]:
    """Moves the on-screen diagram to a step of the active procedure."""
    m = _machine(machine)
    proc = SESSION["procedure"]
    if not proc:
        return {"ok": False, "error": "No active procedure. Call get_procedure first."}
    try:
        n = int(step_number)
    except (TypeError, ValueError):
        return {"ok": False, "error": "step_number must be a whole number"}
    s = next((x for x in proc["steps"] if x["n"] == n), None)
    if not s:
        return {"ok": False, "error": f"No step {n}. This procedure has {len(proc['steps'])} steps."}
    _set_scene(m["id"], s["part_id"], s.get("label") or s["part_id"].replace("_", " "),
               s.get("explode", 0.0), _step_card(proc, s))
    _log("step", f"step {n}")
    return {"ok": True, "step": n, "total_steps": len(proc["steps"]), "part_id": s["part_id"],
            "instruction": s["instruction"], "tool": s.get("tool"), "check": s.get("check")}


def _tool_order_part(part_id: str, quantity: int = 1, machine: Optional[str] = None) -> Dict[str, Any]:
    m = _machine(machine)
    part = m["parts"].get((part_id or "").strip().lower())
    if not part:
        return {"ok": False, "reason": f"unknown part {part_id} on {m['name']}"}
    if part["in_stock"] <= 0 or part["price_inr"] <= 0:
        return {
            "ok": False,
            "reason": f'{part["name"]} is not a field-orderable part.',
            "guidance": part.get("notes", ""),
        }
    qty = max(1, min(int(quantity or 1), part["in_stock"]))
    order_id = "TH-" + uuid.uuid4().hex[:6].upper()
    line = {
        "order_id": order_id,
        "part_id": part["id"],
        "name": part["name"],
        "sku": part["sku"],
        "qty": qty,
        "price_inr": part["price_inr"] * qty,
        "eta_days": part["lead_time_days"],
    }
    SESSION["cart"].append(line)
    _log("order", f'{qty} x {part["name"]} ({order_id})')
    return {
        "ok": True,
        **line,
        "cart_total_inr": sum(c["price_inr"] for c in SESSION["cart"]),
        "message": f'Ordered. {order_id} arrives in {part["lead_time_days"]} days.',
    }


def _tool_log_repair(
    summary: str,
    root_cause: Optional[str] = None,
    steps_completed: Optional[List[str]] = None,
    parts_used: Optional[List[str]] = None,
    outcome: str = "resolved",
) -> Dict[str, Any]:
    """Writes the service record. This is what turns a nice voice demo into a
    product: every session leaves a structured artifact behind."""
    sid = SESSION["session_id"]
    m = MACHINES[SESSION["machine"]]
    report = {
        "session_id": sid,
        "created_at": time.time(),
        "machine": m["name"],
        "machine_id": m["id"],
        "procedure": (SESSION["procedure"] or {}).get("title"),
        "summary": summary,
        "root_cause": root_cause,
        "steps_completed": steps_completed or [],
        "parts_used": parts_used or [],
        "parts_ordered": SESSION["cart"],
        "outcome": outcome,
    }
    SESSION["reports"][sid] = report
    _log("report", f"service record {sid} written")
    return {
        "ok": True,
        "session_id": sid,
        "report_url": f"/api/report/{sid}",
        "message": "Service record saved. Tell the technician it is on screen.",
    }


# --------------------------------------------------------------------------
# ANAKIN - the live web. Cached so a repeated question on stage is free.
# --------------------------------------------------------------------------
def _anakin_headers() -> Dict[str, str]:
    return {"X-API-Key": ANAKIN_API_KEY, "Content-Type": "application/json"}


_PRODUCT_CACHE: Dict[str, Dict[str, Any]] = {}   # "machine/part" -> live shop results
_PRICE_RE = re.compile(r"(?:₹|Rs\.?|INR)\s?\d[\d,]*(?:\.\d+)?|\$\s?\d[\d,]*(?:\.\d+)?|€\s?\d[\d,]*(?:\.\d+)?", re.I)


# one short hint per machine, so "nozzle" means a 3D-printer nozzle and not a whole printer
_MACHINE_HINT = {"printer": "Ender 3", "pump": "centrifugal pump", "mri": "MRI scanner", "scooter": "110cc scooter"}


def _part_words(name: str) -> List[str]:
    stop = {"with", "type", "class", "mm", "set", "assembly", "kit"}
    return [w for w in re.findall(r"[a-z0-9]+", name.lower()) if len(w) >= 4 and w not in stop]


def _fetch_products(query: str, part_name: str = "") -> Dict[str, Any]:
    """Live shop results for one part from the Anakin search API. Nothing here is made up:
    a price shows only if the page text itself contains one."""
    try:
        r = httpx.post(f"{ANAKIN_BASE}/search", headers=_anakin_headers(),
                       json={"prompt": query, "limit": 6}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Anakin search {r.status_code}: {r.text[:160]}")
        body = r.json()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"live search unavailable: {e}"}
    raw = body.get("results") if isinstance(body, dict) else body
    items: List[Dict[str, Any]] = []
    for i in (raw if isinstance(raw, list) else []):
        if not isinstance(i, dict) or not i.get("url"):
            continue
        title = (i.get("title") or "").strip()
        snippet = (i.get("content") or i.get("snippet") or i.get("description") or "").strip()
        m = _PRICE_RE.search(f"{title} {snippet}")
        if m and re.fullmatch(r"\D*(19|20)\d\d", m.group(0).replace(" ", "")):
            m = None  # "rs2026" is a year, not a price
        host = re.sub(r"^https?://(www\.)?", "", i["url"]).split("/")[0]
        items.append({"title": title or host, "url": i["url"], "domain": host,
                      "snippet": snippet[:220], "price": m.group(0).replace(" ", "") if m else None})
    words = _part_words(part_name)
    for x in items:
        hay = f"{x['title']} {x['snippet']}".lower()
        x["_hits"] = sum(1 for w in words if w in hay)
    about_part = [x for x in items if x["_hits"] > 0]
    if len(about_part) >= 2:  # drop pages that are not about this part at all
        items = about_part
    items.sort(key=lambda x: (-x["_hits"], x["price"] is None))
    for x in items:
        x.pop("_hits", None)
    return {"ok": True, "query": query, "products": items[:4]}


def _tool_search_web(query: str) -> Dict[str, Any]:
    query = (query or "").strip()
    if not query:
        return {"ok": False, "error": "empty query"}
    if query in _SEARCH_CACHE:
        return _SEARCH_CACHE[query]

    try:
        r = httpx.post(
            f"{ANAKIN_BASE}/search",
            headers=_anakin_headers(),
            json={"prompt": query, "limit": 4},
            timeout=30,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Anakin search {r.status_code}: {r.text[:200]}")
        body = r.json()
    except Exception as e:  # noqa: BLE001 - degrade gracefully on stage
        return {
            "ok": False,
            "error": f"search unavailable: {e}",
            "instruction_to_agent": "Say in one line that the live search is not "
            "answering right now, then continue with get_procedure.",
        }

    raw = body.get("results") if isinstance(body, dict) else body
    if not isinstance(raw, list):
        raw = []
    results = [
        {
            "title": (i or {}).get("title", ""),
            "url": (i or {}).get("url", ""),
            "snippet": (i or {}).get("content") or (i or {}).get("snippet")
            or (i or {}).get("description") or "",
        }
        for i in raw[:4]
        if isinstance(i, dict)
    ]
    SESSION["sources"] = [
        {"title": x["title"] or x["url"], "url": x["url"], "snippet": x.get("snippet", "")}
        for x in results
    ]
    _log("web", f"search: {query[:60]}")
    result = {
        "ok": True,
        "query": query,
        "results": results,
        "instruction_to_agent": "Cite out loud where this came from, e.g. 'two "
        "forum threads and the OEM bulletin agree'. Use read_page if one snippet "
        "is not enough.",
    }
    _SEARCH_CACHE[query] = result
    return result


def _tool_read_page(url: str) -> Dict[str, Any]:
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "pass a full https URL from search_web results"}
    if url in _PAGE_CACHE:
        return _PAGE_CACHE[url]

    # Anakin's scraper is a job: POST /v1/crawl -> poll GET /v1/crawl/{jobId}.
    # Light pages finish in under 2 seconds; heavy JS shops can render for
    # minutes, so we bail out after ~24 s and degrade gracefully on stage.
    try:
        r = httpx.post(
            f"{ANAKIN_BASE}/crawl",
            headers=_anakin_headers(),
            json={"url": url, "formats": ["markdown"]},
            timeout=30,
        )
        if r.status_code not in (200, 202):
            raise RuntimeError(f"Anakin crawl {r.status_code}: {r.text[:200]}")
        job_id = (r.json() or {}).get("jobId", "")
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"scrape unavailable: {e}"}

    text, status = "", "unknown"
    for _ in range(8):
        time.sleep(3)
        try:
            p = httpx.get(
                f"{ANAKIN_BASE}/crawl/{job_id}",
                headers={"X-API-Key": ANAKIN_API_KEY},
                timeout=20,
            )
            body = p.json() or {}
        except Exception:  # noqa: BLE001
            continue
        status = str(body.get("status", "")).lower()
        if status in ("completed", "done", "success", "finished", "complete"):
            results = body.get("results") or []
            text = (results[0].get("markdown") or results[0].get("content") or "") if results else ""
            break

    SESSION["sources"].append({"title": url, "url": url})
    _log("web", f"read: {url[:60]}")
    if not text.strip():
        result = {
            "ok": False,
            "url": url,
            "crawler_status": status,
            "instruction_to_agent": "The page is heavy and the crawler is still "
            "rendering it. Say so in one line and answer from the search_web "
            "snippets instead.",
        }
    else:
        result = {
            "ok": True,
            "url": url,
            "content": text[:4000],
            "note": "content is truncated - answer from what is here",
        }
    _PAGE_CACHE[url] = result
    return result


SERVER_TOOLS = {
    "get_procedure": _tool_get_procedure,
    "lookup_part": _tool_lookup_part,
    "show_step": _tool_show_step,
    "set_view": _tool_set_view,
    "order_part": _tool_order_part,
    "log_repair": _tool_log_repair,
    "search_web": _tool_search_web,
    "read_page": _tool_read_page,
}


def _view_text(view: Optional[Dict[str, Any]]) -> str:
    """The screen state, flattened into the system prompt. Fresh every turn."""
    if not view:
        return "(no screen state was reported - the scene has not moved yet)"
    bits = []
    for k in ("machine", "machine_name", "focused_part", "explode_level",
              "current_step", "pointer_on"):
        if view.get(k) is not None:
            bits.append(f"{k}: {view[k]}")
    hi = view.get("highlighted") or []
    if hi:
        bits.append("highlighted: " + ", ".join(
            f"{h.get('part_id')} ({h.get('label')})" for h in hi
        ))
    return "\n".join("- " + b for b in bits) if bits else "(screen is assembled and idle)"


# --------------------------------------------------------------------------
# THE AGENT TURN - Vaani chat completions with native tool calling.
# Server tools run here. Browser tools are queued and returned; the frontend
# executes them on the scene the moment this response lands.
# --------------------------------------------------------------------------
class TurnIn(BaseModel):
    text: str = Field(..., description="The technician's utterance, from /api/stt")
    language: Optional[str] = Field(None, description="BCP-47 detected by saaras, e.g. hi-IN")
    view: Optional[Dict[str, Any]] = Field(None, description="Screen state snapshot from the frontend")
    history: Optional[List[Dict[str, str]]] = Field(None, description="Prior user/assistant turns")


@app.post("/api/agent/turn")
async def agent_turn(body: TurnIn):
    """One conversational turn, STREAMED as NDJSON lines so the browser can
    fire scene tools the moment they are queued - mid-turn, while the model is
    still composing the reply:

        {"type": "tool", "name": "set_explode", "args": {...}}   (each time)
        {"type": "final", "speech": "...", "sources": [...], "browser_tools": [...]}
        {"type": "error", "detail": "..."}                       (instead of dying)
    """
    if not VAANI_API_KEY:
        raise HTTPException(500, "Set VAANI_API_KEY in backend/.env")
    if not body.text.strip():
        raise HTTPException(400, "empty text")
    return StreamingResponse(_agent_turn_events(body), media_type="application/x-ndjson")


async def _agent_turn_events(body: TurnIn):
    system = SYSTEM_PROMPT + BROWSER_NOTE + "\n\n# Screen state right now\n" + _view_text(body.view)
    messages: List[Dict[str, Any]] = [{"role": "system", "content": system}]
    for h in (body.history or [])[-8:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.text})

    browser_tools: List[Dict[str, Any]] = []
    sources: List[Dict[str, str]] = []
    payload_base = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "max_tokens": LLM_MAX_TOKENS,
        "messages": messages,
        "tools": TOOL_SCHEMAS,
        "tool_choice": "auto",
    }

    speech = ""
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            for _ in range(MAX_TOOL_ROUNDS):
                r = await client.post(f"{VAANI_BASE}/v1/chat/completions", headers=_vaani_headers(), json=payload_base)
                if r.status_code != 200:
                    raise RuntimeError(f"Vaani chat error {r.status_code}: {r.text[:300]}")
                msg = r.json()["choices"][0]["message"]
                calls = msg.get("tool_calls") or []

                if not calls:
                    speech = (msg.get("content") or "").strip()
                    break

                messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
                for c in calls:
                    name = c["function"]["name"]
                    try:
                        args = json.loads(c["function"].get("arguments") or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    _log("tool", name)

                    if name in SERVER_TOOLS:
                        result = SERVER_TOOLS[name](**args)
                        if name == "search_web":
                            sources = list(SESSION["sources"])
                        if name == "get_procedure" and result.get("found"):
                            # Latency cut: the backend already knows step 1's
                            # scene args, so fire them here instead of spending
                            # a whole extra LLM round on them. (~4-5 s saved)
                            steps0 = result.get("steps") or []
                            if steps0:
                                s0 = steps0[0]
                                for t0 in (
                                    {"name": "set_explode", "args": {"level": s0.get("explode", 0)}},
                                    {"name": "focus_part", "args": {"part_id": s0.get("part_id")}},
                                    {"name": "highlight_part", "args": {"part_id": s0.get("part_id")}},
                                    {"name": "show_step", "args": {
                                        "step_number": s0.get("n"),
                                        "total_steps": result.get("total_steps"),
                                        "instruction": s0.get("instruction"),
                                        "tool": s0.get("tool"),
                                        "check": s0.get("check"),
                                    }},
                                ):
                                    browser_tools.append(t0)
                                    yield json.dumps({"type": "tool", **t0}) + "\n"
                    elif name in BROWSER_TOOL_NAMES:
                        t0 = {"name": name, "args": args}
                        browser_tools.append(t0)
                        # Stream it NOW - the browser fires the scene while the
                        # model is still working on the final reply.
                        yield json.dumps({"type": "tool", **t0}) + "\n"
                        result = {
                            "ok": True,
                            "executed_in_browser": True,
                            "note": "This scene tool has fired on the screen. Do not wait for it.",
                        }
                    else:
                        result = {"error": f"unknown tool {name}"}

                    messages.append({
                        "role": "tool",
                        "tool_call_id": c.get("id", name),
                        "content": json.dumps(result, ensure_ascii=False)[:6000],
                    })
            else:
                # Loop guard tripped: one final call with no tools, forcing an answer.
                r = await client.post(
                    f"{VAANI_BASE}/v1/chat/completions",
                    headers=_vaani_headers(),
                    json={"model": LLM_MODEL, "temperature": 0.2, "max_tokens": LLM_MAX_TOKENS, "messages": messages},
                )
                speech = (r.json()["choices"][0]["message"].get("content") or "").strip() if r.status_code == 200 else ""
    except Exception as e:  # noqa: BLE001 - mid-stream we can only report in-band
        yield json.dumps({"type": "error", "detail": str(e)[:300]}) + "\n"
        return

    if not sources and SESSION["sources"]:
        sources = SESSION["sources"][-4:]
    _log("turn", f"{body.text[:40]} -> {len(browser_tools)} scene tools, {len(sources)} sources")
    yield json.dumps({
        "type": "final",
        "speech": speech,
        "browser_tools": browser_tools,
        "sources": sources,
        "language": body.language,
        "session_id": SESSION["session_id"],
        "machine": SESSION["machine"],
    }) + "\n"


# --------------------------------------------------------------------------
# EARS + VOICE - thin wrappers around the two Vaani endpoints.
# --------------------------------------------------------------------------
@app.post("/api/stt")
async def stt(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Browser uploads one utterance (16 kHz mono WAV, transcoded client-side);
    saaras:v3 transcribes it, auto-detecting the language (22 of them)."""
    if not VAANI_API_KEY:
        raise HTTPException(500, "Set VAANI_API_KEY in backend/.env")
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "empty audio upload")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{VAANI_BASE}/speech-to-text",
                headers=_vaani_headers(),
                data={"model": STT_MODEL, "language_code": "unknown"},
                files={"file": (file.filename or "utterance.wav", audio, file.content_type or "audio/wav")},
            )
        if r.status_code != 200:
            raise HTTPException(502, f"Vaani STT error {r.status_code}: {r.text[:300]}")
        body = r.json()
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Vaani STT failed: {e}")
    _log("stt", (body.get("transcript") or "")[:60])
    return {
        "text": body.get("transcript") or "",
        "language": body.get("language_code") or "en-IN",
    }


class TtsIn(BaseModel):
    text: str
    language: Optional[str] = Field(None, description="BCP-47; falls back to en-IN")


@app.post("/api/tts")
async def tts(body: TtsIn) -> Dict[str, Any]:
    """Reply text -> bulbul:v3 -> base64 WAV. Speaker shubh, pace 1.05.
    The language comes straight from what saaras heard - Hindi in, Hindi out."""
    if not VAANI_API_KEY:
        raise HTTPException(500, "Set VAANI_API_KEY in backend/.env")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "empty text")
    language = body.language if body.language in TTS_LANGS else "en-IN"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{VAANI_BASE}/text-to-speech",
                headers=_vaani_headers(),
                json={
                    "text": text[:2500],   # bulbul:v3 hard limit
                    "language_code": language,
                    "speaker": TTS_SPEAKER,
                    "pace": TTS_PACE,
                },
            )
        if r.status_code != 200:
            raise HTTPException(502, f"Vaani TTS error {r.status_code}: {r.text[:300]}")
        audios = r.json().get("audios") or []
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Vaani TTS failed: {e}")
    if not audios:
        raise HTTPException(502, "Vaani TTS returned no audio")
    _log("tts", text[:60])
    return {"audio_b64": audios[0], "language": language}


# --------------------------------------------------------------------------
# HTTP WRAPPERS - the same six tools over plain HTTP, for curl testing and
# for anything that wants to drive Third Hand without the voice loop.
# All of them take the machine name optionally; omit it and the backend uses
# whatever the browser last switched to.
# --------------------------------------------------------------------------
class SymptomIn(BaseModel):
    symptom: str = Field(..., description="What the technician described, in their own words")
    machine: Optional[str] = Field(None, description="printer | mri | pump. Omit to use what is on screen.")


class PartIn(BaseModel):
    part_id: str = Field(..., description="Part identifier, e.g. nozzle, cold_head, chiller")
    machine: Optional[str] = None


class OrderIn(BaseModel):
    part_id: str
    quantity: int = 1
    machine: Optional[str] = None


class LogIn(BaseModel):
    summary: str
    root_cause: Optional[str] = None
    steps_completed: Optional[List[str]] = None
    parts_used: Optional[List[str]] = None
    outcome: Optional[str] = "resolved"


class QueryIn(BaseModel):
    query: str


class UrlIn(BaseModel):
    url: str


@app.post("/api/tools/get_procedure")
async def get_procedure_http(body: SymptomIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_get_procedure(body.symptom, body.machine)


@app.post("/api/tools/lookup_part")
async def lookup_part_http(body: PartIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_lookup_part(body.part_id, body.machine)


class StepIn(BaseModel):
    step_number: int
    machine: Optional[str] = None


@app.post("/api/tools/show_step")
async def show_step_http(body: StepIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_show_step(body.step_number, body.machine)


class ViewIn(BaseModel):
    level: float
    part_id: Optional[str] = None
    machine: Optional[str] = None


@app.post("/api/tools/set_view")
async def set_view_http(body: ViewIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_set_view(body.level, body.part_id, body.machine)


@app.get("/api/products/{machine_id}/{part_id}")
async def part_products(machine_id: str, part_id: str):
    """Live products for a part, fetched from the web (Anakin) the first time a part comes up in the chat."""
    m = MACHINES.get(machine_id.lower())
    part = m["parts"].get(part_id.lower()) if m else None
    if not part:
        raise HTTPException(404, "unknown part")
    key = f"{m['id']}/{part['id']}"
    if key in _PRODUCT_CACHE:
        return _PRODUCT_CACHE[key]
    if not ANAKIN_API_KEY:
        return {"ok": False, "error": "ANAKIN_API_KEY is not set"}
    hint = _MACHINE_HINT.get(m["id"], "")
    res = await asyncio.to_thread(_fetch_products, f"{part['name']} {hint} buy online price India".replace("  ", " "), part["name"])
    res = {**res, "part_id": part["id"], "part": part["name"], "machine": m["id"]}
    if res.get("ok"):  # failures are not cached, so the next mention retries
        _PRODUCT_CACHE[key] = res
    return res


@app.get("/api/part/{machine_id}/{part_id}")
async def part_detail(machine_id: str, part_id: str):
    """Read-only part card for the hover inspector in the browser."""
    m = MACHINES.get(machine_id.lower())
    part = m["parts"].get(part_id.lower()) if m else None
    if not part:
        raise HTTPException(404, "unknown part")
    ordered = any(c["part_id"] == part["id"] for c in SESSION["cart"])
    return {**_part_card(m["id"], part), "ordered": ordered,
            "service_interval": part.get("service_interval"), "safety": part.get("safety"),
            "notes": part.get("notes")}


@app.post("/api/tools/order_part")
async def order_part_http(body: OrderIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_order_part(body.part_id, body.quantity, body.machine)


@app.post("/api/tools/log_repair")
async def log_repair_http(body: LogIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_log_repair(body.summary, body.root_cause, body.steps_completed, body.parts_used, body.outcome)


@app.post("/api/tools/search_web")
async def search_web_http(body: QueryIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_search_web(body.query)


@app.post("/api/tools/read_page")
async def read_page_http(body: UrlIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return _tool_read_page(body.url)


# --------------------------------------------------------------------------
# READ MODELS - what the frontend polls, unchanged in shape except that
# /api/session now also carries the live web sources for the panel.
# --------------------------------------------------------------------------
class MachineIn(BaseModel):
    machine: str


@app.post("/api/machine")
async def set_machine(body: MachineIn):
    """Called by the browser when the scene switches, so SERVER tools scope to
    the right catalogue without the agent having to name it every time."""
    key = body.machine.strip().lower()
    if key not in MACHINES:
        raise HTTPException(404, f"unknown machine {key}. have: {list(MACHINES)}")
    # The browser echoes machine switches the agent already made via a tool;
    # only a real change should drop the active procedure.
    if key != SESSION["machine"]:
        SESSION["machine"] = key
        SESSION["procedure"] = None
        _log("machine", MACHINES[key]["name"])
    return {"ok": True, "machine": key, "name": MACHINES[key]["name"]}


@app.get("/api/machines")
async def list_machines():
    return {
        "active": SESSION["machine"],
        "machines": [
            {
                "id": m["id"],
                "name": m["name"],
                "parts": len(m["parts"]),
                "procedures": [
                    {"id": p["id"], "title": p["title"]} for p in m["procedures"].values()
                ],
            }
            for m in MACHINES.values()
        ],
    }


@app.get("/api/session")
async def session_state(x_learner: Optional[str] = Header(None)):
    mid = SESSION["machine"]
    parts_db = MACHINES[mid]["parts"]
    proc = SESSION["procedure"] or {}
    # replacement candidates: the procedure's likely parts first, then anything
    # the agent looked up on this machine
    ids = [p for p in proc.get("likely_parts", []) if p in parts_db]
    ids += [p for (mm, p) in SESSION["looked_up"] if mm == mid and p not in ids]
    ordered = {c["part_id"] for c in SESSION["cart"]}
    parts = [{**_part_card(mid, parts_db[i]), "ordered": i in ordered} for i in ids][:8]
    tools = sorted({s["tool"] for s in proc.get("steps", [])
                    if s.get("tool") and s["tool"].strip().lower() not in ("none", "n/a", "-")})
    steps = [
        {"n": s["n"], "part_id": s["part_id"], "explode": s.get("explode", 0.0),
         "instruction": s["instruction"], "tool": s.get("tool"), "check": s.get("check")}
        for s in proc.get("steps", [])
    ]
    return {
        "procedure": {"title": proc.get("title"), "safety": proc.get("safety"),
                      "est_minutes": proc.get("est_minutes"), "steps": steps} if proc else None,
        "parts": parts,
        "tools_needed": tools,
        "session_id": SESSION["session_id"],
        "machine": SESSION["machine"],
        "machine_name": MACHINES[SESSION["machine"]]["name"],
        "cart": SESSION["cart"],
        "cart_total_inr": sum(c["price_inr"] for c in SESSION["cart"]),
        "log": SESSION["log"][-15:],
        "procedure_title": (SESSION["procedure"] or {}).get("title"),
        "report": SESSION["reports"].get(SESSION["session_id"]),
        "sources": SESSION["sources"][-4:],
        "scene": SESSION["scene"],
        "lab": lab.public(x_learner),
    }


@app.get("/api/report/{sid}")
async def get_report(sid: str):
    r = SESSION["reports"].get(sid)
    if not r:
        raise HTTPException(404, "no report yet")
    return r


@app.post("/api/session/reset")
async def reset():
    SESSION.update(
        session_id=uuid.uuid4().hex[:8], cart=[], log=[], procedure=None,
        reports={}, sources=[],
    )
    _SEARCH_CACHE.clear()
    _PAGE_CACHE.clear()
    return {"ok": True, "session_id": SESSION["session_id"]}


class SessionIn(BaseModel):
    mode: Optional[str] = "repair"
    learner: Optional[str] = None
    name: Optional[str] = None


@app.post("/api/vaani/session")
async def vaani_session(body: Optional[SessionIn] = None):
    """Starts a Vaani WebRTC session for the Third Hand agent.

    The browser never sees the API key: it gets back only the short-lived join
    token + room URL (and the signed live-captions URL).
    """
    if not VAANI_API_KEY or not VAANI_AGENT_ID:
        raise HTTPException(500, "Set VAANI_API_KEY and VAANI_AGENT_ID in backend/.env")
    payload: Dict[str, Any] = {"agent_id": VAANI_AGENT_ID, "medium": "webrtc", "primary_language": "en"}
    if body and body.mode in ("pelton", "viva"):
        # Per-session override: the same agent runs as a lab tutor, or as the viva examiner, for this call only.
        code = lab.start_tutor(body.learner, body.name)
        viva = body.mode == "viva"
        greeting = lab.VIVA_GREETING if viva else lab.TUTOR_GREETING
        payload["welcome_message"] = greeting
        # `welcome_message` alone is ignored by this agent (it keeps its stored greeting), so set the persona's greeting too.
        payload["modify_agent"] = {"persona": {"identity": {
            "system_prompt": (lab.viva_prompt if viva else lab.tutor_prompt)(code),
            "greeting_message": {"agent_message": greeting},
        }}}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{VAANI_BASE}/api/trigger-call/",
                headers={"X-API-Key": VAANI_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Vaani unreachable: {e}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Vaani session error {r.status_code}: {r.text[:300]}")
    d = r.json()
    # Vaani can answer HTTP 200 with an error in the body (e.g. 402 out of credit)
    if not d.get("token"):
        raise HTTPException(502, f"Vaani session error {d.get('status_code', '')}: {d.get('message') or d.get('error') or 'no join token returned'}")
    return {k: d.get(k) for k in ("token", "room_name", "connection_url", "live_captions_url")}


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "agent_configured": bool(VAANI_API_KEY),
        "anakin_configured": bool(ANAKIN_API_KEY),
        "models": {"stt": STT_MODEL, "llm": LLM_MODEL, "tts": TTS_MODEL},
        "tools": {"server": sorted(SERVER_TOOLS.keys()), "browser": sorted(BROWSER_TOOL_NAMES)},
        "machines": {k: {"parts": len(v["parts"]), "procedures": len(v["procedures"])}
                     for k, v in MACHINES.items()},
        "active": SESSION["machine"],
    }
