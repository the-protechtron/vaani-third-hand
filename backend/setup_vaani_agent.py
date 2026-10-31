"""Creates (or updates) the "Third Hand" voice agent in YOUR Vaani account.

What it does
  1. creates the agent with the prompt + greeting from agent_template.json
  2. attaches all the tools, pointed at YOUR public URL (ngrok) with YOUR tool secret
  3. writes VAANI_AGENT_ID into backend/.env

Usage (from the backend folder, with the venv active):
  python setup_vaani_agent.py --base-url https://your-name.ngrok-free.dev
  python setup_vaani_agent.py --base-url https://new-url.ngrok-free.dev --update   # ngrok URL changed

Needs VAANI_API_KEY (and TOOL_SECRET) in backend/.env. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ENV = HERE / ".env"
API = "https://api.vaanivoice.ai"


def env_get(name: str) -> str:
    if ENV.exists():
        for line in ENV.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip()
    return ""


def env_set(name: str, value: str) -> None:
    lines = ENV.read_text(encoding="utf-8-sig").splitlines() if ENV.exists() else []
    out, done = [], False
    for line in lines:
        if line.startswith(f"{name}="):
            out.append(f"{name}={value}")
            done = True
        else:
            out.append(line)
    if not done:
        out.append(f"{name}={value}")
    ENV.write_text("\n".join(out) + "\n", encoding="utf-8")


def call(method: str, path: str, key: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"X-API-Key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Vaani said {e.code} for {method} {path}: {e.read().decode()[:300]}")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Vaani: {e.reason}")
    if isinstance(data, dict) and data.get("status_code", 200) >= 400:
        sys.exit(f"Vaani error for {method} {path}: {data.get('message') or data.get('error')}")
    return data


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", required=True, help="your public https URL, e.g. https://abc.ngrok-free.dev (no trailing slash)")
    ap.add_argument("--update", action="store_true", help="update the agent in VAANI_AGENT_ID instead of creating a new one")
    ap.add_argument("--name", default=None, help="agent display name (default: Third Hand)")
    ap.add_argument("--no-env", action="store_true", help="do not write VAANI_AGENT_ID into .env")
    ap.add_argument("--dry-run", action="store_true", help="print what would be sent, change nothing")
    a = ap.parse_args()

    key = env_get("VAANI_API_KEY")
    secret = env_get("TOOL_SECRET") or "third-hand-dev"
    if not key or "xxxx" in key:
        sys.exit("Put your real VAANI_API_KEY in backend/.env first.")
    base = a.base_url.rstrip("/")
    if not base.startswith("https://"):
        sys.exit("--base-url must be a public https URL (Vaani's servers cannot reach localhost). Run: ngrok http 8765")

    tpl = json.loads((HERE / "agent_template.json").read_text(encoding="utf-8-sig"))
    raw = json.dumps(tpl["functions"]).replace("{{BASE_URL}}", base).replace("{{TOOL_SECRET}}", secret)
    functions = json.loads(raw)
    name = a.name or tpl["display_name"]
    persona = {"identity": {"system_prompt": tpl["system_prompt"], "greeting_message": {"agent_message": tpl["greeting"]}}}

    print(f"{len(functions)} tools -> {base}/api/tools/*   (secret: {len(secret)} characters)")
    if a.dry_run:
        print("dry run: nothing sent.")
        return

    if a.update:
        agent_id = env_get("VAANI_AGENT_ID")
        if not agent_id:
            sys.exit("--update needs VAANI_AGENT_ID in backend/.env")
        call("PATCH", f"/api/agent/{agent_id}/persona", key, {**persona, "actions": {"functions": functions}})
        print(f"Updated agent {agent_id}.")
        return

    created = call("POST", "/api/create-agent", key, {"agent_display_name": name, "config": {"persona": persona}})
    agent_id = created.get("agent_id") or created.get("id")
    if not agent_id:
        sys.exit(f"Vaani did not return an agent id: {str(created)[:300]}")
    call("PATCH", f"/api/agent/{agent_id}/persona", key, {"actions": {"functions": functions}})
    print(f"Created agent '{name}': {agent_id}")
    if not a.no_env:
        env_set("VAANI_AGENT_ID", agent_id)
        print("Saved VAANI_AGENT_ID in backend/.env. Restart the backend.")
    print("\nNext: in the Vaani dashboard open this agent and choose a voice and language (Persona -> Mouth / Ears).")


if __name__ == "__main__":
    main()
