"""
Smoke test for the two Anakin stages Third Hand uses:

  1. search - POST /v1/search  {prompt, limit}        -> results[] title/url
  2. scrape - POST /v1/scrape  {url, formats:[markdown]} -> page content

Run from backend/:  python test_anakin.py
Needs ANAKIN_API_KEY in backend/.env. Expect 2 x PASS.
"""

import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
KEY = os.getenv("ANAKIN_API_KEY", "")
BASE = "https://api.anakin.io/v1"
HEADERS = {"X-API-Key": KEY, "Content-Type": "application/json"}

results: list = []


def report(name: str, ok: bool, detail: str) -> None:
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


def _first(res):
    """Anakin wraps lists slightly differently per endpoint - handle all."""
    if isinstance(res, dict):
        for key in ("results", "data", "items"):
            if isinstance(res.get(key), list) and res[key]:
                return res[key]
        if res.get("content") or res.get("markdown"):
            return [res]
    return res if isinstance(res, list) else []


# --- 1. search ---------------------------------------------------------------
first_url = None
try:
    r = httpx.post(
        f"{BASE}/search",
        headers=HEADERS,
        json={"prompt": "3D printer cold end replacement price India", "limit": 3},
        timeout=60,
    )
    r.raise_for_status()
    items = _first(r.json()) or []
    lines = [f"{i.get('title', i.get('url', '?'))} -> {i.get('url', '')}" for i in items[:3]]
    report("search", bool(items), f"{len(items)} results | " + " | ".join(lines)[:400])
    first_url = next((i.get("url") for i in items if i.get("url")), None)
except Exception as e:  # noqa: BLE001
    report("search", False, repr(e)[:300])

# --- 2. scrape (async job: POST /v1/crawl -> poll GET /v1/crawl/{jobId}) -----
def _crawl(url: str, tries: int = 6, gap: int = 3) -> str:
    r = httpx.post(
        f"{BASE}/crawl",
        headers=HEADERS,
        json={"url": url, "formats": ["markdown"]},
        timeout=30,
    )
    r.raise_for_status()
    job = (r.json() or {}).get("jobId", "")
    for _ in range(tries):
        time.sleep(gap)
        p = httpx.get(f"{BASE}/crawl/{job}", headers={"X-API-Key": KEY}, timeout=20)
        b = p.json() or {}
        status = str(b.get("status", "")).lower()
        if status in ("completed", "done", "success", "finished", "complete"):
            res = b.get("results") or []
            return (res[0].get("markdown") or "") if res else ""
        if status in ("failed", "error"):
            return ""
    return ""


try:
    text = _crawl(first_url or "https://example.com", tries=5)
    if not text.strip():
        # Heavy shop pages render for minutes - prove the pipeline on a light one.
        text = _crawl("https://example.com", tries=4)
    report("scrape", bool(text.strip()), f"{len(text)} chars of markdown: {text[:220]!r}")
except Exception as e:  # noqa: BLE001
    report("scrape", False, repr(e)[:300])

print()
print(f"{sum(results)}/2 Anakin checks passed.")
sys.exit(0 if all(results) else 1)
