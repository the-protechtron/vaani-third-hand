/**
 * Voice loop, powered by a Vaani Voice AI agent over WebRTC.
 *
 *   1. POST /api/vaani/session  -> backend mints a join token (the API key never
 *      reaches the browser)
 *   2. join the LiveKit room with the mic on; the Vaani agent speaks first
 *   3. Vaani calls our backend tools (get_procedure, lookup_part, ...) through
 *      the public tunnel; we poll /api/session so the screen follows along
 *   4. live captions arrive on a signed websocket -> the conversation panel
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { LocalAudioTrack, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { clientTools } from './clientTools'
import { useScene } from './store'
import { api, learnerId, learnerName } from './learner'

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking'
export interface WebSource {
  title: string
  url: string
  snippet?: string
}
export type Handoff = { state: 'loading' | 'ready' | 'error'; summary?: string; error?: string }

// Which conversation new lines belong to. The viva is a separate call with its own chat.
let channel: 'tutor' | 'viva' = 'tutor'

const push = (role: 'user' | 'agent' | 'tool', text: string) =>
  useScene.getState().push({ role, text, ts: Date.now(), ch: channel })

/** Caption frames are not formally documented; read the common shapes defensively. */
function parseCaption(raw: string): { role: 'user' | 'agent'; text: string; final: boolean } | null {
  let m: any
  try { m = JSON.parse(raw) } catch { return null }
  m = m?.data ?? m?.transcript ?? m
  const text = m?.text ?? m?.message ?? m?.content ?? m?.transcript
  if (typeof text !== 'string' || !text.trim()) return null
  const who = String(m?.role ?? m?.speaker ?? m?.participant ?? m?.type ?? '').toLowerCase()
  const role = /user|human|caller|customer|client/.test(who) ? 'user' : 'agent'
  const final = m?.final ?? m?.is_final ?? m?.isFinal ?? true
  return { role, text: text.trim(), final: !!final }
}

interface SceneSync {
  machine: string | null
  part_id: string | null
  label: string | null
  explode: number
  step: { n: number; total: number; instruction: string; tool?: string; check?: string } | null
}

/** Replays what the agent's server tools asked the screen to show. */
export function applyScene(sc: SceneSync) {
  if (sc.machine && sc.machine !== useScene.getState().machine.id) {
    clientTools.switch_machine({ machine: sc.machine })
  }
  clientTools.clear_scene()
  clientTools.set_explode({ level: sc.explode ?? 0 })
  if (sc.part_id) {
    clientTools.focus_part({ part_id: sc.part_id })
    clientTools.highlight_part({ part_id: sc.part_id, label: sc.label ?? undefined })
  }
  if (sc.step) {
    clientTools.show_step({
      step_number: sc.step.n,
      total_steps: sc.step.total,
      instruction: sc.step.instruction,
      tool: sc.step.tool,
      check: sc.step.check,
    })
  }
}

/**
 * Starts the viva without waiting for the student to speak: plays a short recorded
 * "I am ready, begin question one" into the call, exactly as if they had said it.
 * (The agent ignores text messages, but it hears speech.) The real microphone is
 * switched on afterwards.
 */
