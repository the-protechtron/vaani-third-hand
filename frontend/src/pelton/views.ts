export type Vec3 = [number, number, number];

// Camera presets. The camera looks at `focus` from direction `dir`, and the distance is
// chosen so a sphere of `radius` metres around `focus` fits the canvas (any aspect ratio).
export interface ViewSpec {
  dir: Vec3;
  focus: Vec3;
  radius: number;
}

// Rig model in metres (glTF axes: Y up, runner shaft along Z). Full rig centre is about (-0.33, 0.56, -0.19).
export const VIEWS = {
  iso: { dir: [0.7, 0.5, 1], focus: [-0.33, 0.56, -0.19], radius: 1.1 },
  front: { dir: [0, 0.12, 1], focus: [-0.33, 0.56, -0.19], radius: 0.76 },
  side: { dir: [1, 0.1, 0], focus: [-0.33, 0.56, -0.19], radius: 0.8 },
  top: { dir: [0, 1, 0.25], focus: [-0.33, 0.56, -0.19], radius: 1.0 },
  nozzle: { dir: [-0.1, 0.3, 1], focus: [-0.3, 0.56, 0], radius: 0.42 },
  gauges: { dir: [-0.25, 0.15, 1], focus: [-0.42, 0.87, 0], radius: 0.32 },
  brake: { dir: [0.7, 0.35, -1], focus: [0, 0.42, -0.25], radius: 0.6 },
  venturi: { dir: [-0.35, 0.3, 1], focus: [-0.62, 0.3, 0], radius: 0.42 },
} satisfies Record<string, ViewSpec>;

export type ViewName = keyof typeof VIEWS;

export const VIEW_NAMES = Object.keys(VIEWS) as ViewName[];
