import * as THREE from 'three';
import type { RigState } from './content';
import type { Vec3 } from './views';

// Explode direction per named node in the GLB, scaled by the explode slider.
const EXPLODE: Record<string, Vec3> = {
  base: [0, -0.25, 0],
  pump: [-0.5, 0, 0.5],
  penstock: [0, 0.05, 0.5],
  venturi: [-0.2, 0.25, 0.45],
  gauge_p1: [-0.4, 0.1, 0.5],
  gauge_p2: [-0.4, 0.25, 0.5],
  gauge_p3: [-0.4, -0.05, 0.5],
  nozzle: [-0.3, 0.35, 0.1],
  spear: [-0.45, 0.45, 0.25],
  runner: [0, 0, 0.2],
  casing: [0, 0.1, 0.4],
  shaft: [0, 0, 0.05],
  brake_drum: [0, 0, -0.4],
  rope: [0, 0, -0.4],
  deadweights: [0, -0.2, -0.4],
  spring: [0, 0.4, -0.4],
  tacho: [0.3, 0.1, -0.4],
  frame: [0, 0.1, -0.5],
};

// Label points where the bounding-box centre is a poor place for the badge.
const LABEL_ANCHOR: Record<string, Vec3> = {
  casing: [0.15, 0.6, 0.11],
  runner: [0.12, 0.14, 0.12],
};

const SPEAR_STROKE = 0.06; // m, spear travel from closed to fully open
const WEIGHT_KG_PER_DISC = 4;
const DISC_COUNT = 10;

export interface RigPart {
  id: string;
  node: THREE.Object3D;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  anchor: THREE.Vector3;
  materials: THREE.MeshStandardMaterial[];
}

export interface RigHandles {
  parts: RigPart[];
  byId: Map<string, RigPart>;
  rotors: THREE.Object3D[];
  needles: Record<'p1' | 'p2' | 'pp' | 'spring', THREE.Object3D | undefined>;
  weights: THREE.Object3D[];
  spearBaseX: number;
  angle: number;
}

// Wire up the named nodes of the loaded GLB. Materials are cloned per mesh so highlights stay local.
export function buildRig(root: THREE.Object3D): RigHandles {
  root.updateMatrixWorld(true);
  const parts: RigPart[] = [];
  const byId = new Map<string, RigPart>();

  for (const id of Object.keys(EXPLODE)) {
    const node = root.getObjectByName(id);
    if (!node) continue;
    const materials: THREE.MeshStandardMaterial[] = [];
    node.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const m = (o.material as THREE.MeshStandardMaterial).clone();
      // Clear parts must not hide the water behind them, and must not take on the page behind the canvas.
      if (m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0) {
        m.depthWrite = false;
        m.onBeforeCompile = (shader) => {
          // Fully opaque output. The transmission pass still shows the rig's parts behind the glass.
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            'gl_FragColor = vec4( outgoingLight, 1.0 );',
          );
        };
      }
      o.material = m;
      materials.push(m);
    });
    const origin = node.position.clone();
    const anchor = LABEL_ANCHOR[id]
      ? new THREE.Vector3(...LABEL_ANCHOR[id])
      : new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()).sub(origin);
    const part: RigPart = {
      id,
      node,
      origin,
      dir: new THREE.Vector3(...EXPLODE[id]),
      anchor,
      materials,
    };
    parts.push(part);
    byId.set(id, part);
  }

  const find = (name: string) => root.getObjectByName(name);
  const weights: THREE.Object3D[] = [];
  for (let i = 0; i < DISC_COUNT; i++) {
    const w = find(`weight_${i}`);
    if (w) weights.push(w);
  }

  return {
    parts,
    byId,
    rotors: ['runner', 'shaft', 'brake_drum'].map(find).filter((o): o is THREE.Object3D => !!o),
    needles: {
      p1: find('needle_p1'),
      p2: find('needle_p2'),
      pp: find('needle_p3'),
      spring: find('needle_spring'),
    },
    weights,
    spearBaseX: byId.get('spear')?.origin.x ?? 0,
    angle: 0,
  };
}

const deg = (v: number) => (v * Math.PI) / 180;

// Needle sweeps 270 degrees from lower left (zero) to lower right (full scale).
const pointAt = (value: number, full: number) => deg(135 - (270 * value) / full);

export function updateRig(h: RigHandles, s: RigState, dt: number) {
  const spear = h.byId.get('spear');
  if (spear) spear.origin.x = h.spearBaseX - SPEAR_STROKE * (s.nozzleStep / 8);

  // Visual spin is capped so high rpm does not alias.
  h.angle += Math.min((2 * Math.PI * s.speedRpm) / 60, 30) * dt;
  for (const r of h.rotors) r.rotation.z = h.angle;

  if (h.needles.p1) h.needles.p1.rotation.z = pointAt(s.p1, 7);
  if (h.needles.p2) h.needles.p2.rotation.z = pointAt(s.p2, 7);
  if (h.needles.pp) h.needles.pp.rotation.z = pointAt(s.pp, 7);
  if (h.needles.spring) h.needles.spring.rotation.z = pointAt(s.springKg, 40);

  h.weights.forEach((w, i) => {
    w.visible = s.deadWeightKg > i * WEIGHT_KG_PER_DISC;
  });
}

export function applyExplode(h: RigHandles, e: number) {
  for (const p of h.parts) p.node.position.copy(p.origin).addScaledVector(p.dir, e);
}

// Yellow = current step parts, blue = selected part.
// Highlighted parts glow amber and pulse with time `t` (seconds), selected parts glow blue. The glow is strong because the
// rig is pale and a faint tint is not seen.
export function setHighlight(h: RigHandles, stepIds: Set<string>, selected: string | null, t = 0) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  for (const p of h.parts) {
    const isSelected = p.id === selected;
    const isStep = stepIds.has(p.id);
    const color = isSelected ? 0x3b82f6 : isStep ? 0xff9500 : 0x000000;
    const intensity = isSelected ? 0.75 + 0.2 * pulse : isStep ? 0.8 + 0.5 * pulse : 0;
    for (const m of p.materials) {
      m.emissive.setHex(color);
      m.emissiveIntensity = intensity;
    }
  }
}
