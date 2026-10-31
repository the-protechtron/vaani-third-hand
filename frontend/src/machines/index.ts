import type { Machine } from './types'
import { printer } from './printer'
import { mri } from './mri'
import { pump } from './pump'
import { scooter } from './scooter'

export * from './types'
export { printer, mri, pump, scooter }

/**
 * Every machine the app knows about.
 *
 * `printer` and `mri` are hand-authored from primitives. `pump` was produced
 * by dropping a .glb into the labelling studio at #label - that file is
 * generated output, checked in unedited, which is the point.
 */
export const MACHINES: Record<string, Machine> = { printer, mri, pump, scooter }
export const MACHINE_IDS = Object.keys(MACHINES)
export const DEFAULT_MACHINE = 'printer'

export function getMachine(id: string | undefined | null): Machine {
  return MACHINES[(id ?? '').toLowerCase()] ?? MACHINES[DEFAULT_MACHINE]
}

/** Tolerant match so the agent can say "the MRI" or "scanner" or "printer". */
export function resolveMachineId(raw: string): string | null {
  const k = (raw ?? '').toLowerCase()
  if (!k) return null
  if (/mri|scanner|magnet|gantry/.test(k)) return 'mri'
  if (/print|ender|fdm/.test(k)) return 'printer'
  if (/pump|impeller|centrifugal|motor/.test(k)) return 'pump'
  if (/scooter|bike|motorcycle|two.?wheeler|activa/.test(k)) return 'scooter'
  return MACHINE_IDS.find((id) => k.includes(id)) ?? null
}
