// ============================================================
// 无痕山林 (LNT) —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：离开营地前，场景散布着人类留下的痕迹（垃圾、没熄的火、乱刻的树…）
// 和天然的东西（石头、野花、蘑菇）。玩家点击清理"痕迹"，让营地恢复原状；
// 天然物不能动（点了会提示"这是大自然的一部分"）。清完所有痕迹即通关。
//
// 教育点：无痕山林 = 把自己带来的痕迹全部带走，但不破坏原生自然。

export type ItemKind =
  // 需要清理的人为痕迹
  | 'trash-peel' // 果皮
  | 'trash-bottle' // 塑料瓶
  | 'trash-can' // 易拉罐
  | 'trash-bag' // 垃圾袋
  | 'campfire' // 没熄灭的火堆
  | 'carved-tree' // 乱刻的树
  // 天然物，不可清理
  | 'rock'
  | 'flower'
  | 'mushroom';

export interface Item {
  id: number;
  kind: ItemKind;
  x: number; // 设计坐标 0..DESIGN_W
  y: number;
  /** 已被清理（仅对痕迹有效） */
  cleaned: boolean;
}

export const DESIGN_W = 960;
export const DESIGN_H = 540;

/**
 * LNT 七大准则（Leave No Trace 7 Principles）。
 * principle 1..7，每条痕迹关联其中一条，清理时呈现，达成环保教育。
 */
export interface Principle {
  n: number;
  title: string;
  desc: string;
  emoji: string;
}

export const PRINCIPLES: Principle[] = [
  { n: 1, title: '提前计划与准备', desc: '了解目的地，备好装备，减少意外与破坏', emoji: '🗺️' },
  { n: 2, title: '在坚实地面行走', desc: '走既有步道、在耐踩的地面扎营，别踩坏植被', emoji: '🥾' },
  { n: 3, title: '妥善处理垃圾', desc: '带来的垃圾全部带走，不留一片', emoji: '🗑️' },
  { n: 4, title: '保持自然原貌', desc: '石头花草留在原地，不带走、不刻画', emoji: '🌸' },
  { n: 5, title: '减少用火影响', desc: '尽量不生火，用完彻底熄灭、恢复地面', emoji: '🔥' },
  { n: 6, title: '尊重野生动物', desc: '远观不打扰，不投喂野生动物', emoji: '🦌' },
  { n: 7, title: '尊重其他访客', desc: '保持安静整洁，把美好留给下一个人', emoji: '🤝' },
];

export function principleByN(n: number): Principle {
  const p = PRINCIPLES.find((x) => x.n === n);
  if (!p) throw new Error(`未知准则: ${n}`);
  return p;
}

/** 每类痕迹 → 它体现的 LNT 准则编号 */
export function principleForKind(kind: ItemKind): number {
  switch (kind) {
    case 'trash-peel':
    case 'trash-bottle':
    case 'trash-can':
    case 'trash-bag':
      return 3; // 妥善处理垃圾
    case 'campfire':
      return 5; // 减少用火影响
    case 'carved-tree':
      return 4; // 保持自然原貌
    default:
      return 4; // 天然物：保持自然原貌
  }
}

/** 该类型是否是"需要清理的人为痕迹" */
export function isLitter(kind: ItemKind): boolean {
  return (
    kind === 'trash-peel' ||
    kind === 'trash-bottle' ||
    kind === 'trash-can' ||
    kind === 'trash-bag' ||
    kind === 'campfire' ||
    kind === 'carved-tree'
  );
}

/** 该类型是否天然物（不可清理） */
export function isNatural(kind: ItemKind): boolean {
  return !isLitter(kind);
}

export function actionTextForKind(kind: ItemKind): string {
  switch (kind) {
    case 'trash-peel':
    case 'trash-bottle':
    case 'trash-can':
    case 'trash-bag':
      return '带走垃圾';
    case 'campfire':
      return '彻底熄灭火堆';
    case 'carved-tree':
      return '不要刻画树木';
    case 'rock':
    case 'flower':
    case 'mushroom':
      return '保持原样，不采摘不带走';
  }
}

export interface LntState {
  items: Item[];
  finished: boolean;
}

/** 固定关卡布局（确定性，便于测试与稳定体验） */
const LAYOUT: Array<{ kind: ItemKind; x: number; y: number }> = [
  { kind: 'trash-peel', x: 180, y: 360 },
  { kind: 'trash-bottle', x: 330, y: 430 },
  { kind: 'campfire', x: 500, y: 400 },
  { kind: 'trash-can', x: 660, y: 350 },
  { kind: 'carved-tree', x: 800, y: 300 },
  { kind: 'trash-bag', x: 250, y: 470 },
  { kind: 'trash-peel', x: 720, y: 460 },
  // 天然物（干扰项，不能清理）
  { kind: 'rock', x: 420, y: 470 },
  { kind: 'flower', x: 580, y: 460 },
  { kind: 'mushroom', x: 120, y: 440 },
  { kind: 'rock', x: 880, y: 430 },
];

export function createLnt(): LntState {
  const items: Item[] = LAYOUT.map((d, i) => ({ id: i, kind: d.kind, x: d.x, y: d.y, cleaned: false }));
  return { items, finished: false };
}

/** 待清理的痕迹总数 */
export function litterTotal(state: LntState): number {
  return state.items.filter((it) => isLitter(it.kind)).length;
}

/** 已清理数 */
export function cleanedCount(state: LntState): number {
  return state.items.filter((it) => it.cleaned).length;
}

/** 点击结果：清理成功 / 点到天然物 / 没点中 / 已清理过 */
export type ClickResult = 'cleaned' | 'natural' | 'miss' | 'already';

export interface ClickOutcome {
  state: LntState;
  result: ClickResult;
  /** 命中的物品 id（miss 时为 -1） */
  hitId: number;
}

/**
 * 点击某物品（按 id）。纯函数，返回新状态与结果。
 * - 痕迹且未清理 → 清理，可能触发通关
 * - 痕迹已清理 → already
 * - 天然物 → natural（不改变）
 */
export function clickItem(state: LntState, id: number): ClickOutcome {
  const item = state.items.find((it) => it.id === id);
  if (!item) return { state, result: 'miss', hitId: -1 };
  if (isNatural(item.kind)) return { state, result: 'natural', hitId: id };
  if (item.cleaned) return { state, result: 'already', hitId: id };

  const items = state.items.map((it) => (it.id === id ? { ...it, cleaned: true } : it));
  const finished = items.filter((it) => isLitter(it.kind)).every((it) => it.cleaned);
  return { state: { items, finished }, result: 'cleaned', hitId: id };
}

export function isDone(state: LntState): boolean {
  return state.finished;
}

/** 进度 0..1（按痕迹清理比例） */
export function lntProgress(state: LntState): number {
  const total = litterTotal(state);
  if (total === 0) return 1;
  return cleanedCount(state) / total;
}
