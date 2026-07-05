// ============================================================
// 竹筒饭 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：竹筒架在火上烤。火力(heat)会自然衰减，点击"添柴"升火。温度(temp)
// 缓慢趋向当前火力。温度落在"最佳区间"内时米饭持续变熟(cookedness↑)；
// 温度过高则焦度(burn)上升。每隔一会儿要"翻面"让受热均匀，否则同一面
// 焦度累积更快。熟度攒满且没烤糊即成功。
//
// 关键手感：像走钢丝——添柴太猛会过热烤焦，太保守又熟得慢。

export interface CookState {
  /** 火力 0..100（添柴瞬间抬升，随时间衰减） */
  heat: number;
  /** 竹筒温度 0..100（趋向 heat） */
  temp: number;
  /** 熟度 0..100（在最佳区间内累积） */
  cookedness: number;
  /** 焦度 0..100（过热累积；满则失败态“糊了”） */
  burn: number;
  /** 当前朝下受热的面（0/1），翻面切换 */
  side: 0 | 1;
  /** 当前面的受热暴露度 0..1（久不翻面升高→更易焦） */
  exposure: number;
  finished: boolean;
  burnt: boolean;
}

// 最佳温度区间
export const BEST_LOW = 55;
export const BEST_HIGH = 78;
export const OVERHEAT = 88; // 超过此温度开始累积焦度

export const HEAT_DECAY = 9; // 火力每秒自然衰减
export const ADD_WOOD = 26; // 添柴一次升火
export const TEMP_LERP = 1.8; // 温度趋向火力的速率
export const COOK_RATE = 20; // 最佳区间内每秒熟度
export const BURN_RATE = 16; // 过热每秒焦度
export const EXPOSURE_RISE = 0.14; // 不翻面时暴露度每秒上升
export const MAX_HEAT = 100;

export function createCook(): CookState {
  return {
    heat: 40,
    temp: 40,
    cookedness: 0,
    burn: 0,
    side: 0,
    exposure: 0,
    finished: false,
    burnt: false,
  };
}

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** 添柴：抬升火力（封顶 100） */
export function addWood(state: CookState): CookState {
  if (state.finished || state.burnt) return state;
  return { ...state, heat: clamp01to100(state.heat + ADD_WOOD) };
}

/** 翻面：切换受热面并重置暴露度（让受热均匀、降低焦risk） */
export function flip(state: CookState): CookState {
  if (state.finished || state.burnt) return state;
  return { ...state, side: state.side === 0 ? 1 : 0, exposure: 0 };
}

/** 温度是否在最佳区间 */
export function inBestZone(temp: number): boolean {
  return temp >= BEST_LOW && temp <= BEST_HIGH;
}

export type CookAdvice = 'add-wood' | 'hold' | 'flip' | 'cool' | 'ready' | 'burnt';

/** 当前最合理的玩家动作，用于 HUD 和按钮高亮。 */
export function cookAdvice(state: CookState): CookAdvice {
  if (state.burnt) return 'burnt';
  if (state.finished) return 'ready';
  if (state.temp >= OVERHEAT - 3 || state.heat > OVERHEAT || state.burn > 35) return 'cool';
  if (state.exposure >= 0.72) return 'flip';
  if (state.temp < BEST_LOW && state.heat < BEST_HIGH) return 'add-wood';
  if (state.temp > BEST_HIGH) return 'cool';
  return 'hold';
}

/**
 * 时间推进。纯函数返回新状态。
 * - 火力自然衰减；温度趋向火力
 * - 最佳区间→熟度增长；过热→焦度增长（久不翻面加剧）
 * - 熟度满且未糊→成功；焦度满→烤糊(失败态，但可继续/重开由容器决定)
 */
export function tickCook(state: CookState, dt: number): CookState {
  if (state.finished || state.burnt) return state;

  const heat = clamp01to100(state.heat - HEAT_DECAY * dt);
  const temp = clamp01to100(state.temp + (heat - state.temp) * Math.min(1, TEMP_LERP * dt));
  const exposure = Math.min(1, state.exposure + EXPOSURE_RISE * dt);

  let cookedness = state.cookedness;
  let burn = state.burn;

  if (inBestZone(temp)) {
    cookedness = clamp01to100(cookedness + COOK_RATE * dt);
  }
  if (temp > OVERHEAT) {
    // 久不翻面(暴露度高)焦得更快
    burn = clamp01to100(burn + BURN_RATE * (0.6 + exposure) * dt);
  }

  const finished = cookedness >= 100 && burn < 100;
  const burnt = burn >= 100;

  return { ...state, heat, temp, exposure, cookedness, burn, finished, burnt };
}

export function isCooked(state: CookState): boolean {
  return state.finished;
}

/** 熟度进度 0..1 */
export function cookProgress(state: CookState): number {
  return state.cookedness / 100;
}
