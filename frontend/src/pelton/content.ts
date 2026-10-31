export interface ComponentInfo {
  id: string;
  label: string;
  description: string;
  specs: string[];
}

export interface ProcedureStep {
  step: number;
  text: string;
  highlight: string[];
  setup?: { pumpOn?: boolean };
}

export const PELTON_WHEEL = {
  id: 'pelton-wheel',
  title: 'Performance characteristics of a Pelton turbine',
  aim: 'To study the performance characteristics of a Pelton turbine.',
  apparatus: [
    'Pelton wheel turbine',
    'Nozzle and spear arrangement',
    'Pressure gauges (3 nos., range 0 to 7 kg/cm2)',
  ],
  theory:
    'The Pelton wheel is an impulse turbine. A nozzle converts high head into a jet. The jet strikes the double-cup buckets on the runner and turns the shaft. The spear varies nozzle opening between 1/8 and 8/8.',
  constants: {
    hangerKg: 1,
    drumDiameterM: 0.4,
    ropeDiameterM: 0.015,
    effectiveDiameterM: 0.415,
  },
  components: [
    {
      id: 'base',
      label: 'Base frame and sump',
      description: 'Carries all units. Sump under the pump holds the water supply.',
      specs: ['Single rigid frame'],
    },
    {
      id: 'pump',
      label: 'Centrifugal pump',
      description: 'Pushes water into the penstock at high pressure.',
      specs: ['Started in step 2 (priming)'],
    },
    {
      id: 'penstock',
      label: 'Penstock pipe',
      description: 'Carries pressurised water from the pump to the nozzle inlet.',
      specs: ['Feeds venturimeter and nozzle'],
    },
    {
      id: 'venturi',
      label: 'Venturimeter with manometer',
      description: 'Throat restriction. Pressure difference P2 - P1 gives head H.',
      specs: ['P = P2 - P1 (kg/cm2)', 'H = P x 10 (m)', 'Qact = 0.0055 x sqrt(H) (m3/s)'],
    },
    {
      id: 'gauge_p1',
      label: 'Pressure gauge P1 (venturi throat)',
      description: 'Reads pressure at the venturi throat.',
      specs: ['Range 0 to 7 kg/cm2'],
    },
    {
      id: 'gauge_p2',
      label: 'Pressure gauge P2 (venturi inlet)',
      description: 'Reads upstream pressure at the venturi.',
      specs: ['Range 0 to 7 kg/cm2'],
    },
    {
      id: 'gauge_p3',
      label: 'Pressure gauge Pp (penstock)',
      description: 'Reads penstock pressure. Gives penstock head Hp and turbine inlet head Hi.',
      specs: ['Hp = Pp x 10 (m)', 'Range 0 to 7 kg/cm2'],
    },
    {
      id: 'frame',
      label: 'Support frame and gauge board',
      description: 'Chrome rods carry the spring balance and the brake rope. Board holds the gauges.',
      specs: ['Two chrome rods', 'Top and mid bars'],
    },
    {
      id: 'nozzle',
      label: 'Nozzle',
      description: 'Turns pressure head into a high velocity jet.',
      specs: ['Velocity coefficient Cv = 0.97'],
    },
    {
      id: 'spear',
      label: 'Spear (needle valve)',
      description: 'Slides in and out of the nozzle orifice to set opening.',
      specs: ['Opening 1/8 to 8/8 in 8 positions'],
    },
    {
      id: 'runner',
      label: 'Pelton runner',
      description: 'Double-cup buckets on the rim. The jet impulse turns the runner.',
      specs: ['Pitch diameter 420 mm'],
    },
    {
      id: 'casing',
      label: 'Turbine casing',
      description: 'Encloses the runner and collects spent water. Shown transparent.',
      specs: [],
    },
    {
      id: 'shaft',
      label: 'Shaft',
      description: 'Carries torque from the runner to the brake drum.',
      specs: [],
    },
    {
      id: 'brake_drum',
      label: 'Brake drum (400 mm)',
      description: 'Rope wraps the drum. Effective diameter with rope is 415 mm.',
      specs: ['Drum 400 mm', 'Effective D = 415 mm'],
    },
    {
      id: 'rope',
      label: 'Brake rope (15 mm)',
      description: 'Connects drum to the hanger (dead weights) and the spring balance.',
      specs: ['Rope diameter 15 mm'],
    },
    {
      id: 'deadweights',
      label: 'Dead weights and hanger',
      description: 'Dead weights T1 hang on the hanger. Hanger T0 = 1 kg is fixed.',
      specs: ['T1 = dead weights (kg)', 'T0 = 1 kg hanger'],
    },
    {
      id: 'spring',
      label: 'Spring balance (T2)',
      description: 'Reads the opposing tension T2. Net load T = T1 + T0 - T2.',
      specs: ['Net load T = T1 + T0 - T2 (kg)'],
    },
    {
      id: 'tacho',
      label: 'Tachometer (N, r.p.m.)',
      description: 'Reads runner speed at the shaft end.',
      specs: ['Speed N in r.p.m.'],
    },
  ] as ComponentInfo[],
  procedure: [
    {
      step: 1,
      text: 'Keep nozzle opening at the required position (1/8 to 8/8).',
      highlight: ['nozzle', 'spear'],
    },
    {
      step: 2,
      text: 'Prime and start the pump.',
      highlight: ['pump', 'penstock'],
      setup: { pumpOn: true },
    },
    {
      step: 3,
      text: 'Allow water to rotate the turbine.',
      highlight: ['runner', 'casing'],
    },
    {
      step: 4,
      text: 'Note the speed of the turbine on the tachometer.',
      highlight: ['tacho'],
    },
    {
      step: 5,
      text: 'Take readings from pressure gauges P1, P2 and Pp.',
      highlight: ['gauge_p1', 'gauge_p2', 'gauge_p3'],
    },
    {
      step: 6,
      text: 'Load the turbine by placing dead weights on the hanger.',
      highlight: ['deadweights', 'rope', 'brake_drum'],
    },
    {
      step: 7,
      text: 'Note the dead weights (T1) and spring balance reading (T2).',
      highlight: ['spring', 'deadweights'],
    },
    {
      step: 8,
      text: 'Note the head level on the venturi manometer.',
      highlight: ['venturi'],
    },
    {
      step: 9,
      text: 'Repeat steps 6 to 8 for different loading conditions and record each row.',
      highlight: ['brake_drum'],
    },
  ] as ProcedureStep[],
};

