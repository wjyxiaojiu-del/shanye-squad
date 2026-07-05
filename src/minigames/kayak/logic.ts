// ============================================================
// 皮划艇脱困 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法（俯视角闪避型）：皮划艇在一条自上而下滚动的河流里，玩家按 ←→
// /触屏左右持续移动，闪避石头/树枝障碍。碰撞 → 立刻失败（当前进度结算
// 后可重开）；累计前进 DISTANCE 米即通关。perf = 完成度进度。

export type ObstacleKind = 'rock' | 'branch';

export interface Obstacle {
  id: number;
  x: number; // 河流水平位置（0..RIVER_W）
  y: number; // 世界坐标（向下递增）
  w: number;
  h: number;
  kind: ObstacleKind;
}

export interface KayakState {
  kayakX: number; // 皮划艇水平（0..RIVER_W）
  scrollY: number; // 累计前进距离（米）
  obstacles: Obstacle[];
  spawnedUpTo: number; // 上次生成到 scrollY 多少米
  nextId: number;
  finished: boolean;
  gameOver: boolean;
  hits: number;
  elapsed: number;
}

// ---- 手感参数 ----
export const DISTANCE = 340; // 跑完多少米通关（约 25 秒平均时长）
export const BASE_SPEED = 18; // 起始滚动速度（米/秒）
export const MAX_SPEED = 28; // 最远处最快滚动速度
export const KAYAK_W = 36; // 皮划艇宽度
export const KAYAK_H = 56;
export const RIVER_W = 360; // 河流可用宽度
export const SPAWN_GAP_BASE = 36; // 障碍物初始平均间距（米）
export const SPAWN_GAP_MIN = 22; // 最远处最小平均间距

/** 由当前进度 0..1 平滑插值出当前滚动速度（越往后河越急） */
export function speedAt(progress: number): number {
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * progress;
}

/** 由当前进度插出当前障碍间距（越往后障碍越密） */
export function spawnGapAt(progress: number): number {
  return SPAWN_GAP_BASE + (SPAWN_GAP_MIN - SPAWN_GAP_BASE) * progress;
}

/** 左右河岸留白边界（皮划艇中心活动范围） */
export const KAYAK_MIN = 18;
export const KAYAK_MAX = RIVER_W - 18;
export const KAYAY_MAX = KAYAK_MAX;

/** 由 id 生成水平位置（确定性） */
function placeX(id: number): number {
  const s = Math.sin(id * 12.9898 + 78.233) * 43758.5453;
  const r = s - Math.floor(s); // 0..1
  return KAYAK_MIN + r * (KAYAK_MAX - KAYAK_MIN);
}

function pickKind(id: number): ObstacleKind {
  return id % 3 === 0 ? 'branch' : 'rock';
}

export function createKayak(): KayakState {
  return {
    kayakX: RIVER_W / 2,
    scrollY: 0,
    obstacles: [],
    spawnedUpTo: 0,
    nextId: 0,
    finished: false,
    gameOver: false,
    hits: 0,
    elapsed: 0,
  };
}

/** 生成新障碍物（在视野上方） */
function spawn(state: KayakState): Obstacle[] {
  const out: Obstacle[] = [];
  const progress = state.scrollY / DISTANCE;
  const gap = spawnGapAt(progress);
  let jitterSeed = state.nextId;
  while (state.spawnedUpTo < state.scrollY + 80) {
    const id = state.nextId++;
    const kind = pickKind(id);
    out.push({
      id,
      x: placeX(id),
      y: state.spawnedUpTo + 80, // 在视野上方生成
      w: kind === 'rock' ? 38 : 56,
      h: kind === 'rock' ? 30 : 18,
      kind,
    });
    const jit = (Math.sin(jitterSeed++ * 7.13) * 0.5 + 0.5) * (gap * 0.6);
    state.spawnedUpTo += gap + jit;
  }
  return out;
}

/** 皮划艇与障碍物的圆润碰撞 */
function collides(state: KayakState, o: Obstacle): boolean {
  const dx = Math.abs(state.kayakX - o.x);
  const dy = Math.abs(state.scrollY + 60 - o.y); // 皮划艇在视野 y=60 处
  const rx = (KAYAK_W + o.w) / 2;
  const ry = (KAYAK_H + o.h) / 2;
  return dx < rx * 0.7 && dy < ry * 0.7;
}

/**
 * 推进一帧。纯函数返回新状态。
 * @param state 当前状态
 * @param dir   玩家输入：-1 左移 / 0 不动 / +1 右移
 * @param dt    秒
 */
export function tickKayak(state: KayakState, dir: -1 | 0 | 1, dt: number): KayakState {
  if (state.finished || state.gameOver) return state;

  const elapsed = state.elapsed + dt;
  const progress = state.scrollY / DISTANCE;
  const kayakX = Math.max(KAYAK_MIN, Math.min(KAYAK_MAX, state.kayakX + dir * 150 * dt));
  const scrollY = state.scrollY + speedAt(progress) * dt;

  // 生成新障碍
  const draft: KayakState = { ...state, kayakX, scrollY, spawnedUpTo: state.spawnedUpTo, nextId: state.nextId };
  const fresh = spawn(draft);
  const obstacles = [...state.obstacles, ...fresh].filter((o) => o.y > scrollY - 30);

  // 碰撞检测
  const draft2: KayakState = { ...draft, obstacles };
  const hit = obstacles.some((o) => collides(draft2, o));
  if (hit) {
    return { ...draft2, gameOver: true, hits: state.hits + 1, elapsed };
  }

  const finished = scrollY >= DISTANCE;
  return { ...draft2, scrollY, finished, elapsed };
}

export function isGameOver(s: KayakState): boolean {
  return s.gameOver;
}

export function isFinished(s: KayakState): boolean {
  return s.finished;
}

/** 表现分 0..1：按完成度 */
export function kayakPerformance(s: KayakState): number {
  return Math.max(0, Math.min(1, s.scrollY / DISTANCE));
}

/** 0..1 进度（用于 HUD） */
export function kayakProgress(s: KayakState): number {
  return Math.max(0, Math.min(1, s.scrollY / DISTANCE));
}

/** 找出最近一枚正在接近艇头的障碍，用于界面预警。 */
export function nextHazard(state: KayakState, lookAhead = 115): Obstacle | null {
  const kayakY = state.scrollY + 60;
  const hazards = state.obstacles
    .filter((o) => o.y >= kayakY - 8 && o.y <= kayakY + lookAhead)
    .sort((a, b) => Math.abs(a.y - kayakY) - Math.abs(b.y - kayakY));
  return hazards[0] ?? null;
}

/** 建议闪避方向：-1 左 / 0 保持 / +1 右。 */
export function kayakDodgeDir(state: KayakState): -1 | 0 | 1 {
  const hazard = nextHazard(state);
  if (!hazard) return 0;

  const dangerBand = (KAYAK_W + hazard.w) / 2 + 18;
  if (Math.abs(state.kayakX - hazard.x) > dangerBand) return 0;

  if (state.kayakX <= KAYAK_MIN + 36) return 1;
  if (state.kayakX >= KAYAK_MAX - 36) return -1;
  return hazard.x >= state.kayakX ? -1 : 1;
}
