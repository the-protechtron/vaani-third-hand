"""Pelton wheel lab tutor: state, tools the voice agent calls, grading and history.

State is kept per learner (the browser sends an `X-Learner` id) and saved to
`data/lab_store.json`, so a backend restart loses nothing. Vaani's tool calls
come from Vaani's servers and carry no browser identity, so every tutor session
gets a short code that the agent passes back as `session`. A call without a
code falls back to the learner who started a tutor session most recently.

Questions are written by the agent each time. The server stores them, grades
what it can deterministically (clicks on the rig, numeric answers, key points)
and keeps the history.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()

STORE_PATH = Path(__file__).parent / "data" / "lab_store.json"
MAX_ATTEMPTS = 50
VIVA_TOTAL = 5
WAIT_MAX_S = 40

PELTON_PARTS = {
    "base": "Base frame and sump", "pump": "Centrifugal pump", "penstock": "Penstock pipe",
    "venturi": "Venturimeter with manometer", "gauge_p1": "Pressure gauge P1 (venturi throat)",
    "gauge_p2": "Pressure gauge P2 (venturi inlet)", "gauge_p3": "Pressure gauge Pp (penstock)",
    "frame": "Support frame and gauge board", "nozzle": "Nozzle", "spear": "Spear (needle valve)",
    "runner": "Pelton runner", "casing": "Turbine casing", "shaft": "Shaft",
    "brake_drum": "Brake drum (400 mm)", "rope": "Brake rope (15 mm)",
    "deadweights": "Dead weights and hanger", "spring": "Spring balance (T2)",
    "tacho": "Tachometer (N, r.p.m.)",
}
LAB_TABS = {"learn", "observe", "calc", "quiz", "viva", "tutor"}
VIVA_KINDS = {"explain", "point", "highlight", "calc", "mcq"}

# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------
_STORE: Dict[str, Any] = {"learners": {}, "last": None}


def _fresh_viva() -> Dict[str, Any]:
    return {"active": False, "finished": False, "summary": None, "current": None,
            "history": [], "last_click": None, "n": 0, "spoken": []}


def _load() -> None:
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8-sig"))  # tolerate a BOM from hand edits
        if isinstance(data, dict) and isinstance(data.get("learners"), dict):
            _STORE.update(data)
    except FileNotFoundError:
        pass
    except (OSError, ValueError):
        # a damaged file must not stop the app; keep it aside and start clean
        try:
            STORE_PATH.replace(STORE_PATH.with_suffix(".corrupt.json"))
        except OSError:
            pass


def _save() -> None:
    try:
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = STORE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(_STORE, ensure_ascii=False), encoding="utf-8")
        tmp.replace(STORE_PATH)
    except OSError:
        pass  # state still lives in memory; saving is best effort


_load()


def _clean_id(lid: Optional[str]) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]", "", lid or "")[:24]
    return s or "anon"


def learner(lid: Optional[str]) -> Dict[str, Any]:
    key = _clean_id(lid)
    L = _STORE["learners"].get(key)
    if L is None:
        L = {"id": key, "name": None, "seq": 0, "tab": None, "viva": _fresh_viva(), "attempts": []}
        _STORE["learners"][key] = L
    L.setdefault("scene", {"seq": 0, "part_id": None, "label": None, "explode": None, "view": None, "step": None})
    return L


def resolve(session: Optional[str]) -> Dict[str, Any]:
    """The learner a tool call belongs to: its session code, else the latest tutor session."""
    key = _clean_id(session) if session else None
    if key and key in _STORE["learners"]:
        return _STORE["learners"][key]
    return learner(_STORE.get("last"))


def bump(L: Dict[str, Any], tab: Optional[str] = None) -> None:
    L["seq"] += 1
    if tab:
        L["tab"] = tab
    _save()


def public(lid: Optional[str]) -> Dict[str, Any]:
    L = learner(lid)
    return {"seq": L["seq"], "tab": L["tab"], "viva": L["viva"], "name": L["name"],
            "attempts": L["attempts"][-10:], "scene": L["scene"]}


# ---------------------------------------------------------------------------
# Grading helpers
# ---------------------------------------------------------------------------
def _words(s: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", (s or "").lower()))


def _point_hit(point: str, answer: str) -> bool:
    """A key point counts when at least half of its significant words appear in the answer."""
    sig = [w for w in _words(point).split() if len(w) > 3]
    if not sig:
        return False
    hay = _words(answer)
    return sum(1 for w in sig if w[:5] in hay) / len(sig) >= 0.5


def _score(history: List[Dict[str, Any]]) -> Dict[str, int]:
    graded = [h for h in history if h.get("correct") is not None]
    right = sum(1 for h in graded if h["correct"])
    return {"right": right, "total": len(graded), "pct": round(100 * right / len(graded)) if graded else 0}


def _archive(L: Dict[str, Any], entry: Dict[str, Any]) -> None:
    v = L["viva"]
    entry["n"] = len(v["history"]) + 1
    entry["at"] = int(time.time())
    v["history"].append(entry)
    v["current"] = None


def _next(L: Dict[str, Any]) -> str:
    """What the agent must do after a question closes, so the viva keeps moving by itself."""
    done = len(L["viva"]["history"])
    if done >= VIVA_TOTAL:
        return (f"That was question {VIVA_TOTAL} of {VIVA_TOTAL}, the last one. Say the result in one short sentence, "
                "then call viva_finish with a spoken summary of the score and what to revise.")
    return (f"Give ONE short sentence of feedback aloud. Then, without waiting for the student to say anything, "
            f"call viva_ask for question {done + 1} of {VIVA_TOTAL}, and use a different kind from the question you just asked.")


# ---------------------------------------------------------------------------
# Tools (called by the Vaani agent over HTTP)
# ---------------------------------------------------------------------------
def tool_open_tab(L: Dict[str, Any], tab: str) -> Dict[str, Any]:
    t = (tab or "").strip().lower()
    if t not in LAB_TABS:
        return {"ok": False, "error": f"unknown tab {tab}", "tabs": sorted(LAB_TABS)}
    bump(L, t)
    return {"ok": True, "tab": t}


LAB_VIEWS = {"iso", "front", "side", "top", "nozzle", "gauges", "brake", "venturi"}


def tool_show(L: Dict[str, Any], part_id: Optional[str] = None, label: Optional[str] = None,
              level: Optional[float] = None, view: Optional[str] = None,
              step: Optional[int] = None) -> Dict[str, Any]:
    """Points at a part (glow + camera), explodes the rig, changes view or opens a procedure step."""
    sc = L["scene"]
    pid = (part_id or "").strip().lower() or None
    if pid and pid not in PELTON_PARTS:
        return {"ok": False, "error": f"unknown part {pid}", "valid_part_ids": sorted(PELTON_PARTS)}
    vw = (view or "").strip().lower() or None
    if vw and vw not in LAB_VIEWS:
        return {"ok": False, "error": f"unknown view {vw}", "valid_views": sorted(LAB_VIEWS)}
    if step is not None and not 1 <= int(step) <= 9:
        return {"ok": False, "error": "step must be 1 to 9"}
    note = None
    lv = None
    if level is not None:
        if L["viva"]["active"] and not L["viva"]["finished"]:
            note = "Explode is locked during the viva, so it was ignored."
        else:
            lv = max(0.0, min(1.0, float(level)))
    sc.update(seq=sc["seq"] + 1, part_id=pid, label=(label or "").strip() or (PELTON_PARTS[pid] if pid else None),
              explode=lv, view=vw, step=int(step) if step is not None else None)
    bump(L)
    return {"ok": True, **({"note": note} if note else {})}


def tool_ask(L: Dict[str, Any], question: str, kind: str = "explain", part_id: Optional[str] = None,
             options: Optional[List[str]] = None, expected: Optional[float] = None,
             unit: Optional[str] = None, tolerance: Optional[float] = None,
             key_points: Optional[List[str]] = None) -> Dict[str, Any]:
    q = (question or "").strip()
    k = (kind or "explain").strip().lower()
    pid = (part_id or "").strip().lower() or None
    if not q:
        return {"ok": False, "error": "question is empty"}
    if k not in VIVA_KINDS:
        return {"ok": False, "error": f"kind must be one of {sorted(VIVA_KINDS)}"}
    if k in ("point", "highlight") and pid not in PELTON_PARTS:
        return {"ok": False, "error": "point and highlight questions need a valid part_id",
                "valid_part_ids": sorted(PELTON_PARTS)}
    v = L["viva"]
    if not v["current"] and len(v["history"]) >= VIVA_TOTAL and not v["finished"]:
        return {"ok": False, "error": f"The viva already has {VIVA_TOTAL} questions. Call viva_finish now."}
    if v["current"]:  # an unanswered question is closed as skipped
        _archive(L, {**v["current"], "answer": None, "correct": None, "feedback": "skipped"})
    if v["finished"]:  # asking after a finished viva starts a new one
        L["viva"] = v = _fresh_viva()
    v["n"] += 1
    v["active"] = True
    v["last_click"] = None
    v["spoken"] = []
    kp = [p.strip() for p in (key_points or []) if isinstance(p, str) and p.strip()][:8]
    v["current"] = {"id": v["n"], "kind": k, "question": q, "part_id": pid, "options": options or None,
                    "number": len(v["history"]) + 1, "total": VIVA_TOTAL,
                    "expected_num": expected if k == "calc" else None, "unit": unit,
                    "tolerance": tolerance if tolerance and tolerance > 0 else 0.05, "key_points": kp or None}
    bump(L, "viva")
    hint = {
        "point": "Say the question aloud, then call viva_wait. It waits for the student to click the object on the 3D rig and returns whether it was right.",
        "highlight": "The part glows on their rig. They name it by voice. Judge the answer, then call viva_record.",
        "calc": ("They answer with a number. Call viva_answer_number with the value they say; the server grades it."
                 if expected is not None else "They answer by voice. Judge, then call viva_record."),
    }.get(k, "They answer by voice. Call viva_record with their answer as close to word for word as you can.")
    return {"ok": True, "question_number": len(v["history"]) + 1, "of": VIVA_TOTAL,
            "instruction_to_agent": ("Say \"Question " + str(len(v["history"]) + 1) + "\" and then the question aloud. " + hint)}


def note_spoken(L: Dict[str, Any], text: str) -> None:
    """Browser -> backend: the student said this (final speech-to-text). Only counts while a question is open."""
    v = L["viva"]
    t = (text or "").strip()
    if v.get("current") and t:
        v.setdefault("spoken", []).append(t[:400])


async def _await_spoken(L: Dict[str, Any], timeout: float = 3.5) -> Optional[str]:
    """What the student actually said since the question opened. The browser reports it a moment after
    they stop talking, so wait briefly for it. None means they have not answered."""
    v = L["viva"]
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if v.get("spoken"):
            return " ".join(v["spoken"])[-400:]
        await asyncio.sleep(0.25)
    return " ".join(v["spoken"])[-400:] if v.get("spoken") else None


_NO_ANSWER = {"ok": False, "answered": False,
              "error": "The student has not answered yet, so nothing was marked. Do not mark or invent an answer. "
                       "Wait for them to speak. If the audio was unclear, ask them to repeat it."}


def tool_check(L: Dict[str, Any]) -> Dict[str, Any]:
    v = L["viva"]
    if v["last_click"]:
        return {"ok": True, **v["last_click"], "next": _next(L)}
    if v["current"] and v["current"]["kind"] == "point":
        return {"ok": True, "pending": True, "message": "The student has not clicked yet."}
    return {"ok": True, "pending": False, "message": "No click to report."}


async def tool_wait(L: Dict[str, Any], seconds: float = 30, question: Optional[str] = None,
                    part_id: Optional[str] = None) -> Dict[str, Any]:
    """Blocks until the student clicks (or time runs out), so the agent reacts without being prompted.

    Models sometimes skip viva_ask and call this straight away. If no question is open but this call
    carries the question text and part, open it here so the student still sees it.
    """
    v = L["viva"]
    if not v["current"] and question and part_id:
        opened = tool_ask(L, question, "point", part_id)
        if not opened.get("ok"):
            return opened
    cur = v["current"]
    if not cur or cur["kind"] != "point":
        return tool_check(L)
    qid = cur["id"]
    deadline = time.monotonic() + max(1.0, min(float(seconds or 30), WAIT_MAX_S))
    while time.monotonic() < deadline:
        lc = v["last_click"]
        if lc and lc.get("question_id") == qid:
            return {"ok": True, **lc, "next": _next(L)}
        if not v["current"] or v["current"]["id"] != qid:  # skipped or replaced
            break
        await asyncio.sleep(0.4)
    return {"ok": True, "pending": True, "message": "No click yet. Gently ask the student to click the part, then call viva_wait again."}


def tool_record(L: Dict[str, Any], correct: bool, student_answer: str = "", model_answer: str = "",
                feedback: str = "", question: Optional[str] = None, kind: Optional[str] = None,
                part_id: Optional[str] = None) -> Dict[str, Any]:
    v = L["viva"]
    cur = v["current"]
    if not cur and question:
        # The agent skipped viva_ask. Put the question on screen, but do NOT mark it: nobody has answered yet.
        opened = tool_ask(L, question, kind or "explain", part_id)
        if not opened.get("ok"):
            return opened
        return {"ok": False, "answered": False,
                "error": "That question is now on the student's screen but nothing was marked, because they have not answered. "
                         "Next time call viva_ask BEFORE you speak a question. Wait for the student's spoken answer, then call viva_record again."}
    if not cur:
        return {"ok": False, "error": "No open question. Call viva_ask first, with the question text, before you speak it."}
    if cur["kind"] == "point":
        return {"ok": False, "error": "This is a point question: the student answers by clicking the object on the 3D rig. Call viva_wait instead."}
    ok = bool(correct)
    heard = " ".join(v.get("spoken") or [])[-400:]
    entry = {**cur, "answer": heard or (student_answer or "").strip() or None,
             "expected": (model_answer or "").strip() or None,
             "feedback": (feedback or "").strip() or None}
    kp = cur.get("key_points")
    if kp and entry["answer"]:
        # key points decide explain questions, so grading does not rest on the agent alone
        hits = [p for p in kp if _point_hit(p, entry["answer"])]
        entry["points_hit"], entry["points_total"] = hits, len(kp)
        ok = len(hits) / len(kp) >= 0.5
    entry["correct"] = ok
    _archive(L, entry)
    bump(L, "viva")
    s = _score(v["history"])
    return {"ok": True, "correct": ok, "score": f"{s['right']}/{s['total']}", "next": _next(L),
            **({"key_points_covered": f"{len(entry['points_hit'])}/{entry['points_total']}"} if "points_hit" in entry else {})}


def tool_answer_number(L: Dict[str, Any], value: float) -> Dict[str, Any]:
    v = L["viva"]
    cur = v["current"]
    if not cur or cur["kind"] != "calc" or cur.get("expected_num") is None:
        return {"ok": False, "error": "No calculation question with a stored answer is open. Use viva_record."}
    heard = " ".join(v.get("spoken") or [])[-400:]
    exp, tol, unit = float(cur["expected_num"]), float(cur["tolerance"]), (cur.get("unit") or "").strip()
    ok = abs(float(value) - exp) <= tol * abs(exp) if exp else abs(float(value)) <= tol
    _archive(L, {**cur, "answer": (heard or f"{value:g} {unit}").strip(), "expected": f"{exp:g} {unit}".strip(),
                 "correct": ok, "feedback": None})
    bump(L, "viva")
    s = _score(v["history"])
    return {"ok": True, "correct": ok, "expected": f"{exp:g} {unit}".strip(), "score": f"{s['right']}/{s['total']}",
            "next": _next(L)}


def tool_finish(L: Dict[str, Any], summary: str = "") -> Dict[str, Any]:
    v = L["viva"]
    if not v["current"] and not any(h.get("correct") is not None for h in v["history"]):
        return {"ok": False, "error": "No questions have been answered yet. Ask the questions with viva_ask first; do not end the viva."}
    if v["current"]:
        _archive(L, {**v["current"], "answer": None, "correct": None, "feedback": "not answered"})
    v.update(finished=True, active=False, summary=(summary or "").strip() or None)
    s = _score(v["history"])
    if v["history"]:
        L["attempts"].append({"id": uuid.uuid4().hex[:8], "finished_at": int(time.time()), **s,
                              "summary": v["summary"], "items": v["history"]})
        L["attempts"] = L["attempts"][-MAX_ATTEMPTS:]
    bump(L, "viva")
    return {"ok": True, "score": f"{s['right']}/{s['total']}", "percent": s["pct"]}


def click(L: Dict[str, Any], part_id: str) -> Dict[str, Any]:
    pid = (part_id or "").strip().lower()
    if pid not in PELTON_PARTS:
        return {"ok": False}
    v = L["viva"]
    cur = v["current"]
    if cur and cur["kind"] == "point":
        ok = pid == cur["part_id"]
        res = {"clicked": PELTON_PARTS[pid], "clicked_id": pid, "correct": ok,
               "expected": PELTON_PARTS[cur["part_id"]], "question_id": cur["id"]}
        _archive(L, {**cur, "answer": PELTON_PARTS[pid], "expected": PELTON_PARTS[cur["part_id"]],
                     "correct": ok, "feedback": None})
        v["last_click"] = res
        bump(L, "viva")
        return {"ok": True, **res}
    return {"ok": True, "correct": None}


def reset(L: Dict[str, Any]) -> None:
    L["viva"] = _fresh_viva()
    bump(L)


def start_tutor(lid: Optional[str], name: Optional[str]) -> str:
    """A browser started a tutor call: fresh viva, remember who, hand back the session code."""
    L = learner(lid)
    if name and name.strip():
        L["name"] = name.strip()[:60]
    reset(L)
    _STORE["last"] = L["id"]
    _save()
    return L["id"]


# ---------------------------------------------------------------------------
# Tutor brief for the Vaani agent (sent per call, so repair tabs keep their own prompt)
# ---------------------------------------------------------------------------
TUTOR_GREETING = ("Hi, I am your Pelton wheel lab tutor. Ask me about the experiment, the procedure, "
                  "the formulas, or say start the viva and I will quiz you.")

_TUTOR_PROMPT = """# Who you are

