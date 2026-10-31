// Simplified rig model. Constants give plausible numbers, not calibrated to a real rig.

export const G = 9.81;
export const RHO = 1000;
export const CV = 0.97; // nozzle velocity coefficient
export const VENTURI_K = 0.0055; // manual: Qact = 0.0055 * sqrt(H)
export const KG_CM2_TO_M = 10; // 1 kg/cm2 = 10 m of water
export const PUMP_PRESSURE = 3; // kg/cm2 at penstock gauge (simulated)
export const HANGER_KG = 1; // T0, fixed hanger weight
export const BRAKE_DIAMETER = 0.415; // m, drum 400 mm + rope 15 mm
export const RUNNER_DIAMETER = 0.42; // m, pitch circle
export const FREE_RUN_RATIO = 0.9; // runner free-run speed / jet velocity
export const HYDRAULIC_EFF = 0.9;
// Full-opening jet flow: venturi head of 2 m (dP = 0.2 kg/cm2).
export const Q_MAX = VENTURI_K * Math.sqrt(2);

const DEFLECTION = 1 - Math.cos((165 * Math.PI) / 180); // buckets turn jet ~165 deg
const BRAKE_RADIUS = BRAKE_DIAMETER / 2;

export interface SimInput {
  pumpOn: boolean;
  nozzleStep: number; // 1..8 = opening 1/8..8/8
  deadWeightKg: number; // T1
  springKg: number; // T2
}

export interface Readings {
  p1: number; // venturi throat gauge, kg/cm2
  p2: number; // venturi inlet gauge, kg/cm2
  pp: number; // penstock gauge, kg/cm2
  speedRpm: number;
  springKg: number;
}

export interface CalcInput {
  deadWeightKg: number;
  springKg: number;
  p1: number;
  p2: number;
  pp: number;
  speedRpm: number;
}

export interface CalcStep {
  key: string;
  label: string;
  formula: string;
  substituted: string;
  value: number;
  unit: string;
}

export interface CalcResult {
  dpKgCm2: number; // P = P2 - P1
  headVenturiM: number; // H
  qActM3s: number; // Qact
  headPenstockM: number; // Hp = Pp / W
  headInletM: number; // Hi
  netLoadKg: number; // T = T1 + T0 - T2
  torqueNm: number;
  bhpKw: number;
  ipKw: number; // input power, IHP
  etaPct: number;
  steps: CalcStep[];
}

export const netLoadKg = (deadWeightKg: number, springKg: number) =>
  deadWeightKg + HANGER_KG - springKg;

const jetVelocity = () => CV * Math.sqrt(2 * G * PUMP_PRESSURE * KG_CM2_TO_M);

function stallTorque(nozzleStep: number) {
  const q = Q_MAX * (nozzleStep / 8);
  return RHO * q * jetVelocity() * (RUNNER_DIAMETER / 2) * DEFLECTION * HYDRAULIC_EFF;
}

// Net load (kg) at which the turbine stops for a given nozzle opening.
export const stallLoadKg = (nozzleStep: number) => stallTorque(nozzleStep) / (G * BRAKE_RADIUS);

export function simulate(input: SimInput): Readings {
  if (!input.pumpOn) {
    return { p1: 0, p2: 0, pp: 0, speedRpm: 0, springKg: input.springKg };
  }

  const q = Q_MAX * (input.nozzleStep / 8);
  const dp = (q / VENTURI_K) ** 2 / KG_CM2_TO_M; // kg/cm2 across venturi
  const freeRunRpm = (60 * FREE_RUN_RATIO * jetVelocity()) / (Math.PI * RUNNER_DIAMETER);
  const tauStall = stallTorque(input.nozzleStep);
  const tauBrake = Math.max(0, netLoadKg(input.deadWeightKg, input.springKg)) * G * BRAKE_RADIUS;
  const speedRpm = tauBrake >= tauStall ? 0 : freeRunRpm * (1 - tauBrake / tauStall);

  return {
    p1: round(PUMP_PRESSURE - dp, 3),
    p2: PUMP_PRESSURE,
    pp: PUMP_PRESSURE,
    speedRpm: Math.round(speedRpm),
    springKg: input.springKg,
  };
}

