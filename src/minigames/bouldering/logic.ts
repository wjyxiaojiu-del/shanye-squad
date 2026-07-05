// ============================================================
// 抱石体验 —— 纯攀爬逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法（自由选点）：整面岩壁铺满大小不一的岩点。小人当前抓在某个岩点上，
// 有一个"够得着的范围"(REACH)。玩家点击范围内任意岩点即可爬过去——爬哪条线
// 由玩家自己决定，不预设唯一目标。爬到最顶一排任意岩点即通关。
//
// 逻辑用固定"设计坐标系"(WALL_W 宽、worldY 越小越高)，渲染层再缩放到实际屏幕。

export type HoldKind = 'jug' | 'crimp' | 'edge' | 'foot' | 'sloper' | 'pinch' | 'pocket' | 'volume';

export interface Hold {
  id: number;
  row: number;
  col: number;
  /** 设计坐标水平位置 0..WALL_W */
  x: number;
  /** 设计坐标垂直位置，越小越高（顶部为负） */
  worldY: number;
  /** 岩点半径(设计像素) */
  size: number;
  kind: HoldKind;
}

export interface ClimbState {
  holds: Hold[];
  /** 当前抓住的岩点 id；-1 表示还在起步地面 */
  currentId: number;
  /** 最高行号（到达即通关） */
  topRow: number;
  finished: boolean;
}

export interface Point {
  x: number;
  worldY: number;
}

export const WALL_W = 460;
export const COLS = 5;
export const ROWS = 13;
export const GAP_Y = 82;
export const REACH = 152; // 够得着的半径(设计像素)

/** 起步点：墙底中央的地面 */
export const START: Point = { x: WALL_W / 2, worldY: 70 };

/** 确定性伪随机 0..1（保证每次岩壁布局一致、可测） */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return s - Math.floor(s);
}

function pickKind(v: number): HoldKind {
  if (v < 0.12) return 'crimp';
  if (v < 0.24) return 'edge';
  if (v < 0.38) return 'sloper';
  if (v < 0.52) return 'pinch';
  if (v < 0.66) return 'pocket';
  if (v < 0.78) return 'volume';
  if (v < 0.9) return 'jug';
  return 'foot';
}

/** 生成铺满整面墙的岩点（网格 + 抖动，形态大小多样） */
export function buildWall(): Hold[] {
  const holds: Hold[] = [];
  let id = 0;
  const colW = WALL_W / COLS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const jx = (hash(id * 2.1) - 0.5) * 0.7 * colW;
      const jy = (hash(id * 3.3) - 0.5) * 0.5 * GAP_Y;
      const x = Math.min(WALL_W - 20, Math.max(20, (c + 0.5) * colW + jx));
      const worldY = -(r * GAP_Y) + jy;
      const size = 10 + Math.floor(hash(id * 5.7) * 13); // 10..22
      const kind = pickKind(hash(id * 7.9));
      holds.push({ id, row: r, col: c, x, worldY, size, kind });
      id++;
    }
  }
  return holds;
}

export function createClimb(): ClimbState {
  const holds = buildWall();
  const topRow = holds.reduce((m, h) => Math.max(m, h.row), 0);
  return { holds, currentId: -1, topRow, finished: false };
}

export function holdById(state: ClimbState, id: number): Hold | undefined {
  return state.holds.find((h) => h.id === id);
}

/** 小人当前所在点（起步时为地面 START） */
export function currentPoint(state: ClimbState): Point {
  if (state.currentId < 0) return START;
  const h = holdById(state, state.currentId);
  return h ? { x: h.x, worldY: h.worldY } : START;
}

/** 某岩点当前是否够得着（在 REACH 半径内，且不是脚下这个） */
export function reachable(state: ClimbState, holdId: number): boolean {
  if (state.finished) return false;
  if (holdId === state.currentId) return false;
  const h = holdById(state, holdId);
  if (!h) return false;
  const cur = currentPoint(state);
  return Math.hypot(cur.x - h.x, cur.worldY - h.worldY) <= REACH;
}

/** 够得着的所有岩点 id（渲染层据此高亮/淡化） */
export function reachableIds(state: ClimbState): number[] {
  return state.holds.filter((h) => reachable(state, h.id)).map((h) => h.id);
}

export function highestReachableHold(state: ClimbState): Hold | null {
  return state.holds
    .filter((h) => reachable(state, h.id))
    .sort((a, b) => a.worldY - b.worldY)[0] ?? null;
}

/**
 * 爬向某个岩点。够得着才移动；到达最高行则通关。纯函数返回新状态。
 */
export function moveTo(state: ClimbState, holdId: number): ClimbState {
  if (!reachable(state, holdId)) return state;
  const h = holdById(state, holdId)!;
  return { ...state, currentId: holdId, finished: h.row >= state.topRow };
}

export function isAtTop(state: ClimbState): boolean {
  return state.finished;
}

/** 攀爬进度 0..1（按当前行高度） */
export function progress(state: ClimbState): number {
  if (state.currentId < 0) return 0;
  const h = holdById(state, state.currentId);
  return h ? h.row / state.topRow : 0;
}
