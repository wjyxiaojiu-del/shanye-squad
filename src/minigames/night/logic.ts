// ============================================================
// 暗夜盲行 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：夜里头灯只照亮身边一小圈。玩家朝目标方向移动，循着远处营火的
// 微光和地上的向导脚印，穿过黑暗走到营火。踩到障碍(石头/树根)会短暂
// 减速(无惩罚)。走到营火即通关。
//
// 逻辑用世界坐标：玩家从起点走向终点(营火)。容器每帧传入移动方向向量，
// 逻辑负责推进、障碍减速、到达判定。

export interface Vec {
  x: number;
  y: number;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number; // 半径
}

export interface NightState {
  player: Vec;
  goal: Vec;
  obstacles: Obstacle[];
  /** 向导脚印路径点（供渲染提示，也标记推荐路线） */
  waypoints: Vec[];
  /** 减速计时（>0 时移动变慢） */
  slow: number;
  finished: boolean;
}

export const WORLD_W = 960;
export const WORLD_H = 540;
export const PLAYER_R = 14;
export const GOAL_R = 30;
export const MOVE_SPEED = 150; // px/s
export const SLOW_FACTOR = 0.35; // 减速时的速度倍率
export const SLOW_TIME = 0.5; // 踩障碍减速持续

/** 固定关卡（确定性，便于测试与稳定体验） */
export function createNight(): NightState {
  return {
    player: { x: 90, y: 460 },
    goal: { x: 850, y: 110 },
    obstacles: [
      { x: 300, y: 360, r: 34 },
      { x: 460, y: 300, r: 30 },
      { x: 380, y: 200, r: 28 },
      { x: 600, y: 240, r: 36 },
      { x: 680, y: 160, r: 26 },
      { x: 520, y: 130, r: 24 },
      { x: 230, y: 260, r: 26 },
    ],
    waypoints: [
      { x: 90, y: 460 },
      { x: 250, y: 400 },
      { x: 420, y: 360 },
      { x: 560, y: 300 },
      { x: 700, y: 220 },
      { x: 850, y: 110 },
    ],
    slow: 0,
    finished: false,
  };
}

function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** 玩家是否碰到某障碍 */
export function hitsObstacle(pos: Vec, obstacles: Obstacle[]): boolean {
  return obstacles.some((o) => len(pos.x - o.x, pos.y - o.y) < o.r + PLAYER_R);
}

/** 是否到达营火 */
export function reachedGoal(state: NightState): boolean {
  return len(state.player.x - state.goal.x, state.player.y - state.goal.y) < GOAL_R + PLAYER_R;
}

/**
 * 时间推进：按方向 dir（无需归一化）移动玩家；踩障碍则减速并触发 slow。
 * 纯函数返回新状态。dir 为零向量表示不动。
 */
export function tickNight(state: NightState, dir: Vec, dt: number): NightState {
  if (state.finished) return state;

  let slow = Math.max(0, state.slow - dt);
  let player = state.player;

  const dl = len(dir.x, dir.y);
  if (dl > 0.001) {
    const speed = MOVE_SPEED * (slow > 0 ? SLOW_FACTOR : 1);
    const nx = clamp(state.player.x + (dir.x / dl) * speed * dt, PLAYER_R, WORLD_W - PLAYER_R);
    const ny = clamp(state.player.y + (dir.y / dl) * speed * dt, PLAYER_R, WORLD_H - PLAYER_R);
    const next = { x: nx, y: ny };
    if (hitsObstacle(next, state.obstacles)) {
      // 撞上：触发减速，但仍允许缓慢滑过（保留移动，避免卡死）
      slow = SLOW_TIME;
      player = next;
    } else {
      player = next;
    }
  }

  const finished = len(player.x - state.goal.x, player.y - state.goal.y) < GOAL_R + PLAYER_R;
  return { ...state, player, slow, finished };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function isHome(state: NightState): boolean {
  return state.finished;
}

/** 进度 0..1：按到起点/终点直线距离估算 */
export function nightProgress(state: NightState): number {
  const total = len(state.goal.x - 90, state.goal.y - 460);
  const remain = len(state.goal.x - state.player.x, state.goal.y - state.player.y);
  return Math.max(0, Math.min(1, 1 - remain / total));
}