export function calculate(input: CalcInput): CalcResult {
  const steps: CalcStep[] = [];
  const add = (
    key: string,
    label: string,
    formula: string,
    substituted: string,
    value: number,
    unit: string,
  ) => {
    steps.push({ key, label, formula, substituted, value, unit });
    return value;
  };

  const dp = add(
    'dp',
    'Venturi differential',
    'P = P2 - P1',
    `${input.p2.toFixed(3)} - ${input.p1.toFixed(3)} = ${Math.max(0, input.p2 - input.p1).toFixed(3)}`,
    Math.max(0, input.p2 - input.p1),
    'kg/cm2',
  );
  const hv = add(
    'hv',
    'Venturi head',
    'H = P / W',
    `${dp.toFixed(3)} x 10 = ${(dp * KG_CM2_TO_M).toFixed(2)}`,
    dp * KG_CM2_TO_M,
    'm',
  );
  const q = add(
    'q',
    'Actual discharge',
    'Qact = 0.0055 x sqrt(H)',
    `0.0055 x sqrt(${hv.toFixed(2)}) = ${(VENTURI_K * Math.sqrt(hv)).toFixed(5)}`,
    VENTURI_K * Math.sqrt(hv),
    'm3/s',
  );
  const hp = add(
    'hp',
    'Head at penstock',
    'Hp = Pp / W',
    `${input.pp.toFixed(3)} x 10 = ${(input.pp * KG_CM2_TO_M).toFixed(2)}`,
    input.pp * KG_CM2_TO_M,
    'm',
  );
  const hi = add(
    'hi',
    'Head at turbine inlet',
    'Hi = Pi / W, Pi = Pp (one inlet gauge)',
    `${input.pp.toFixed(3)} x 10 = ${(input.pp * KG_CM2_TO_M).toFixed(2)}`,
    input.pp * KG_CM2_TO_M,
    'm',
  );
  const net = add(
    'net',
    'Result load',
    'T = T1 + T0 - T2',
    `${input.deadWeightKg.toFixed(2)} + ${HANGER_KG} - ${input.springKg.toFixed(2)} = ${netLoadKg(input.deadWeightKg, input.springKg).toFixed(2)}`,
    netLoadKg(input.deadWeightKg, input.springKg),
    'kg',
  );
  const torque = add(
    'torque',
    'Brake torque',
    'tau = T x g x D/2',
    `${Math.max(0, net).toFixed(2)} x 9.81 x ${BRAKE_RADIUS} = ${(Math.max(0, net) * G * BRAKE_RADIUS).toFixed(2)}`,
    Math.max(0, net) * G * BRAKE_RADIUS,
    'N m',
  );
  const omega = add(
    'omega',
    'Angular speed',
    'omega = 2 pi N / 60',
    `2 pi x ${input.speedRpm} / 60 = ${((2 * Math.PI * input.speedRpm) / 60).toFixed(2)}`,
    (2 * Math.PI * input.speedRpm) / 60,
    'rad/s',
  );
  const bhp = add(
    'bhp',
    'Brake horsepower',
    'BHP = tau x omega',
    `${torque.toFixed(2)} x ${omega.toFixed(2)} / 1000 = ${((torque * omega) / 1000).toFixed(3)}`,
    (torque * omega) / 1000,
    'kW',
  );
  const ip = add(
    'ip',
    'Input horsepower',
    'IHP = rho x g x Qact x Hi',
    `1000 x 9.81 x ${q.toFixed(5)} x ${hi.toFixed(2)} / 1000 = ${((RHO * G * q * hi) / 1000).toFixed(3)}`,
    (RHO * G * q * hi) / 1000,
    'kW',
  );
  const eta = add(
    'eta',
    'Efficiency',
    'eta = BHP / IHP x 100',
    ip > 0 ? `${bhp.toFixed(3)} / ${ip.toFixed(3)} x 100 = ${((bhp / ip) * 100).toFixed(1)}` : 'IHP = 0, eta = 0',
    ip > 0 ? (bhp / ip) * 100 : 0,
    '%',
  );

  return {
    dpKgCm2: round(dp, 3),
    headVenturiM: round(hv, 3),
    qActM3s: round(q, 6),
    headPenstockM: round(hp, 2),
    headInletM: round(hi, 2),
    netLoadKg: round(net, 2),
    torqueNm: round(torque, 2),
    bhpKw: round(bhp, 3),
    ipKw: round(ip, 3),
    etaPct: round(eta, 1),
    steps,
  };
}

// Full load sweep at one nozzle opening, from light load up to 97% of stall.
export function sweep(nozzleStep: number, points: number) {
  const stall = stallLoadKg(nozzleStep);
  const rows = [];
  for (let i = 1; i <= points; i++) {
    const net = (stall * 0.97 * i) / points;
    const deadWeightKg = net >= 1 ? net - 1 : 0;
    const springKg = net >= 1 ? 0 : 1 - net;
    const r = simulate({ pumpOn: true, nozzleStep, deadWeightKg, springKg });
    rows.push({
      deadWeightKg: round(deadWeightKg, 3),
      springKg: round(springKg, 3),
      p1: r.p1,
      p2: r.p2,
      pp: r.pp,
      speedRpm: r.speedRpm,
      ...calculate({ deadWeightKg, springKg, p1: r.p1, p2: r.p2, pp: r.pp, speedRpm: r.speedRpm }),
    });
  }
  return rows;
}

function round(value: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
