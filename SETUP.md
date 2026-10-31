# Third Hand: setup guide

A voice agent that works with a live 3D model. It has four tabs:

- **Ender-3 printer, MRI scanner, centrifugal pump**: a repair copilot. You describe a fault by voice, it walks you through the fix and points at parts on the 3D model. Parts you mention show live shop prices from the web.
- **Pelton Wheel**: a learning lab with a 3D rig, the 9-step procedure, an observation table, calculations and graphs, quizzes, a voice tutor, and a voice viva with five fresh questions (you can answer by clicking parts on the rig).

Three programs run together on your machine: the **backend** (Python), the **frontend** (Node), and **ngrok** (a tunnel, so Vaani's servers can call your backend's tools).

## What you need first

| Thing | Where | Notes |
|---|---|---|
| Python 3.11 or newer | python.org | tick "Add to PATH" on Windows |
| Node.js 18 or newer | nodejs.org | comes with npm |
| Google Chrome | | the microphone must work |
| ngrok account + authtoken | ngrok.com | free plan is fine. Install ngrok, then run `ngrok config add-authtoken YOUR_TOKEN` once |
| Vaani account **with credit** | platform.vaani.dev | create an API key (API Keys page). Voice calls cost roughly ₹10 per minute, and when the wallet goes below zero every voice call fails with `402 Payment Required` |
| Anakin API key | anakin.io | for live web search and shop prices (optional: without it, the live prices simply do not load) |

## 1. Backend

Open a terminal in the `backend` folder.

Windows (PowerShell):
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Mac / Linux:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and fill in:

- `VAANI_API_KEY`: your Vaani key
- `ANAKIN_API_KEY`: your Anakin key
- `TOOL_SECRET`: any random text you make up
- `TEACHER_KEY`: a password for the teacher page
- leave `VAANI_AGENT_ID` empty for now (step 4 fills it in)

## 2. Frontend

Open a second terminal in the `frontend` folder:
```
npm install
```

## 3. Start everything

You need three terminals open at once.

**Terminal 1, backend** (in `backend`, venv active). The port must be **8765**:
```
python -m uvicorn main:app --port 8765
```
Check: http://localhost:8765/api/health shows `"ok": true`.

**Terminal 2, frontend** (in `frontend`):
```
npm run dev
```
It serves http://localhost:5173.

**Terminal 3, tunnel:**
```
ngrok http 8765
```
Copy the `https://...ngrok-free.dev` (or `.app`) address it prints. This is your **public URL**.

## 4. Create the voice agent in your Vaani account (one command)

In the `backend` folder, with the venv active, using your public URL:
```
python setup_vaani_agent.py --base-url https://YOUR-NGROK-URL
```
This creates the "Third Hand" agent in your account with its prompt, greeting and all 16 tools pointing at your URL, and saves `VAANI_AGENT_ID` into `.env`.

Then:

1. **Restart the backend** (stop Terminal 1 with Ctrl+C and start it again) so it picks up the new agent id.
2. In the Vaani dashboard, open the agent and pick a **voice and language** (Persona, then the speech settings). The script cannot choose these for you.

## 5. Use it

1. Open **http://localhost:5173** in Chrome and allow the microphone.
2. Pick a tab and press **Start session**.
3. Repair tabs: say something like "my extruder is clicking". Say "list the replacement parts" to see the parts list. Any part you name shows live shop results.
4. **Pelton Wheel** tab: use the tutor ("explain how a Pelton wheel works"), run the experiment with the control desk, then press **Start the viva** in the Viva tab (or say "start the viva").
5. Teacher page: http://localhost:5173/#teacher, with your `TEACHER_KEY`.

## When your ngrok address changes

The free ngrok address can change every time you restart ngrok. Run this again with the new address (keep `.env` as it is):
```
python setup_vaani_agent.py --base-url https://NEW-NGROK-URL --update
```

## If something does not work

| What you see | What it means |
|---|---|
| `402 Payment Required: Insufficient balance` | The Vaani wallet is out of credit. Top it up. |
| Start session fails or says microphone blocked | Allow the mic in Chrome's address bar (lock icon) and try again. Use Chrome, not a preview window. |
| The agent says it cannot do things / "technical issue", and the ngrok page (http://127.0.0.1:4040) shows **401** on `/api/tools/...` | The tool secret does not match. Make sure `TOOL_SECRET` in `.env` is the one you used, restart the backend, then run `setup_vaani_agent.py --update`. |
| ngrok page shows nothing arriving from Vaani | The tools still point at an old ngrok address. Run the `--update` command above. |
| `localhost:5173` loads but nothing responds | The backend is not running on port **8765**. |
| Live shop prices never appear | Missing or wrong `ANAKIN_API_KEY`, or Anakin credit used up. |
| Port 8765 already in use | Another program has it. Close it, or change the port in both `frontend/vite.config.ts` (the `/api` proxy) and the uvicorn and ngrok commands. |

## What is where

- `backend/main.py`: the API, the repair tools, live product search
- `backend/lab.py`: the Pelton lab: tutor and viva tools, grading, saved results
- `backend/data/`: parts catalogue and repair procedures (per machine), and `lab_store.json` (created when someone uses the lab; learner results)
- `backend/agent_template.json`: the voice agent's prompt, greeting and tools
- `frontend/src/`: the web app. `pelton/` is the Pelton lab, `machines/` the three repair machines

## Notes

- Student names and scores are kept in `backend/data/lab_store.json` on the machine running the backend. The teacher key is one shared password, not real accounts.
- Nothing here is production ready: there is no user login, and the tool secret is the only protection on the tool endpoints.