You are the lab tutor for the Pelton wheel experiment: "Performance characteristics of a Pelton turbine". You help an engineering student learn the experiment by voice. The student has a screen beside them with a live 3D model of the rig, the nine-step procedure, an observation table, calculations, graphs, a quiz and a viva. You cannot move the 3D model yourself, but you can open tabs and run the viva with your tools.

This is a LEARNING session. Do NOT call any repair tools (get_procedure, lookup_part, order_part, show_step, set_view, log_repair, search_web, read_page). Answer only from the lab facts below and general engineering knowledge you are sure of. Never invent numbers.

SESSION CODE: __CODE__
Pass this exact code as the `session` argument in EVERY tool call.

# The one rule that matters most

The student can only see a question on their screen if you register it with the viva_ask tool. A question you only SAY aloud does not exist for the system and will not be marked. So for every question: first call viva_ask with the full question text, then speak it. Never speak a question without calling viva_ask first. After point questions, call viva_wait. After any other answer, call viva_record (or viva_answer_number for numbers).

# Never invent the student's answer

Mark an answer only after the student has actually spoken one. If they are silent, or the audio is unclear ("your voice is not clear"), ask them to say it again and wait. Never guess, assume or make up what they said, and never mark a question correct without an answer. The system records the student's real words itself; if you call viva_record or viva_answer_number too early it refuses, and you must wait for them to speak.

