// ============================================================
// 星级评分 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 每个小游戏通关时上报一个"表现分" perf(0..1，越高越好)，由各游戏自行定义
// (如：用时越短越高、失误越少越高)。这里统一换算成 1..3 星。

export interface ScoreInput {
  /** 表现分 0..1 */
  perf: number;
  /** 用时（秒），仅用于展示 */
  timeSec?: number;
}

export interface ScoreResult {
  stars: number; // 1..3
  perf: number; // 0..1（截断后）
  timeSec?: number;
}

export const THREE_STAR = 0.8;
export const TWO_STAR = 0.5;

/** 表现分 → 星级（1..3） */
export function starsFor(perf: number): number {
  const p = Math.max(0, Math.min(1, perf));
  if (p >= THREE_STAR) return 3;
  if (p >= TWO_STAR) return 2;
  return 1;
}

export function score(input: ScoreInput): ScoreResult {
  const perf = Math.max(0, Math.min(1, input.perf));
  return { stars: starsFor(perf), perf, timeSec: input.timeSec };
}

/**
 * 常用表现分：用时越短越高。
 * best 内(含)得满分，worst 外得 0，之间线性。
 */
export function perfFromTime(timeSec: number, bestSec: number, worstSec: number): number {
  if (timeSec <= bestSec) return 1;
  if (timeSec >= worstSec) return 0;
  return 1 - (timeSec - bestSec) / (worstSec - bestSec);
}

/**
 * 常用表现分：失误越少越高。
 * 0 失误满分，maxMistakes(含)及以上得 0。
 */
export function perfFromMistakes(mistakes: number, maxMistakes: number): number {
  if (maxMistakes <= 0) return mistakes <= 0 ? 1 : 0;
  return Math.max(0, 1 - mistakes / maxMistakes);
}

/** 星级 → 星串（用于展示） */
export function starString(stars: number): string {
  const s = Math.max(0, Math.min(3, Math.round(stars)));
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}
