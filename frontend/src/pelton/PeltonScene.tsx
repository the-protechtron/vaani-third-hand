
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ComponentInfo, RigState } from './content';
import { applyExplode, buildRig, setHighlight, updateRig, type RigHandles } from './rig-model';
import { createWater, type Water } from './water';
import { VIEWS, type ViewName } from './views';

const MODEL_URL = '/models/pelton-turbine.glb';

interface Props {
  components: ComponentInfo[];
  state: RigState;
  highlight: string[];
  selected: string | null;
  explode: number;
  showLabels: boolean;
  view: { name: ViewName; nonce: number };
  /** fly the camera to one part (the tutor pointing at it) */
  focus?: { id: string; nonce: number } | null;
  /** when set, only these parts get a name label */
  labelIds?: string[];
  onSelect: (id: string) => void;
}

export default function PeltonScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<string, HTMLButtonElement>());
  const latest = useRef(props);
  const rig = useRef<RigHandles | null>(null);
  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
  const moving = useRef(true);
  const fitRef = useRef<((name: ViewName) => void) | null>(null);
  const viewRef = useRef<ViewName>(props.view.name);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  latest.current = props;

  // Scene, renderer, model load and loop. Created once per mount.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    // Environment map gives the PBR materials their light. There are no lamps or shadows.
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.3;
    controls.maxDistance = 6;

    // Place the camera so the view's sphere fits the canvas, whatever its aspect ratio.
    const fit = (name: ViewName) => {
      const v = VIEWS[name];
      const aspect = host.clientWidth / Math.max(1, host.clientHeight);
      const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
      const hHalf = Math.atan(Math.tan(vHalf) * aspect);
      const dist = v.radius / Math.sin(Math.min(vHalf, hHalf));
      const focus = new THREE.Vector3(...v.focus);
      goal.current.target.copy(focus);
      goal.current.pos.copy(focus).addScaledVector(new THREE.Vector3(...v.dir).normalize(), dist);
      moving.current = true;
    };
    fitRef.current = fit;
    fit(viewRef.current);
    camera.position.copy(goal.current.pos);
    controls.target.copy(goal.current.target);

    const water: Water = createWater(scene);

    new GLTFLoader()
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        if (disposed) return;
        scene.add(gltf.scene);
        rig.current = buildRig(gltf.scene);
        setStatus('ready');
      })
      .catch((e: Error) => {
        if (disposed) return;
        setLoadError(e.message);
        setStatus('error');
      });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit(viewRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let shown = 0;
    let last = performance.now();
    let elapsed = 0;
    // Click a part on the model to pick it. A drag (orbit) is not a click, so the pointer must barely move.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const canvas = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const start = downAt;
      downAt = null;
      const handles = rig.current;
      if (!start || !handles || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const box = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -(((e.clientY - box.top) / box.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (handles.byId.has(o.name)) {
            latest.current.onSelect(o.name);
            return;
          }
        }
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);

    let frameId = 0;
    let appliedKey = '';
    let litSet = new Set<string>();
    let cleared = false;
    const projected = new THREE.Vector3();

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      const p = latest.current;
      const handles = rig.current;
      if (handles) {
        const key = `${p.highlight.join(',')}|${p.selected ?? ''}`;
        if (key !== appliedKey) {
          appliedKey = key;
          litSet = new Set(p.highlight);
        }
        // Glowing parts pulse, so they are redrawn every frame. With nothing lit, the glow is cleared once.
        if (litSet.size > 0 || p.selected) {
          setHighlight(handles, litSet, p.selected, elapsed);
          cleared = false;
        } else if (!cleared) {
          setHighlight(handles, litSet, null, 0);
          cleared = true;
        }
        shown += (p.explode - shown) * Math.min(1, dt * 6);
        updateRig(handles, p.state, dt);
        applyExplode(handles, shown);
      }
      water.update(dt, elapsed, {
        pumpOn: p.state.pumpOn,
        nozzleStep: p.state.nozzleStep,
        speedRpm: p.state.speedRpm,
      });

      // Glide to the preset only while it is moving, so orbit drag is not overridden.
      if (moving.current) {
        const k = Math.min(1, dt * 5);
        camera.position.lerp(goal.current.pos, k);
        controls.target.lerp(goal.current.target, k);
        if (
          camera.position.distanceTo(goal.current.pos) < 1e-3 &&
          controls.target.distanceTo(goal.current.target) < 1e-3
        ) {
          moving.current = false;
        }
      }
      controls.update();
      renderer.render(scene, camera);

      // Pin each label to its part's projected point
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const c of p.components) {
        const el = labelRefs.current.get(c.id);
        const part = handles?.byId.get(c.id);
        if (!el) continue;
        if (!part) {
          el.style.display = 'none';
          continue;
        }
        projected.copy(part.node.position).add(part.anchor).project(camera);
        const onScreen = projected.z < 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1;
        el.style.display = onScreen ? '' : 'none';
        el.style.transform = `translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px)`;
      }
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      fitRef.current = null;
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      observer.disconnect();
      controls.dispose();
      water.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      rig.current = null;
    };
  }, []);

  // Camera flies to a single part when the tutor points at it.
  useEffect(() => {
    const f = props.focus;
    const part = f ? rig.current?.byId.get(f.id) : undefined;
    if (!f || !part) return;
    const at = part.node.getWorldPosition(new THREE.Vector3()).add(part.anchor);
    goal.current.target.copy(at);
    goal.current.pos.copy(at).addScaledVector(new THREE.Vector3(0.45, 0.3, 1).normalize(), 0.6);
    moving.current = true;
  }, [props.focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera moves to the requested view whenever the nonce changes.
  useEffect(() => {
    viewRef.current = props.view.name;
    fitRef.current?.(props.view.name);
  }, [props.view.nonce, props.view.name]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      {status !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/70">
          {status === 'error' ? `Model failed to load: ${loadError}` : 'Loading 3D model...'}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ display: props.showLabels ? 'block' : 'none' }}>
        {props.components.map((c, i) => (props.labelIds && !props.labelIds.includes(c.id) ? null : (
          <button
            key={c.id}
            type="button"
            className={`rig-label${props.selected === c.id ? ' is-selected' : ''}`}
            ref={(el) => {
              if (el) labelRefs.current.set(c.id, el);
              else labelRefs.current.delete(c.id);
            }}
            onClick={() => props.onSelect(c.id)}
          >
            <span className="rig-badge">{i + 1}</span>
            {c.label}
          </button>
        )))}
      </div>
    </div>
  );
}