async function speakReady(room: Room) {
  const ctx = new AudioContext()
  try {
    await ctx.resume()
    const audio = await ctx.decodeAudioData(await (await fetch('/audio/viva-ready.wav')).arrayBuffer())
    const dest = ctx.createMediaStreamDestination()
    const src = ctx.createBufferSource()
    src.buffer = audio
    src.connect(dest)
    const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0])
    await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone })
    const done = new Promise<void>((r) => { src.onended = () => r() })
    src.start()
    await done
    await new Promise((r) => setTimeout(r, 250))
    await room.localParticipant.unpublishTrack(track)
    track.stop()
  } finally {
    void ctx.close()
  }
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [sources, setSources] = useState<WebSource[]>([])
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const handoffRequested = useRef(false)
  const sessionStarted = useRef(0)
  const roomRef = useRef<Room | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<number | null>(null)
  const audioEls = useRef<HTMLMediaElement[]>([])
  const lastSeq = useRef<number | null>(null)

  const teardown = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    roomRef.current?.disconnect()
    roomRef.current = null
    audioEls.current.forEach((el) => el.remove())
    audioEls.current = []
    setStatus('idle')
  }, [])

  useEffect(() => teardown, [teardown])

  const beginSession = useCallback(async (mode: 'repair' | 'pelton' | 'viva' = 'repair') => {
    teardown()
    channel = mode === 'viva' ? 'viva' : 'tutor'
    useScene.getState().reset()
    lastSeq.current = null
    setHandoff(null)
    handoffRequested.current = false
    sessionStarted.current = Date.now()

    if (mode === 'repair') {
      const selected = useScene.getState().machine.id
      const synced = await fetch('/api/machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine: selected }),
      })
      if (!synced.ok) throw new Error(`Could not select ${selected} (${synced.status})`)
    }

    if (mode === 'viva') {
      // permission now (inside the click); the mic itself is turned on after the kickoff line
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      probe.getTracks().forEach((t) => t.stop())
    }

    const res = await fetch('/api/vaani/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, learner: learnerId(), name: learnerName() }),
    })
    if (!res.ok) throw new Error(`session ${res.status}: ${(await res.text()).slice(0, 160)}`)
    const s = await res.json()
    if (!s.token || !s.connection_url) throw new Error('Vaani returned no join token')

    // Two caption sources exist (LiveKit transcription events and the captions
    // socket). The first one to speak wins; the other is ignored so a line is
    // never shown twice. Partial text is shown AS IT STREAMS and rewritten in
    // place, so words appear with the voice instead of after it.
    let source: 'room' | 'ws' | null = null
    const turn = { user: 0, agent: 0 }
    const reported = new Set<string>()
    const stream = (from: 'room' | 'ws', role: 'user' | 'agent', text: string, final: boolean, segId?: string) => {
      if (source && source !== from) return
      source = from
      // In a viva, tell the backend what the student REALLY said, so answers are checked against it
      // and the agent cannot mark a question the student never answered.
      if (final && role === 'user' && channel === 'viva' && text.trim()) {
        const key = segId ?? `${from}:${text}`
        if (!reported.has(key)) {
          reported.add(key)
          void api('/api/lab/spoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
        }
      }
      const id = segId ?? `${from}:${role}:${turn[role]}`
      if (final && !segId) turn[role] += 1
      let out = text
      if (from === 'ws') {
        // frames may be cumulative ("Hel", "Hello") or incremental ("Hel", "lo"); handle both
        const prev = useScene.getState().transcript.find((l) => l.id === id)?.text
        if (prev && !text.startsWith(prev) && !prev.startsWith(text)) out = `${prev} ${text}`.replace(/\s+/g, ' ')
        else if (prev && prev.startsWith(text) && prev.length > text.length) out = prev
      }
      useScene.getState().upsert({ id, role, text: out, ts: Date.now(), ch: channel })
      if (mode === 'repair' && useScene.getState().machine.id === 'scooter' && role === 'agent' && final &&
          /professional help|professional service|see a mechanic|visit a mechanic|take .* to (a |the )?mechanic|service cent(re|er)/i.test(out) &&
          !handoffRequested.current) {
        const conversation = useScene.getState().transcript
          .filter((line) => line.ts >= sessionStarted.current && line.role !== 'tool')
          .map(({ role, text }) => ({ role, text }))
        if (!conversation.some((line) => line.role === 'user')) return
        handoffRequested.current = true
        setHandoff({ state: 'loading' })
        void fetch('/api/handoff', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machine: 'scooter', conversation }) })
          .then(async (r) => { if (!r.ok) throw new Error(r.status === 503 ? 'Add a Groq API key to enable handoffs.' : `Request failed (${r.status}).`); return r.json() })
          .then((result) => setHandoff({ state: 'ready', summary: result.summary }))
          .catch((error) => setHandoff({ state: 'error', error: String(error.message ?? error) }))
      }
    }

    const room = new Room({ adaptiveStream: true })
    roomRef.current = room

    // The agent's voice arrives as a remote audio track; attach it so it plays.
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return
      const el = track.attach()
      el.style.display = 'none'
      document.body.appendChild(el)
      audioEls.current.push(el)
    })
    let agentSpoke = false
    let agentTalkingNow = false
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const agentTalking = speakers.some((p) => p !== room.localParticipant)
      agentTalkingNow = agentTalking
      if (agentTalking) agentSpoke = true
      const userTalking = speakers.includes(room.localParticipant)
      setStatus(agentTalking ? 'speaking' : userTalking ? 'listening' : 'listening')
    })
    // Standard LiveKit agent transcription: one event per speech segment.
    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      const role = participant && participant === room.localParticipant ? 'user' : 'agent'
      for (const seg of segments) {
        if (!seg.text?.trim()) continue
        stream('room', role, seg.text.trim(), !!seg.final, `room:${seg.id}`)
      }
    })
    room.on(RoomEvent.Disconnected, () => {
      push('tool', 'session ended')
      teardown()
    })

    await room.connect(s.connection_url, s.token)
    await room.startAudio()
    if (mode !== 'viva') await room.localParticipant.setMicrophoneEnabled(true) // throws if the mic is blocked
    setStatus('listening')
    push('tool', mode === 'viva' ? 'connected to the viva examiner' : 'connected to the Third Hand agent')
    // The viva starts when you click it: once the welcome has been spoken, say "ready" for the
    // student, then open their real microphone.
    if (mode === 'viva') {
      void (async () => {
        try {
          const t0 = Date.now()
          while (Date.now() - t0 < 12000 && !(agentSpoke && !agentTalkingNow)) await new Promise((r) => setTimeout(r, 150))
          await new Promise((r) => setTimeout(r, 500))
          if (roomRef.current !== room) return // call already ended
          await speakReady(room)
        } catch { /* the student can still say "ready" themselves */ }
        try { if (roomRef.current === room) await room.localParticipant.setMicrophoneEnabled(true) } catch { /* mic blocked */ }
      })()
    }

    if (s.live_captions_url) {
      try {
        const ws = new WebSocket(s.live_captions_url)
        wsRef.current = ws
        ws.onmessage = (e) => {
          const c = typeof e.data === 'string' ? parseCaption(e.data) : null
          if (!c) {
            console.debug('[captions] unparsed frame', e.data)
            return
          }
          stream('ws', c.role, c.text, c.final)
        }
      } catch { /* captions are a nice-to-have */ }
    }

    // Screen follows the agent: server tools change the active machine and
    // record web results; mirror both here.
    pollRef.current = window.setInterval(async () => {
      if (mode !== 'repair') return // the lab tutor and viva examiner do not drive the repair scene
      try {
        const r = await fetch('/api/session')
        if (!r.ok) return
        const st = await r.json()
        setSources(Array.isArray(st.sources) ? st.sources : [])
        const sc = st.scene
        if (sc) {
          // First poll only records where the backend is, so a stale scene from
          // an earlier session is not replayed.
          if (lastSeq.current === null) lastSeq.current = sc.seq
          else if (sc.seq !== lastSeq.current) {
            lastSeq.current = sc.seq
            applyScene(sc)
          }
        }
      } catch { /* backend blip */ }
    }, 1200)
  }, [teardown])

  const endSession = useCallback(() => {
    teardown()
    setSources([])
  }, [teardown])

  const generateSummary = useCallback(async () => {
    const machine = useScene.getState().machine.id
    const conversation = useScene.getState().transcript
      .filter((line) => line.role !== 'tool' && line.text.trim())
      .map(({ role, text }) => ({ role, text }))
    if (!conversation.some((line) => line.role === 'user')) {
      setHandoff({ state: 'error', error: 'No user messages to summarize yet.' })
      return
    }
    setHandoff({ state: 'loading' })
    try {
      const r = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine, conversation }),
      })
      if (!r.ok) {
        throw new Error(r.status === 503 ? 'Add a Groq API key to enable handoffs.' : `Request failed (${r.status}).`)
      }
      const result = await r.json()
      setHandoff({ state: 'ready', summary: result.summary })
    } catch (error: any) {
      setHandoff({ state: 'error', error: String(error?.message ?? error) })
    }
  }, [])

  return { status, sources, handoff, beginSession, endSession, generateSummary }
}