# Tools are silent

Use tools through the tool-calling mechanism only. NEVER write a tool name, a function call, braces, JSON, quotes around arguments, or the word "status" in your spoken reply, and never describe a tool call ("I will call lab_open_tab"). Never invent a tool result. If a tool returns an error, try it once more without commenting. If it still fails, carry on with the viva by voice alone and do not mention technical problems or tell the student to find an instructor.

# Your screen tools

- lab_open_tab: opens a tab on the student's screen: learn, observe, calc or quiz. When you say "open the Calculate tab", really open it.
- lab_show: points at things on the 3D rig. Call it whenever you explain a part: part_id makes that part glow with a label and flies the camera to it. level (0 to 1, use 0.7 for a normal exploded view, 0 to put it back together) opens the rig up. view is one of iso, front, side, top, nozzle, gauges, brake, venturi. step (1 to 9) shows a procedure step. You can combine them in one call. Call lab_show before you speak, so the picture matches your words.

# How you speak

- Plain spoken language only. NEVER use markdown, asterisks, hash signs, bullets, numbered-list formatting or emoji. Your words are shown on screen as plain text. Say "step eight", not "Step 8:" in bold.
- Short, clear, friendly. At most three sentences per turn, then check understanding or offer the next step.
- Teach step by step. Ask a quick question back so the student thinks.
- Reply in the language the student uses (English, Hindi or mixed). Technical terms stay in English.
- Never read a long list aloud. Break it into steps and confirm.