// ---------------------------------------------------------------------------
// Ported from the Simvaya Pelton lab. Everything below is learning material.
// ---------------------------------------------------------------------------
import type { ViewName } from './views';

export interface RigState {
  pumpOn: boolean;
  nozzleStep: number;
  deadWeightKg: number;
  springKg: number;
  speedRpm: number;
  p1: number;
  p2: number;
  pp: number;
}

export const SUBTITLE = 'Experiment 08 · Impulse turbine';

export const OBJECTIVES = [
  'Measure brake power, input power and efficiency of a Pelton turbine.',
  'Plot efficiency and discharge against brake power.',
  'Find the load at which the turbine gives its best efficiency.',
];

export const PRINCIPLE = [
  'The Pelton wheel is an impulse turbine. A nozzle turns the pressure head of the water into a high-velocity jet. The jet strikes double-cup buckets on the runner at atmospheric pressure and gives up its momentum. The runner turns the shaft, and a brake drum loads it.',
  'The spear moves in and out of the nozzle orifice to vary the opening from 1/8 to 8/8. A venturimeter measures discharge from the pressure difference across its throat.',
];

export const EQUATIONS: { label: string; expr: string; note: string }[] = [
  { label: 'Venturi differential', expr: 'P = P2 − P1', note: 'kg/cm²' },
  { label: 'Venturi head', expr: 'H = P / W', note: 'W = 1000 kg/m³, so H = 10 × P in metres' },
  { label: 'Actual discharge', expr: 'Qact = 0.0055 √H', note: 'm³/s, with H in metres' },
  { label: 'Head at penstock', expr: 'Hp = Pp / W', note: 'm' },
  { label: 'Head at turbine inlet', expr: 'Hi = Pi / W', note: 'm, here Pi = Pp' },
  { label: 'Net load', expr: 'T = T1 + T0 − T2', note: 'T0 = 1 kg hanger, T1 dead weights, T2 spring balance' },
  { label: 'Brake torque', expr: 'τ = T × g × D / 2', note: 'D = 0.415 m, drum with rope' },
  { label: 'Brake horsepower', expr: 'BHP = 2π N τ / 60', note: 'N in rpm, result in W, shown in kW' },
  { label: 'Input power', expr: 'IHP = ρ g Qact Hi', note: 'ρ = 1000 kg/m³' },
  { label: 'Efficiency', expr: 'η = BHP / IHP × 100', note: '%' },
];

export const READING_RESULTS =
  'At a fixed nozzle opening the discharge and the input power are constant, so efficiency rises in proportion to brake power. The brake power itself peaks at about half the stall load, where the efficiency is highest. The load graphs in the Calculate tab show this turn-over.';

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export const PRETEST: QuizQuestion[] = [
  {
    q: 'A Pelton wheel is which type of turbine?',
    options: ['Reaction turbine', 'Impulse turbine', 'Propeller turbine', 'Kaplan turbine'],
    answer: 1,
    why: 'The jet hits the buckets at atmospheric pressure. All the head is turned into velocity in the nozzle.',
  },
  {
    q: 'In the nozzle of a Pelton turbine, pressure head is converted into:',
    options: ['Torque', 'Jet kinetic energy', 'Heat', 'Shaft speed'],
    answer: 1,
    why: 'The nozzle makes a high-velocity jet. Its velocity is Cv x sqrt(2gH).',
  },
  {
    q: 'Brake horsepower is the power at the shaft. It is found from:',
    options: ['Torque x angular speed', 'rho g Q H', 'Head x area', 'Pressure x time'],
    answer: 0,
    why: 'BHP = 2 pi N tau / 60, where tau is the brake torque.',
  },
  {
    q: 'The net load on the brake is T = T1 + T0 - T2. What does T2 represent?',
    options: ['Dead weights', 'Hanger weight', 'Spring balance reading', 'Torque'],
    answer: 2,
    why: 'T2 is the tension read on the spring balance.',
  },
  {
    q: 'The efficiency of the turbine is eta =',
    options: ['BHP / IHP x 100', 'IHP / BHP x 100', 'Q / H', 'H / Q'],
    answer: 0,
    why: 'Efficiency is the brake power divided by the input (water) power.',
  },
];

