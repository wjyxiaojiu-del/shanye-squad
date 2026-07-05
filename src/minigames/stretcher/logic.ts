// ============================================================
// 简易担架 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：野外救援，用木棍和衣物按正确顺序组装一副简易担架。
// 每一步把对应材料拖到高亮的目标槽位，顺序正确才算完成该步、进入下一步。
// 全部步骤完成 → 担架成型 → 承重测试通过。
//
// 教育点：担架的搭建结构与顺序（先骨架后承面再固定）。

export type PartId = 'pole-left' | 'pole-right' | 'shirt' | 'pants' | 'rope';

export interface Step {
  part: PartId;
  label: string; // 材料名
  hint: string; // 该步说明（救援知识）
  /** 目标槽位中心（设计坐标） */
  slot: { x: number; y: number };
}

export interface StretcherState {
  /** 已按顺序完成的部件 */
  placed: PartId[];
  finished: boolean;
}

/**
 * 组装步骤（固定顺序）：
 * 先两根主骨架 → 铺上衣做承面 → 再裤子 → 最后绳结固定。
 */
export const STEPS: Step[] = [
  { part: 'pole-left', label: '左木棍', hint: '两根结实的木棍做担架主骨架', slot: { x: 380, y: 200 } },
  { part: 'pole-right', label: '右木棍', hint: '两根平行木棍，间距略宽于肩', slot: { x: 580, y: 200 } },
  { part: 'shirt', label: '上衣', hint: '把衣物套在木棍上做承重面', slot: { x: 480, y: 250 } },
  { part: 'pants', label: '裤子', hint: '多件衣物拼接，承住身体', slot: { x: 480, y: 320 } },
  { part: 'rope', label: '绳结', hint: '绳子绑紧各处，确保牢固不散', slot: { x: 480, y: 285 } },
];

export function createStretcher(): StretcherState {
  return { placed: [], finished: false };
}

/** 当前应该放置的步骤索引（= 已完成数）；全部完成返回 STEPS.length */
export function currentStepIndex(state: StretcherState): number {
  return state.placed.length;
}

/** 当前步骤（已完成则返回 null） */
export function currentStep(state: StretcherState): Step | null {
  const i = currentStepIndex(state);
  return i < STEPS.length ? STEPS[i] : null;
}

/** 某部件是否已放置 */
export function isPlaced(state: StretcherState, part: PartId): boolean {
  return state.placed.includes(part);
}

export type PlaceResult = 'placed' | 'wrong-order' | 'already' | 'done';

export interface PlaceOutcome {
  state: StretcherState;
  result: PlaceResult;
}

/**
 * 尝试放置某部件。纯函数。
 * - 正好是当前步骤的部件 → 放置成功，可能触发成型
 * - 是之后步骤的部件（顺序不对）→ wrong-order，不改变
 * - 已放过 → already
 * - 已全部完成 → done
 */
export function placePart(state: StretcherState, part: PartId): PlaceOutcome {
  if (state.finished) return { state, result: 'done' };
  if (isPlaced(state, part)) return { state, result: 'already' };

  const step = currentStep(state);
  if (!step || step.part !== part) {
    return { state, result: 'wrong-order' };
  }

  const placed = [...state.placed, part];
  const finished = placed.length >= STEPS.length;
  return { state: { placed, finished }, result: 'placed' };
}

export function isBuilt(state: StretcherState): boolean {
  return state.finished;
}

/** 进度 0..1 */
export function stretcherProgress(state: StretcherState): number {
  return state.placed.length / STEPS.length;
}

export function stepByPart(part: PartId): Step {
  const s = STEPS.find((x) => x.part === part);
  if (!s) throw new Error(`未知部件: ${part}`);
  return s;
}