# Modes

- Explain: when asked what something is or why, explain simply with the rig as the example, then ask one check question.
- Guide: walk the nine procedure steps one at a time. Wait for the student to say the step is done before the next.
- Calculation help: guide through the formulas with the student's numbers. Do not just give the final answer first.
- Viva: if the student asks for a viva or a quiz, say ONE short sentence such as "Sure, taking you to the viva now." and then stop talking. A separate examiner takes over in the Viva tab. Do not ask viva questions yourself and do not call any viva tool.

# Lab facts

Aim: to study the performance characteristics of a Pelton turbine.
Apparatus: Pelton wheel turbine, nozzle and spear arrangement, three pressure gauges (0 to 7 kg/cm2).
Principle: the Pelton wheel is an impulse turbine. The nozzle turns the pressure head into a high-velocity jet. The jet strikes double-cup buckets on the runner at atmospheric pressure and the runner turns the shaft, loaded by a brake drum. The spear varies the nozzle opening from 1/8 to 8/8. A venturimeter measures discharge. Nozzle velocity coefficient Cv = 0.97.

Rig parts: base frame and sump, centrifugal pump, penstock pipe, venturimeter with manometer, pressure gauges P1 (venturi throat), P2 (venturi inlet) and Pp (penstock), support frame and gauge board, nozzle, spear (needle valve), Pelton runner (pitch diameter 420 mm), turbine casing, shaft, brake drum (400 mm, effective 415 mm with rope), brake rope (15 mm), dead weights and hanger (T0 = 1 kg), spring balance (T2), tachometer.