export const POSTTEST: QuizQuestion[] = [
  {
    q: 'The venturi discharge at head H (m) is approximately:',
    options: ['Q = 0.0055 sqrt(H) m3/s', 'Q = 0.0055 H m3/s', 'Q = 0.0055 H^2 m3/s', 'Q = 0.0055 / sqrt(H) m3/s'],
    answer: 0,
    why: 'Manual relation: Qact = 0.0055 sqrt(H), with H in metres.',
  },
  {
    q: 'At a fixed nozzle opening, why does efficiency against BHP look like a straight line?',
    options: ['Torque is constant', 'Input power IHP is constant', 'Speed is constant', 'Head is zero'],
    answer: 1,
    why: 'eta = BHP / IHP. With flow and head fixed, IHP is fixed, so eta is proportional to BHP.',
  },
  {
    q: 'Opening the nozzle from 1/8 to 8/8 at a fixed head mainly increases:',
    options: ['Head', 'Discharge Qact', 'Venturi throat pressure', 'Dead weight'],
    answer: 1,
    why: 'A larger opening lets more water through, so the discharge rises.',
  },
  {
    q: 'The efficiency peak of a Pelton turbine occurs at a load that is about:',
    options: ['A tenth of stall load', 'Half of stall load', 'Equal to stall load', 'Zero load'],
    answer: 1,
    why: 'With a linear speed-torque droop, brake power is highest at half stall, where the efficiency peaks.',
  },
  {
    q: 'In this rig, the head at turbine inlet Hi = Pi / W is taken from:',
    options: ['A fourth gauge', 'The penstock gauge Pp', 'A zero reading', 'The throat gauge P1'],
    answer: 1,
    why: 'The rig has one inlet gauge, so Pi is taken as Pp.',
  },
];

// Camera view for each procedure step (index = step - 1).
export const STEP_VIEW: ViewName[] = ['nozzle', 'front', 'front', 'brake', 'gauges', 'brake', 'brake', 'venturi', 'iso'];

export const VIEW_LABEL: Record<ViewName, string> = {
  iso: 'Iso',
  front: 'Front',
  side: 'Side',
  top: 'Top',
  nozzle: 'Nozzle',
  gauges: 'Gauges',
  brake: 'Brake',
  venturi: 'Venturi',
};

// Steps the rig state can confirm by itself. The rest are ticked by hand.
export function autoDone(index: number, s: RigState, rowCount: number): boolean {
  switch (index) {
    case 1: return s.pumpOn;
    case 2: return s.speedRpm > 0;
    case 4: return s.pumpOn;
    case 5:
    case 6: return s.deadWeightKg > 0;
    case 7: return s.pumpOn;
    case 8: return rowCount >= 3;
    default: return false;
  }
}

// Extra names a student may type for each part in a highlight question.
export const PART_ALIASES: Record<string, string[]> = {
  base: ['base', 'base frame', 'sump'],
  pump: ['pump', 'centrifugal pump'],
  penstock: ['penstock', 'penstock pipe', 'pipe'],
  venturi: ['venturi', 'venturimeter', 'venturi meter', 'manometer'],
  gauge_p1: ['gauge p1', 'p1 gauge', 'p1', 'throat gauge'],
  gauge_p2: ['gauge p2', 'p2 gauge', 'p2', 'inlet gauge'],
  gauge_p3: ['gauge p3', 'p3 gauge', 'p3', 'penstock gauge'],
  frame: ['support frame', 'gauge board', 'chrome rods', 'rods'],
  nozzle: ['nozzle', 'jet nozzle'],
  spear: ['spear', 'needle valve', 'spear valve'],
  runner: ['runner', 'pelton runner', 'wheel', 'buckets', 'bucket'],
  casing: ['casing', 'turbine casing', 'housing'],
  shaft: ['shaft'],
  brake_drum: ['brake drum', 'drum', 'brake'],
  rope: ['rope', 'brake rope', 'wire rope'],
  deadweights: ['dead weights', 'dead weight', 'deadweights', 'hanger', 'weights'],
  spring: ['spring', 'spring balance'],
  tacho: ['tacho', 'tachometer', 'speed meter', 'rev counter'],
};
