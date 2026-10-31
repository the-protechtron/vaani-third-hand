"""
Smoke test for the three Vaani stages Third Hand uses:

  1. chat - vaani-105b-conversations with native tool calling
  2. tts  - bulbul:v3, speaker shubh, pace 1.05
  3. stt  - saaras:v3, auto-detect (it transcribes the audio from step 2)

Run from backend/:  python test_vaani.py
Needs VAANI_API_KEY in backend/.env. Expect 3 x PASS.
"""

import base64
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
KEY = os.getenv("VAANI_API_KEY", "")
BASE = "https://api.vaani.dev"
HEADERS = {"api-subscription-key": KEY, "Authorization": f"Bearer {KEY}"}

results: list = []


def report(name: str, ok: bool, detail: str) -> None:
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    if not ok and "invalid_api_key" in detail:
        print("      ^ backend/.env VAANI_API_KEY was rejected (invalid_api_key_error).")
        print("        Keys prefixed sk_samvaad are Samvaad/Voice-Agents scoped and do NOT")
        print("        work for chat/STT/TTS. Copy a general API key from the dashboard's")
        print("        API Keys page (it is shown once), paste it into backend/.env and")
        print("        run this script again.")


# --- 1. chat completions + tool calling ------------------------------------
try:
    body = {
        "model": "vaani-105b-conversations",
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "You are Third Hand, a repair agent for factory machines. Use tools before answering.",
            },
            {"role": "user", "content": "I'm on the printer and the extruder is clicking."},
        ],
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "get_procedure",
                    "description": (
                        "Look up the official service procedure for a fault. "
                        "ALWAYS call this first, with the technician's own words."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "symptom": {
                                "type": "string",
                                "description": "What the technician described, in their own words",
                            },
                            "machine": {"type": "string", "enum": ["printer", "mri", "pump"]},
                        },
                        "required": ["symptom"],
                    },
                },
            }
        ],
        "tool_choice": "auto",
    }
    r = httpx.post(f"{BASE}/v1/chat/completions", headers=HEADERS, json=body, timeout=90)
    r.raise_for_status()
    msg = r.json()["choices"][0]["message"]
    calls = msg.get("tool_calls") or []
    names = [c["function"]["name"] for c in calls]
    content = (msg.get("content") or "")[:120]
    report("chat+tools", bool(calls), f"tool_calls={names or '-'} content={content!r}")
except httpx.HTTPStatusError as e:  # noqa: BLE001
    report("chat+tools", False, f"HTTP {e.response.status_code} {e.response.text[:200]}")
except Exception as e:  # noqa: BLE001
    report("chat+tools", False, repr(e)[:300])

# --- 2. text to speech -------------------------------------------------------
wav_path = Path(__file__).parent / "artifacts" / "tts_check.wav"
try:
    r = httpx.post(
        f"{BASE}/text-to-speech",
        headers=HEADERS,
        json={
            "text": "Step one. Switch off the power supply before you open the electronics bay.",
            "language_code": "en-IN",
            "speaker": "shubh",
            "pace": 1.05,
        },
        timeout=90,
    )
    r.raise_for_status()
    b64 = (r.json().get("audios") or [None])[0]
    if not b64:
        raise ValueError(f"no audios in response: {str(r.json())[:200]}")
    wav_path.parent.mkdir(exist_ok=True)
    wav_path.write_bytes(base64.b64decode(b64))
    report("tts", True, f"{wav_path.stat().st_size} bytes -> {wav_path.name}")
except httpx.HTTPStatusError as e:  # noqa: BLE001
    report("tts", False, f"HTTP {e.response.status_code} {e.response.text[:200]}")
except Exception as e:  # noqa: BLE001
    report("tts", False, repr(e)[:300])

# --- 3. speech to text (round-trips the clip from step 2) --------------------
try:
    if not wav_path.exists():
        raise FileNotFoundError("run the tts check first")
    r = httpx.post(
        f"{BASE}/speech-to-text",
        headers=HEADERS,
        data={"model": "saaras:v3", "language_code": "unknown"},
        files={"file": (wav_path.name, wav_path.read_bytes(), "audio/wav")},
        timeout=90,
    )
    r.raise_for_status()
    out = r.json()
    text = (out.get("transcript") or out.get("text") or "").strip()
    report("stt", bool(text), f"heard: {text[:160]!r} (language={out.get('language_code')})")
except httpx.HTTPStatusError as e:  # noqa: BLE001
    report("stt", False, f"HTTP {e.response.status_code} {e.response.text[:200]}")
except Exception as e:  # noqa: BLE001
    report("stt", False, repr(e)[:300])

print()
print(f"{sum(results)}/3 Vaani checks passed.")
sys.exit(0 if all(results) else 1)