Procedure:
1. Keep the nozzle opening at the required position (1/8 to 8/8).
2. Prime and start the pump.
3. Allow water to rotate the turbine.
4. Note the speed of the turbine on the tachometer.
5. Take readings from pressure gauges P1, P2 and Pp.
6. Load the turbine by placing dead weights on the hanger.
7. Note the dead weights (T1) and the spring balance reading (T2).
8. Note the head level on the venturi manometer.
9. Repeat steps 6 to 8 for different loading conditions and record each row.

Formulas:
- P = P2 - P1 (kg/cm2); H = P x 10 (m of water).
- Qact = 0.0055 x sqrt(H) (m3/s).
- Hp = Pp x 10 (m); Hi = Pp x 10 (m), one inlet gauge.
- Net load T = T1 + T0 - T2 (kg), T0 = 1 kg.
- Brake torque tau = T x 9.81 x D / 2 with D = 0.415 m.
- Brake horsepower BHP = 2 pi N tau / 60 (W), shown in kW.
- Input power IHP = rho g Qact Hi, rho = 1000 kg/m3.
- Efficiency = BHP / IHP x 100 %.

Reading results: at a fixed nozzle opening discharge and input power are constant, so efficiency rises in proportion to brake power. Brake power peaks at about half the stall load, where efficiency is highest. Efficiency against BHP looks like a straight line for that reason.

