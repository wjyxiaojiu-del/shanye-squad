// ============================================================
// 净水大作战 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：野外用瓶子自制滤水器，从下往上按正确顺序铺滤层：
//   纱布 → 木炭 → 细沙 → 小石子 → 大石子
// 每次只能放"当前该放的那层"，放错会被拒绝并计一次失误。
// 铺满后脏水从上淋下、层层过滤变清 → 通关；失误越少表现分越高。
// 教学点：野外取水安全，水流从粗到细分层过滤，木炭吸附异味。

export interface FilterLayer {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

/** 正确铺设顺序（从下往上：先垫纱布防漏，再铺吸附/过滤层，最上层挡大颗粒） */
export const CORRECT_ORDER: string[] = ['cloth', 'charcoal', 'sand', 'pebble', 'gravel'];

export const LAYERS: FilterLayer[] = [
  { id: 'gravel', name: '大石子', emoji: '🪨', color: '#8D9299' },
  { id: 'pebble', name: '小石子', emoji: '⚪', color: '#B9AE97' },
  { id: 'sand', name: '细沙', emoji: '🟡', color: '#D8C48E' },
  { id: 'charcoal', name: '木炭', emoji: '⬛', color: '#454343' },
  { id: 'cloth', name: '纱布', emoji: '🧻', color: '#ECE5D4' },
];

export function layerById(id: string): FilterLayer | undefined {
  return LAYERS.find((l) => l.id === id);
}

/** 当前该放的层 id（已放 placedCount 层时）；全部放完返回 null */
export function nextExpected(placedCount: number): string | null {
  return CORRECT_ORDER[placedCount] ?? null;
}

/** 在已放 placedCount 层的情况下，放 id 是否正确 */
export function isCorrectNext(placedCount: number, id: string): boolean {
  return CORRECT_ORDER[placedCount] === id;
}

/** 是否铺设完成 */
export function isComplete(placedCount: number): boolean {
  return placedCount >= CORRECT_ORDER.length;
}

export interface FilterResult {
  success: boolean;
  /** 表现分 0..1（喂给 onWin → 评星） */
  perf: number;
  /** 水的清澈度 0..1（用于出水动画） */
  clarity: number;
}

/** 依据失误次数评定结果（铺满后调用；完成即成功，失误扣分） */
export function filterResult(mistakes: number): FilterResult {
  const perf = Math.max(0.2, 1 - Math.max(0, mistakes) * 0.15);
  return { success: true, perf, clarity: perf };
}
