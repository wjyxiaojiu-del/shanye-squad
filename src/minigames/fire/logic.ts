// ============================================================
// 原始取火 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：按住拖动放大镜，把阳光焦点对准火绒热点并保持"聚焦"。聚焦质量越高
// 火绒升温越快；松手或没对准就降温。温度攒满 100 即点燃。无失败态。

export interface FireState {
  /** 火绒温度 0..100 */
  temperature: number;
  /** 是否已点燃 */
  ignited: boolean;
}

export const HEAT_RATE = 15; // 满聚焦每秒升温
export const COOL_RATE = 6; // 每秒基础散热
export const HEAT_THRESHOLD = COOL_RATE / HEAT_RATE;

export function createFire(): FireState {
  return { temperature: 0, ignited: false };
}

/**
 * 聚焦质量 0..1 —— 由放大镜与目标热点的水平对准 + 竖直焦距接近度共同决定。
 * 两个维度都要接近才高分（相乘），任一偏离都会明显下降。纯函数。
 */
export function focusQuality(
  lensX: number,
  lensY: number,
  targetX: number,
  idealY: number,
  tolX: number,
  tolY: number,
): number {
  const qx = Math.max(0, 1 - Math.abs(lensX - targetX) / tolX);
  const qy = Math.max(0, 1 - Math.abs(lensY - idealY) / tolY);
  return qx * qy;
}

/**
 * 时间推进：聚焦时净升温、否则降温。返回新状态（纯函数）。
 * quality 为 0..1 的聚焦质量（松手时应传 0）。
 */
export function tickFire(state: FireState, quality: number, dt: number): FireState {
  if (state.ignited) return state;
  const q = Math.max(0, Math.min(1, quality));
  const delta = heatDelta(q, dt);
  let temp = state.temperature + delta;
  if (temp < 0) temp = 0;
  if (temp >= 100) {
    return { temperature: 100, ignited: true };
  }
  return { temperature: temp, ignited: false };
}

export function isIgnited(state: FireState): boolean {
  return state.ignited;
}

/** 进度 0..1 */
export function fireProgress(state: FireState): number {
  return state.temperature / 100;
}

export function heatDelta(quality: number, dt: number): number {
  const q = Math.max(0, Math.min(1, quality));
  return (q * HEAT_RATE - COOL_RATE) * dt;
}

export function isHeating(quality: number): boolean {
  return Math.max(0, Math.min(1, quality)) > HEAT_THRESHOLD;
}

// ---- 钻木取火：手速(像素/秒) → 加热强度 ----
export const DRILL_REF = 900; // 达到此钻速即满强度
export function drillQuality(pixelsPerSecond: number): number {
  return Math.max(0, Math.min(1, pixelsPerSecond / DRILL_REF));
}

// ---- 镁棒取火：火花热随时间衰减，刮一下回补 ----
export const SPARK_DECAY = 1.0; // 每秒衰减（温和保留余热，连续快刮可攒热）
export function decayHeat(heat: number, dt: number): number {
  return Math.max(0, heat - SPARK_DECAY * dt);
}
