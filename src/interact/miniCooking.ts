// ============================================================
// 应急小厨房 — 迷你烹饪时机小游戏（纯逻辑 + DOM overlay）
// ============================================================
//
// 玩法：一个节奏+时机混合游戏。火力条随机缓慢漂移，玩家在合适的火候区间
// 按下对应的步骤按钮（加柴 / 翻面 / 焖煮 / 装盘），每步匹配度给出评级。
// 4 步全部完成 → 烹饪成功，恢复体力 + 30 min 饱腹 buff。
// 任一步翻车严重（火力 == 0% 或 == 100%） → 烧焦，全部重来。

export type CookingStep = 'stirFire' | 'flip' | 'simmer' | 'serve';

export const STEPS: { id: CookingStep; label: string; icon: string }[] = [
  { id: 'stirFire', label: '加柴', icon: '🔥' },
  { id: 'flip', label: '翻面', icon: '🔄' },
  { id: 'simmer', label: '焖煮', icon: '♨️' },
  { id: 'serve', label: '装盘', icon: '🍜' },
];

/** 每一步的目标火力区间 */
const TARGET_RANGES: Record<CookingStep, [number, number]> = {
  stirFire: [30, 70], // 加柴：适中
  flip: [40, 75], // 翻面：中偏大
  simmer: [15, 45], // 焖煮：小火
  serve: [0, 25], // 装盘：微火
};

export type Grade = 'perfect' | 'good' | 'ok' | 'miss';

export interface CookingResult {
  /** 每步的评级 */
  grades: Grade[];
  /** 是否成功（全部未 miss 且总 good+perfect >= 2） */
  success: boolean;
  /** 最终恢复体力（区间 10..30 跟表现挂钩） */
  staminaRestored: number;
  /** 描述文本 */
  message: string;
}

export function gradeStep(step: CookingStep, fireLevel: number): Grade {
  const [lo, hi] = TARGET_RANGES[step];
  if (fireLevel <= 0 || fireLevel >= 100) return 'miss';
  if (fireLevel >= lo && fireLevel <= hi) {
    // 区间中点越近评级越高
    const mid = (lo + hi) / 2;
    const dist = Math.abs(fireLevel - mid) / ((hi - lo) / 2);
    if (dist < 0.25) return 'perfect';
    if (dist < 0.65) return 'good';
    return 'ok';
  }
  // 区间外但未烧焦：距离越远评级越低
  const nearest = fireLevel < lo ? lo : hi;
  const off = Math.abs(fireLevel - nearest);
  if (off <= 15) return 'ok';
  return 'miss';
}

export function calcResult(grades: Grade[]): CookingResult {
  const perfect = grades.filter((g) => g === 'perfect').length;
  const good = grades.filter((g) => g === 'good').length;
  const miss = grades.filter((g) => g === 'miss').length;
  const success = miss === 0 && perfect + good >= 2;

  const score = perfect * 3 + good * 2 + (4 - miss - perfect - good) * 1;
  const staminaRestored = Math.max(10, Math.min(30, score * 3));

  let message: string;
  if (success && perfect >= 2) message = '🌟 做出了一碗完美的热汤面！太香了！';
  else if (success) message = '🍜 一碗热腾腾的泡面出锅！好吃到飞起！';
  else if (miss > 0) message = '💨 哎呀，烧焦了！再试一次～';
  else message = '🍲 虽然差点意思，但能吃饱！';

  return { grades, success, staminaRestored, message };
}

/** 评估 hit box 用的火条位置 */
export function clampFire(v: number): number {
  return Math.max(0, Math.min(100, v));
}
