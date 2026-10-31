import * as THREE from 'three';

export interface WaterInput {
  pumpOn: boolean;
  nozzleStep: number;
  speedRpm: number;
}

export interface Water {
  update(dt: number, t: number, s: WaterInput): void;
  dispose(): void;
}

// Model coordinates (metres). Jet runs from the nozzle tip to the runner top.
const JET_FROM = new THREE.Vector3(-0.17, 0.56, 0);
const JET_TO = new THREE.Vector3(0, 0.56, 0);
const RUNNER_C = new THREE.Vector3(0, 0.36, 0);
const RUNNER_R = 0.2;

// Penstock pieces that sit in clear hose.
const HOSE_SEGMENTS: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(-0.7, 0.13, 0), new THREE.Vector3(-0.66, 0.13, 0)],
  [new THREE.Vector3(-0.54, 0.13, 0), new THREE.Vector3(-0.4, 0.13, 0)],
  [new THREE.Vector3(-0.4, 0.13, 0), new THREE.Vector3(-0.4, 0.52, 0)],
];

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalW = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

// Streaks run along the stream, fresnel brightens the edges, alpha stays soft.
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uAlpha;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float s = noise(vec2(vUv.x * 48.0, vUv.y * 4.0 - uTime * uSpeed));
  float f = noise(vec2(vUv.x * 120.0, vUv.y * 18.0 - uTime * uSpeed * 2.3));
  float streak = smoothstep(0.4, 0.95, 0.6 * s + 0.4 * f);
  float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), 2.0);
  // Thin water is clear in the middle and bright at the edges, like a glass rod.
  vec3 body = uColor * (0.75 + 0.25 * streak);
  vec3 col = mix(body, vec3(1.0), clamp(fres * 0.85 + streak * 0.25, 0.0, 1.0));
  float a = uAlpha * (0.32 + 0.68 * fres) * (0.6 + 0.4 * streak);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);

function streamMaterial(color: THREE.ColorRepresentation, alpha: number, speed: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uAlpha: { value: alpha },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// Cylinder from a to b with radius r. Scale.x/z set radius, scale.y the length.
function tubeBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(UNIT_CYLINDER, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.scale.set(r, len, r);
  return m;
}

function dropTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Pool of droplets with gravity. Dead droplets are parked below the floor.
class Spray {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private cursor = 0;
  private readonly count = 1600;

  constructor(scene: THREE.Scene, tex: THREE.Texture) {
    this.pos = new Float32Array(this.count * 3).fill(-10);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 0.022,
      color: 0xe4f4ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p: THREE.Vector3, v: THREE.Vector3) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = rnd(0.5, 1.1);
  }

  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.vel[k + 1] -= 9.8 * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.life[i] <= 0 || this.pos[k + 1] < 0.03) {
        this.life[i] = 0;
        this.pos[k + 1] = -10;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

export function createWater(scene: THREE.Scene): Water {
  const tex = dropTexture();
  const jetMat = streamMaterial(0x9fd8ff, 1.0, 3);
  const coreMat = streamMaterial(0xe8f7ff, 0.9, 5);
  const hoseMat = streamMaterial(0x3a9be8, 0.5, 1.2);

  const jet = tubeBetween(JET_FROM, JET_TO, 0.01, jetMat);
  const core = tubeBetween(JET_FROM, JET_TO, 0.005, coreMat);
  const hoses = HOSE_SEGMENTS.map(([a, b]) => tubeBetween(a, b, 0.021, hoseMat));
  scene.add(jet, core, ...hoses);

  // Water collecting in the casing floor
  const poolMat = new THREE.MeshPhysicalMaterial({
    color: 0x2f7fc1,
    roughness: 0.04,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    clearcoat: 1,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.17), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.075, 0.008);
  scene.add(pool);

  const spray = new Spray(scene, tex);
  let impactAcc = 0;
  let exitAcc = 0;
  let poolOpacity = 0;

  return {
    update(dt, t, s) {
      for (const m of [jetMat, coreMat, hoseMat]) m.uniforms.uTime.value = t;
      const k = s.nozzleStep / 8;
      const flowing = s.pumpOn && k > 0;

      // Jet radius follows the opening; area scales with the opening.
      const r = 0.004 + 0.007 * Math.sqrt(k);
      jet.visible = core.visible = flowing;
      jet.scale.set(r, jet.scale.y, r);
      core.scale.set(r * 0.5, core.scale.y, r * 0.5);

      for (const h of hoses) h.visible = s.pumpOn;

      poolOpacity += ((s.pumpOn ? 0.72 : 0) - poolOpacity) * Math.min(1, dt * 1.5);
      poolMat.opacity = poolOpacity;
      pool.visible = poolOpacity > 0.01;

      if (flowing) {
        // Splash where the jet hits the runner top
        impactAcc += 700 * k * dt;
        while (impactAcc >= 1) {
          impactAcc -= 1;
          spray.emit(
            new THREE.Vector3(JET_TO.x, JET_TO.y, rnd(-0.03, 0.03)),
            new THREE.Vector3(rnd(-0.6, -0.1), rnd(0.5, 1.4), rnd(-0.5, 0.5)),
          );
        }
      }

      if (s.pumpOn && s.speedRpm > 0) {
        // Water leaving the buckets at the bottom of the runner
        const w = Math.min((2 * Math.PI * s.speedRpm) / 60, 30);
        exitAcc += 260 * (w / 30) * dt;
        while (exitAcc >= 1) {
          exitAcc -= 1;
          const a = -Math.PI / 2 + rnd(-0.4, 0.4);
          const p = new THREE.Vector3(
            RUNNER_C.x + RUNNER_R * Math.cos(a),
            RUNNER_C.y + RUNNER_R * Math.sin(a),
            rnd(-0.03, 0.03),
          );
          const speed = w * RUNNER_R * 0.35;
          spray.emit(
            p,
            new THREE.Vector3(-Math.sin(a) * speed, Math.cos(a) * speed * 0.5, rnd(-0.2, 0.2)),
          );
        }
      }

      spray.update(dt);
    },
    dispose() {
      spray.dispose();
      tex.dispose();
      for (const m of [jetMat, coreMat, hoseMat, poolMat]) m.dispose();
      for (const o of [jet, core, pool, ...hoses]) {
        scene.remove(o);
      }
    },
  };
}