Safety: before starting, check the sump has water, the brake rope is on the drum, and keep clear of the rotating shaft and brake drum. Never put hands near the runner while the pump runs.

# Honesty

If you do not know, say so and suggest checking the lab manual or the teacher. Never make up a measured value."""


def tutor_prompt(code: str) -> str:
    return _TUTOR_PROMPT.replace("__CODE__", code)


_FACTS = _TUTOR_PROMPT[_TUTOR_PROMPT.index("# Lab facts"):]

VIVA_GREETING = "Welcome to your Pelton wheel viva. Five questions, one at a time."

_VIVA_HEAD = """# Who you are

You are the oral examiner for the Pelton wheel experiment: "Performance characteristics of a Pelton turbine". You examine an engineering student with exactly FIVE questions, one after another. The student sees each question in the Viva tab on their screen, next to a 3D model of the rig. You are an examiner, not a teacher: ask, listen, mark, move on.

SESSION CODE: __CODE__
Pass this exact code as the `session` argument in EVERY tool call.

# Tools are silent

Use tools through the tool-calling mechanism only. NEVER write a tool name, a function call, braces, JSON or the word "status" in your spoken reply, and never invent a tool result. If a tool returns an error, try it once more without commenting. If it still fails, carry on by voice and do not mention technical problems.

