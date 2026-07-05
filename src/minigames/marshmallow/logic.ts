// ============================================================
// 烤棉花糖 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：棉花糖串在扦子上，玩家按住"靠近火"把它探向火焰（热度↑）、松手拉远（热度↓）。
// 热度越高烤度(金黄)涨得越快；但热度超过 OVERHEAT 会积累焦化，焦化满 100 → 烤成木炭(失败)。
// 烤到金黄(doneness ≥ GOLDEN_MIN)时"出炉"即成功，越接近理想烤度且焦化越低，表现分越高。

export interface RoastState {
  /** 烤度 / 金黄度 0..100 */
  doneness: number;
  /** 焦化度 0..100，满则烤焦 */
  burn: number;
  /** 是否已出炉 */
  finished: boolean;
  /** 是否已烤焦（硬失败） */
  burnt: boolean;
}

/** 热度超过此值(0..1)开始积累焦化 */
export const OVERHEAT = 0.7;
/** 满热每秒烤度增长 */
export const DONE_RATE = 34;
/** 过热部分每秒焦化增长 */
export const BURN_RATE = 60;
/** 离火时焦化每秒回落（表面稍凉，给容错） */
export const BURN_COOL = 10;
/** 达到"金黄可食"的最低烤度 */
export const GOLDEN_MIN = 60;
/** 理想烤度（表现分峰值） */
export const IDEAL_DONE = 82;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function createRoast(): RoastState {
  return { doneness: 0, burn: 0, finished: false, burnt: false };
}

/**
 * 时间推进（纯函数）。heat 为 0..1 的当前热度（由游戏层按离火距离换算，松手传低值）。
 */
export function tickRoast(state: RoastState, heat: number, dt: number): RoastState {
  if (state.finished || state.burnt) return state;
  const h = clamp01(heat);
  const doneness = Math.min(100, state.doneness + h * DONE_RATE * dt);
  let burn = state.burn;
  if (h > OVERHEAT) burn += (h - OVERHEAT) * BURN_RATE * dt;
  else burn = Math.max(0, burn - BURN_COOL * dt);
  if (burn >= 100) return { doneness, burn: 100, finished: false, burnt: true };
  return { doneness, burn, finished: false, burnt: false };
}

/** 出炉 —— 已烤焦或已出炉则不变 */
export function serveRoast(state: RoastState): RoastState {
  if (state.burnt || state.finished) return state;
  return { ...state, finished: true };
}

export type RoastAdvice = 'move-closer' | 'hold' | 'move-away' | 'serve' | 'done' | 'burnt';

/** 当前最合理的玩家动作。heat 为 0..1，和 tickRoast 使用同一热度定义。 */
export function roastAdvice(state: RoastState, heat: number): RoastAdvice {
  if (state.burnt) return 'burnt';
  if (state.finished) return 'done';
  if (state.doneness >= IDEAL_DONE - 2 && state.burn <= 35) return 'serve';
  if (state.doneness >= GOLDEN_MIN && state.burn > 16) return 'serve';
  if (state.burn > 35 || heat > OVERHEAT + 0.06) return 'move-away';
  if (state.doneness < GOLDEN_MIN && heat < 0.55) return 'move-closer';
  if (state.doneness < IDEAL_DONE && heat < OVERHEAT - 0.08) return 'move-closer';
  return 'hold';
}

export interface RoastResult {
  success: boolean;
  /** 表现分 0..1（喂给 onWin → 评星） */
  perf: number;
  message: string;
}

/** 依据当前状态评定结果（出炉后调用） */
export function roastResult(state: RoastState): RoastResult {
  if (state.burnt) return { success: false, perf: 0, message: '🔥 烤成小木炭了…再来一次！' };
  if (state.doneness < GOLDEN_MIN) {
    return { success: false, perf: 0, message: '还是白白的，再靠火烤久一点～' };
  }
  const fit = clamp01(1 - Math.abs(state.doneness - IDEAL_DONE) / 40);
  const burnPenalty = state.burn / 100;
  const perf = clamp01(fit * (1 - burnPenalty * 0.7));
  const message =
    perf > 0.8
      ? '🍡 外焦里嫩、金黄流心，完美！'
      : perf > 0.5
        ? '🍡 烤得挺香，不错！'
        : '🍡 能吃，但火候还能更准';
  return { success: true, perf, message };
}
