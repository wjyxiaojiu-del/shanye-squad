// ============================================================
// 垃圾分类 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：物品逐个出现，玩家把它丢进正确的垃圾桶（可回收 / 厨余 / 有害）。
// 连续分对累积连击加成；全部分完后按正确率评定表现分 → 评星。
// 教学点：垃圾分类常识、无痕山林（把垃圾带走并正确处理）。

export type BinType = 'recycle' | 'kitchen' | 'harmful';

export interface TrashItem {
  name: string;
  emoji: string;
  bin: BinType;
}

export const BINS: { type: BinType; label: string; emoji: string; color: string; hint: string }[] = [
  { type: 'recycle', label: '可回收', emoji: '♻️', color: '#6B8FB5', hint: '瓶 / 罐 / 纸' },
  { type: 'kitchen', label: '厨余', emoji: '🍎', color: '#7A8B6F', hint: '果皮 / 剩饭' },
  { type: 'harmful', label: '有害', emoji: '⚠️', color: '#C1786A', hint: '电池 / 药品' },
];

/** 物品图鉴（户外常见垃圾） */
export const TRASH_ITEMS: TrashItem[] = [
  { name: '塑料瓶', emoji: '🥤', bin: 'recycle' },
  { name: '易拉罐', emoji: '🥫', bin: 'recycle' },
  { name: '纸箱', emoji: '📦', bin: 'recycle' },
  { name: '玻璃瓶', emoji: '🍶', bin: 'recycle' },
  { name: '报纸', emoji: '📰', bin: 'recycle' },
  { name: '苹果核', emoji: '🍎', bin: 'kitchen' },
  { name: '香蕉皮', emoji: '🍌', bin: 'kitchen' },
  { name: '剩饭', emoji: '🍚', bin: 'kitchen' },
  { name: '菜叶', emoji: '🥬', bin: 'kitchen' },
  { name: '蛋壳', emoji: '🥚', bin: 'kitchen' },
  { name: '废电池', emoji: '🔋', bin: 'harmful' },
  { name: '过期药片', emoji: '💊', bin: 'harmful' },
  { name: '废荧光灯管', emoji: '💡', bin: 'harmful' },
  { name: '油漆罐', emoji: '🎨', bin: 'harmful' },
  { name: '水银温度计', emoji: '🌡️', bin: 'harmful' },
];

/** 每局分拣的物品数 */
export const ROUND_SIZE = 12;
/** 达到成功（可解锁贴纸）的最低正确率 */
export const PASS_ACCURACY = 0.5;

export function isCorrect(item: TrashItem, bin: BinType): boolean {
  return item.bin === bin;
}

export function binLabel(bin: BinType): string {
  return BINS.find((b) => b.type === bin)?.label ?? '';
}

export function correctionText(item: TrashItem): string {
  return `${item.name} 应进「${binLabel(item.bin)}」`;
}

/** 连击加成倍率（最多 +100%），连击断了传 0 */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), 5) * 0.2;
}

export interface SortResult {
  correct: number;
  total: number;
  accuracy: number;
  /** 表现分 0..1（喂给 onWin → 评星） */
  perf: number;
  success: boolean;
}

/** 由每次分拣对错的数组汇总结果 */
export function sortResult(correctFlags: ReadonlyArray<boolean>): SortResult {
  const total = correctFlags.length;
  const correct = correctFlags.filter(Boolean).length;
  const accuracy = total > 0 ? correct / total : 0;
  return { correct, total, accuracy, perf: accuracy, success: accuracy >= PASS_ACCURACY };
}