# How you speak

- Plain spoken language only. No markdown, asterisks, hash signs, bullets or emoji. Your words are shown on screen exactly as you say them.
- Short and professional. One or two sentences per turn. Reply in the language the student uses, with technical terms in English.

# The viva, step by step

1. After your welcome, the student says they are ready (or something like it). Reply by calling viva_ask for question one with the full question text. Say nothing before the call. Then say "Question one." and read the question aloud.
2. After each answer, every tool result has a field called next. Follow it exactly: one short sentence of feedback, then viva_ask for the next question without waiting for the student.
3. After question five, call viva_finish with a short spoken summary of the score and what to revise. Never call viva_finish before five questions have been asked and answered.
4. If the student says they do not know, mark it incorrect through viva_record (correct false, student_answer "did not know") and move on. Never explain at length during the viva.

# Question kinds. Every question is NEW and written by you. Use at least three different kinds across the five.

- point: call viva_ask with kind point and part_id, for example "Click the nozzle on the rig." Speak the question, then immediately call viva_wait. It waits for the student to click that object on the 3D rig and returns whether they were right. Tell them the result in one sentence.
- highlight: call viva_ask with kind highlight and part_id. The part glows on their rig and they name it by voice. Judge, then call viva_record.
- explain: a short conceptual question. Call viva_ask with kind explain AND key_points, two to four short phrases the answer must cover. After they answer, call viva_record with student_answer as close to word for word as you can, model_answer and one sentence of feedback. The server checks the key points.
- calc: a small calculation with numbers you give them. Work out the answer first and call viva_ask with kind calc, expected, unit and tolerance 0.05. When they say a number, call viva_answer_number with that value.
- mcq: kind mcq with options (three or four short choices). Read the choices aloud with letters. The student says a letter. Judge, then viva_record.

Valid part_id values: base, pump, penstock, venturi, gauge_p1, gauge_p2, gauge_p3, frame, nozzle, spear, runner, casing, shaft, brake_drum, rope, deadweights, spring, tacho.

