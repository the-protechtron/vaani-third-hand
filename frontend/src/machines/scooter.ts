import type { Machine } from './types'

const BLACK = '#24272c'
const RED = '#d54a3f'
const STEEL = '#a9b3bd'
const RUBBER = '#17191d'
const TRIM = '#515861'

/** Generic 110 cc automatic scooter: owner-safe checks only, not a manufacturer manual. */
export const scooter: Machine = {
  id: 'scooter', name: '110 cc commuter scooter', subtitle: 'owner checks · interactive component map', spokenName: 'the scooter',
  groupY: -0.05, homePos: [5.7, 2.65, 6.5], focusDistance: 3.6,
  parts: [
    // Fixed chassis and fairings establish the scooter silhouette; repair points move separately.
    { id: 'underseat', label: 'Rear fairing', kind: 'sphere', pos: [-0.72, 1.46, 0], size: [1.24, 0.59, 0.43], color: RED, explode: [0, 0, 0], selectable: false },
    { id: 'tail', label: 'Tail panel', kind: 'sphere', pos: [-1.55, 1.36, 0], size: [0.52, 0.32, 0.39], color: RED, explode: [0, 0, 0], selectable: false },
    { id: 'seat', label: 'Seat', kind: 'sphere', pos: [-0.77, 1.98, 0], size: [1.02, 0.18, 0.45], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'front_fairing', label: 'Front fairing', kind: 'sphere', pos: [1.16, 1.61, 0], size: [0.55, 0.92, 0.46], rot: [0, 0, -0.18], color: RED, explode: [0, 0, 0], selectable: false },
    { id: 'nose', label: 'Front apron', kind: 'sphere', pos: [1.38, 1.40, 0], size: [0.34, 0.52, 0.40], color: '#e25749', explode: [0, 0, 0], selectable: false },
    { id: 'dash', label: 'Instrument cluster', kind: 'sphere', pos: [1.03, 2.26, 0], size: [0.32, 0.17, 0.35], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'leg_shield', label: 'Leg shield', kind: 'sphere', pos: [0.56, 1.48, 0], size: [0.23, 0.69, 0.43], rot: [0, 0, -0.2], color: '#ef6858', explode: [0, 0, 0], selectable: false },
    { id: 'floorboard', label: 'Floorboard', kind: 'box', pos: [0.02, 0.94, 0], size: [1.83, 0.16, 0.75], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'footwell', label: 'Footwell trim', kind: 'box', pos: [0.04, 1.05, 0], size: [1.72, 0.055, 0.67], color: '#565e66', explode: [0, 0, 0], selectable: false },
    { id: 'foot_strip_left', label: 'Footboard grip', kind: 'box', pos: [0.03, 1.09, -0.24], size: [1.35, 0.025, 0.07], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'foot_strip_right', label: 'Footboard grip', kind: 'box', pos: [0.03, 1.09, 0.24], size: [1.35, 0.025, 0.07], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'side_trim', label: 'Side panel trim', kind: 'sphere', pos: [-0.85, 1.35, 0.40], size: [0.65, 0.16, 0.035], color: '#f4b3a6', explode: [0, 0, 0], selectable: false },
    { id: 'front_fender', label: 'Front fender', kind: 'sphere', pos: [1.53, 1.08, 0], size: [0.64, 0.20, 0.34], color: RED, explode: [0, 0, 0], selectable: false },
    { id: 'rear_fender', label: 'Rear fender', kind: 'sphere', pos: [-1.40, 1.07, 0], size: [0.63, 0.18, 0.34], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'fork', label: 'Front fork', kind: 'cyl', pos: [1.48, 1.13, 0], size: [0.075, 1.05, 16], rot: [0, 0, 0.12], color: STEEL, explode: [0, 0, 0], selectable: false },
    { id: 'exhaust', label: 'Exhaust cover', kind: 'sphere', pos: [-1.18, 0.78, -0.47], size: [0.65, 0.16, 0.15], color: '#51565d', explode: [0, 0, 0], selectable: false },
    { id: 'engine_case', label: 'Engine case', kind: 'sphere', pos: [-0.91, 0.78, 0.29], size: [0.69, 0.37, 0.23], color: '#777f87', explode: [0, 0, 0], selectable: false },
    { id: 'centre_stand', label: 'Centre stand', kind: 'box', pos: [-0.29, 0.36, 0.20], size: [0.09, 0.61, 0.08], rot: [0, 0, -0.28], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'stand_foot', label: 'Stand foot', kind: 'box', pos: [-0.39, 0.08, 0.20], size: [0.34, 0.07, 0.12], color: BLACK, explode: [0, 0, 0], selectable: false },
    { id: 'front_wheel', label: 'Front tyre and wheel', kind: 'torus', pos: [1.53, 0.58, 0], size: [0.47, 0.12, 32], color: RUBBER, explode: [1.05, 0, 0.2] },
    { id: 'rear_wheel', label: 'Rear tyre and wheel', kind: 'torus', pos: [-1.42, 0.58, 0], size: [0.47, 0.12, 32], color: RUBBER, explode: [-1.05, 0, 0.2] },
    { id: 'front_hub', label: 'Front wheel hub', kind: 'cyl', pos: [1.53, 0.58, 0.02], size: [0.27, 0.20, 24], rot: [Math.PI / 2, 0, 0], color: STEEL, explode: [1.05, 0, 0.2], selectable: false },
    { id: 'rear_hub', label: 'Rear wheel hub', kind: 'cyl', pos: [-1.42, 0.58, 0.02], size: [0.27, 0.20, 24], rot: [Math.PI / 2, 0, 0], color: STEEL, explode: [-1.05, 0, 0.2], selectable: false },
    { id: 'front_spoke_a', label: 'Front wheel spoke', kind: 'box', pos: [1.53, 0.58, 0.16], size: [0.77, 0.065, 0.06], color: TRIM, explode: [1.05, 0, 0.2], selectable: false },
    { id: 'front_spoke_b', label: 'Front wheel spoke', kind: 'box', pos: [1.53, 0.58, 0.16], size: [0.77, 0.065, 0.06], rot: [0, 0, Math.PI / 3], color: TRIM, explode: [1.05, 0, 0.2], selectable: false },
    { id: 'front_spoke_c', label: 'Front wheel spoke', kind: 'box', pos: [1.53, 0.58, 0.16], size: [0.77, 0.065, 0.06], rot: [0, 0, -Math.PI / 3], color: TRIM, explode: [1.05, 0, 0.2], selectable: false },
    { id: 'rear_spoke_a', label: 'Rear wheel spoke', kind: 'box', pos: [-1.42, 0.58, 0.16], size: [0.77, 0.065, 0.06], color: TRIM, explode: [-1.05, 0, 0.2], selectable: false },
    { id: 'rear_spoke_b', label: 'Rear wheel spoke', kind: 'box', pos: [-1.42, 0.58, 0.16], size: [0.77, 0.065, 0.06], rot: [0, 0, Math.PI / 3], color: TRIM, explode: [-1.05, 0, 0.2], selectable: false },
    { id: 'rear_spoke_c', label: 'Rear wheel spoke', kind: 'box', pos: [-1.42, 0.58, 0.16], size: [0.77, 0.065, 0.06], rot: [0, 0, -Math.PI / 3], color: TRIM, explode: [-1.05, 0, 0.2], selectable: false },
    { id: 'brake_disc', label: 'Front brake disc', kind: 'cyl', pos: [1.53, 0.58, 0.19], size: [0.19, 0.025, 24], rot: [Math.PI / 2, 0, 0], color: '#c8d0d6', explode: [1.05, 0, 0.2], selectable: false },
    { id: 'tyre_valve', label: 'Tyre valve', kind: 'cyl', pos: [1.83, 0.24, 0.15], size: [0.035, 0.17, 12], rot: [0, 0, -0.72], color: STEEL, explode: [1.05, 0, 0.2] },
    { id: 'headlamp', label: 'Headlamp assembly', kind: 'sphere', pos: [1.61, 1.96, 0], size: [0.16, 0.29, 0.31], color: '#dcefff', explode: [0.65, 0.2, 0.55] },
    { id: 'tail_lamp', label: 'Tail lamp', kind: 'sphere', pos: [-1.94, 1.45, 0], size: [0.09, 0.16, 0.28], color: '#ad1f31', explode: [0, 0, 0], selectable: false },
    { id: 'front_indicator', label: 'Front indicator', kind: 'sphere', pos: [1.48, 1.57, 0.36], size: [0.11, 0.10, 0.06], color: '#f3a647', explode: [0, 0, 0], selectable: false },
    { id: 'rear_indicator', label: 'Rear indicator', kind: 'sphere', pos: [-1.76, 1.47, 0.36], size: [0.11, 0.09, 0.06], color: '#f3a647', explode: [0, 0, 0], selectable: false },
    { id: 'handlebar', label: 'Handlebar controls', kind: 'cyl', pos: [1.04, 2.48, 0], size: [0.09, 1.24, 16], rot: [Math.PI / 2, 0, 0], color: BLACK, explode: [0, 0.72, 0] },
    { id: 'left_grip', label: 'Left grip', kind: 'cyl', pos: [1.04, 2.48, -0.61], size: [0.12, 0.24, 16], rot: [Math.PI / 2, 0, 0], color: BLACK, explode: [0, 0.72, 0], selectable: false },
    { id: 'right_grip', label: 'Right grip', kind: 'cyl', pos: [1.04, 2.48, 0.61], size: [0.12, 0.24, 16], rot: [Math.PI / 2, 0, 0], color: BLACK, explode: [0, 0.72, 0], selectable: false },
    { id: 'mirror_stalk_near', label: 'Mirror stalk', kind: 'cyl', pos: [1.06, 2.77, 0.51], size: [0.025, 0.49, 10], rot: [0, 0, -0.25], color: STEEL, explode: [0, 0.72, 0], selectable: false },
    { id: 'mirror_near', label: 'Rear-view mirror', kind: 'sphere', pos: [1.17, 3.01, 0.55], size: [0.27, 0.14, 0.045], color: '#9ab4c4', explode: [0, 0.72, 0], selectable: false },
    { id: 'mirror_stalk_far', label: 'Mirror stalk', kind: 'cyl', pos: [1.06, 2.77, -0.51], size: [0.025, 0.49, 10], rot: [0, 0, -0.25], color: STEEL, explode: [0, 0.72, 0], selectable: false },
    { id: 'mirror_far', label: 'Rear-view mirror', kind: 'sphere', pos: [1.17, 3.01, -0.55], size: [0.27, 0.14, 0.045], color: '#9ab4c4', explode: [0, 0.72, 0], selectable: false },
    { id: 'battery', label: '12 V battery', kind: 'box', pos: [-0.54, 1.41, 0.05], size: [0.58, 0.38, 0.37], color: '#263d58', explode: [0, 0.90, 0.85] },
    { id: 'fuse_box', label: 'Fuse box', kind: 'box', pos: [-0.15, 1.40, 0.17], size: [0.30, 0.20, 0.23], color: '#34383c', explode: [0, 0.83, 1.15] },
    { id: 'air_filter', label: 'Air-filter cover', kind: 'sphere', pos: [-1.04, 1.04, 0.43], size: [0.48, 0.28, 0.12], color: BLACK, explode: [-0.6, 0.26, 0.8] },
    { id: 'oil_dipstick', label: 'Engine-oil dipstick', kind: 'cyl', pos: [-0.90, 0.91, -0.43], size: [0.06, 0.28, 14], color: '#e0a933', explode: [-0.35, 0.25, -0.95] },
  ],
}
