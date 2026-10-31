import type { Machine } from './types'
import { printer } from './printer'
import { scooter } from './scooter'

export * from './types'
export { printer, scooter }

/**
 * Every machine the app knows about.
 *
 * `printer` and `scooter` are hand-authored from primitives.
 */
export const MACHINES: Record<string, Machine> = { printer, scooter }
export const MACHINE_IDS = Object.keys(MACHINES)
export const DEFAULT_MACHINE = 'printer'

export function getMachine(id: string | undefined | null): Machine {
  return MACHINES[(id ?? '').toLowerCase()] ?? MACHINES[DEFAULT_MACHINE]
}

/** Tolerant match so the agent can say "the scooter" or "bike" or "printer". */
export function resolveMachineId(raw: string): string | null {
  const k = (raw ?? '').toLowerCase()
  if (!k) return null
  if (/print|ender|fdm/.test(k)) return 'printer'
  if (/scooter|bike|motorcycle|two.?wheeler|activa|vespa|moped/.test(k)) return 'scooter'
  return MACHINE_IDS.find((id) => k.includes(id)) ?? null
}
