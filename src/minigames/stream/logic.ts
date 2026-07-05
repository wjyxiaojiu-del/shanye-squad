// ============================================================
// 溯溪探险 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法（时机判断型）：玩家从左岸要跳过 5 块石头到达右岸终点。溪水流量 flow
// 0..1 按正弦缓动周期性涨落；每块石头有耐受力 tolerance。**站在某块石头
// 上的过程中**一旦 flow > tolerance 就会被冲走（失败重开）。每按一次 ACTION
// /点击就向前跳一格。右岸（终点）tolerance=∞，跳到即通关。
//
// 策略：等低潮时连续跳跃；若站在一块低耐受力石头上遇到涨潮，必须承担风险
// 提前跳走，或在低潮时快速通过。

export interface StreamState {
  /** 当前所在位置：-1 = 左岸起点，0..N_STONES-1 石头索引，>= N_STONES 到达右岸（终点） */
  pos: number;
  /** 当前流量 0..1 */
  flow: number;
  /** 涨落周期相位 */
  phase: number;
  /** 每块石头的耐受力（长度 = N_STONES） */
  stones: number[];
  /** 是否被冲走 */
  swept: boolean;
  /** 是否通关 */
  finished: boolean;
  /** 总跳跃次数 */
  jumps: number;
  /** 存活时间（秒） */
  elapsed: number;
}

export const N_STONES = 9;
/**
 * 每块石头的耐受力（长度 = N_STONES）。
 * 设计：前后低耐受力（容易涨潮没过）、中间夹一颗"避难石"高耐受力，
 * 给玩家节奏感 —— 涨潮时跳上避难石喘息，低潮时快速通过两侧。
 */
export const STONES_TOL = [0.7, 0.46, 0.34, 0.62, 0.86, 0.58, 0.36, 0.48, 0.72];
export const FLOW_SPEED = 0.22; // 涨落相位速度（rad/s）—— 比原版稍慢，给玩家反应时间

export function createStream(): StreamState {
  return {
    pos: -1, // 左岸起点
    flow: 0,
    phase: 0,
    stones: [...STONES_TOL],
    swept: false,
    finished: false,
    jumps: 0,
    elapsed: 0,
  };
}

/** 右岸 = 终点（tolerance 无限） */
export function toleranceAt(pos: number): number {
  if (pos < 0) return Number.POSITIVE_INFINITY; // 左岸起点绝对安全
  if (pos >= N_STONES) return Number.POSITIVE_INFINITY; // 右岸终点绝对安全
  return STONES_TOL[pos];
}

/**
 * 推进一帧。纯函数返回新状态。
 * @param state 当前状态
 * @param leap  本帧是否按跳跃
 * @param dt    秒
 */
export function tickStream(state: StreamState, leap: boolean, dt: number): StreamState {
  if (state.swept || state.finished) return state;

  const phase = state.phase + FLOW_SPEED * dt;
  const flow = Math.sin(phase) * 0.5 + 0.5; // 0..1
  const elapsed = state.elapsed + dt;

  // 1) 推进时间 + 先对"当前 pos"做 safety（站在当前石头上，若流量涨过耐受力则被冲走）
  let pos = state.pos;
  let jumps = state.jumps;

  // 左岸起点（pos === -1）：绝对安全，可在此等待低潮
  // 右岸终点（pos >= N_STONES）：由 init 判断，不会进入 safety
  if (pos >= 0 && pos < N_STONES) {
    const tol = toleranceAt(pos);
    if (flow > tol) {
      return { ...state, pos, phase, flow, elapsed, jumps, swept: true, finished: false };
    }
  }

  // 2) 跳跃（发生在 safety 之后；dt=0 时 leap 不会遭遇涨潮；带 dt 时涨潮会被后续帧检测到）
  if (leap && pos < N_STONES) {
    pos = pos + 1;
    jumps += 1;
  }

  // 3) 右岸终点判定
  if (pos >= N_STONES) {
    return { ...state, pos, phase, flow, elapsed, jumps, finished: true, swept: false };
  }

  return { ...state, pos, phase, flow, elapsed, jumps, swept: false, finished: false };
}

export function isSwept(s: StreamState): boolean {
  return s.swept;
}

export function isFinished(s: StreamState): boolean {
  return s.finished;
}

/** 到达终点所在石头的索引（用于渲染） */
export function currentStoneIndex(s: StreamState): number {
  return Math.max(-1, Math.min(N_STONES - 1, s.pos));
}

/** 当前所站石头的耐受力（pos=-1 起点时返回 ∞） */
export function currentTolerance(s: StreamState): number {
  return toleranceAt(s.pos);
}

/** 下一跳落脚点的耐受力。 */
export function nextTolerance(s: StreamState): number {
  return toleranceAt(s.pos + 1);
}

export type StreamAdvice = 'leap' | 'wait' | 'escape' | 'finished' | 'swept';

/** 根据当前水位和下一块石头耐受力给出简明行动建议。 */
export function streamAdvice(s: StreamState): StreamAdvice {
  if (s.finished) return 'finished';
  if (s.swept) return 'swept';

  const current = currentTolerance(s);
  const next = nextTolerance(s);
  const currentRisk = s.pos >= 0 && s.flow >= current - 0.08;
  const nextSafe = s.flow <= next - 0.06;

  if (currentRisk && s.flow <= next - 0.02) return 'escape';
  return nextSafe ? 'leap' : 'wait';
}

/** 表现分 0..1：通关时跳跃越少、存活越快越高 */
export function streamPerformance(s: StreamState): number {
  if (!s.finished) return 0;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  // 通关保底 0.65，跳跃加分。起点 -1,连跳 N_STONES+1 次直达右岸为最优（一口气不歇）。
  // 每多跳一次（因中途在石头上等待）扣 1/8,扣到 0 为止。
  const perfect = N_STONES + 1;
  const jumpBonus = clamp01(1 - Math.max(0, s.jumps - perfect) / 10);
  return clamp01(0.65 + 0.35 * jumpBonus);
}

/** 0..1 进度（按跳跃距离） */
export function streamProgress(s: StreamState): number {
  return Math.max(0, Math.min(1, (s.pos + 1) / (N_STONES + 1)));
}