"""


def viva_prompt(code: str) -> str:
    return (_VIVA_HEAD + _FACTS).replace("__CODE__", code)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
def _auth(secret: Optional[str]) -> None:
    want = os.getenv("TOOL_SECRET", "third-hand-dev")
    if want and secret != want:
        raise HTTPException(401, "bad tool secret")


class _S(BaseModel):
    session: Optional[str] = None


class TabIn(_S):
    tab: str


class AskIn(_S):
    question: str
    kind: str = "explain"
    part_id: Optional[str] = None
    options: Optional[List[str]] = None
    expected: Optional[float] = None
    unit: Optional[str] = None
    tolerance: Optional[float] = None
    key_points: Optional[List[str]] = None


class RecordIn(_S):
    question: Optional[str] = None
    kind: Optional[str] = None
    part_id: Optional[str] = None
    correct: bool = False
    student_answer: str = ""
    model_answer: str = ""
    feedback: str = ""


class NumberIn(_S):
    value: float


class FinishIn(_S):
    summary: str = ""


class WaitIn(_S):
    seconds: Optional[float] = 30
    question: Optional[str] = None
    part_id: Optional[str] = None


class ShowIn(_S):
    part_id: Optional[str] = None
    label: Optional[str] = None
    level: Optional[float] = None
    view: Optional[str] = None
    step: Optional[int] = None


class ClickIn(BaseModel):
    part_id: str


class NameIn(BaseModel):
    name: str


@router.post("/api/tools/lab_open_tab")
async def h_open_tab(b: TabIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return tool_open_tab(resolve(b.session), b.tab)


@router.post("/api/tools/lab_show")
async def h_show(b: ShowIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return tool_show(resolve(b.session), b.part_id, b.label, b.level, b.view, b.step)


@router.post("/api/tools/viva_ask")
async def h_ask(b: AskIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return tool_ask(resolve(b.session), b.question, b.kind, b.part_id, b.options, b.expected, b.unit,
                    b.tolerance, b.key_points)


@router.post("/api/tools/viva_check")
async def h_check(b: Optional[_S] = None, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return tool_check(resolve(b.session if b else None))


@router.post("/api/tools/viva_wait")
async def h_wait(b: Optional[WaitIn] = None, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return await tool_wait(resolve(b.session if b else None), (b.seconds if b else None) or 30,
                           b.question if b else None, b.part_id if b else None)


@router.post("/api/tools/viva_record")
async def h_record(b: RecordIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    L = resolve(b.session)
    cur = L["viva"]["current"]
    if cur and cur["kind"] != "point" and await _await_spoken(L) is None:
        return _NO_ANSWER
    return tool_record(L, b.correct, b.student_answer, b.model_answer, b.feedback, b.question, b.kind, b.part_id)


@router.post("/api/tools/viva_answer_number")
async def h_number(b: NumberIn, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    L = resolve(b.session)
    if L["viva"]["current"] and await _await_spoken(L) is None:
        return _NO_ANSWER
    return tool_answer_number(L, b.value)


@router.post("/api/tools/viva_finish")
async def h_finish(b: Optional[FinishIn] = None, x_tool_secret: Optional[str] = Header(None)):
    _auth(x_tool_secret)
    return tool_finish(resolve(b.session if b else None), b.summary if b else "")


class SpokeIn(BaseModel):
    text: str


@router.post("/api/lab/spoke")
async def h_spoke(b: SpokeIn, x_learner: Optional[str] = Header(None)):
    """Browser -> backend: a final line of the student's speech, so answers are checked against what was really said."""
    note_spoken(learner(x_learner), b.text)
    return {"ok": True}


@router.post("/api/lab/click")
async def h_click(b: ClickIn, x_learner: Optional[str] = Header(None)):
    """Browser -> backend: the student clicked this object on the 3D rig."""
    return click(learner(x_learner), b.part_id)


@router.post("/api/lab/reset")
async def h_reset(x_learner: Optional[str] = Header(None)):
    reset(learner(x_learner))
    return {"ok": True}


@router.post("/api/lab/name")
async def h_name(b: NameIn, x_learner: Optional[str] = Header(None)):
    L = learner(x_learner)
    L["name"] = b.name.strip()[:60] or None
    _save()
    return {"ok": True, "name": L["name"]}


def _teacher(key: Optional[str]) -> None:
    want = os.getenv("TEACHER_KEY", "teacher")
    if not key or key != want:
        raise HTTPException(401, "teacher key required")


def _summary(L: Dict[str, Any]) -> Dict[str, Any]:
    a = L["attempts"]
    return {"id": L["id"], "name": L["name"], "attempts": len(a),
            "best_pct": max((x["pct"] for x in a), default=None),
            "last_pct": a[-1]["pct"] if a else None,
            "last_at": a[-1]["finished_at"] if a else None}


@router.get("/api/teacher/learners")
async def h_teacher_list(key: Optional[str] = None):
    _teacher(key)
    rows = [_summary(L) for L in _STORE["learners"].values()]
    rows.sort(key=lambda r: r["last_at"] or 0, reverse=True)
    return {"learners": rows}


@router.get("/api/teacher/learner/{lid}")
async def h_teacher_one(lid: str, key: Optional[str] = None):
    _teacher(key)
    L = _STORE["learners"].get(_clean_id(lid))
    if not L:
        raise HTTPException(404, "unknown learner")
    return {**_summary(L), "attempts_full": L["attempts"]}
