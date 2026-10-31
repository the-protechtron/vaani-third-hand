/** Who is using this browser. No login: a random id kept in localStorage, plus an optional name. */
const ID_KEY = 'th-learner-id'
const NAME_KEY = 'th-learner-name'

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: id lasts for this visit only */ }
}

let memoryId: string | null = null

export function learnerId(): string {
  const saved = read(ID_KEY) ?? memoryId
  if (saved) return saved
  const id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('')
  memoryId = id
  write(ID_KEY, id)
  return id
}

export const learnerName = () => read(NAME_KEY) ?? ''
export const setLearnerName = (n: string) => write(NAME_KEY, n.trim().slice(0, 60))

/** fetch that tells the backend which learner is asking */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), 'X-Learner': learnerId() } })
}
