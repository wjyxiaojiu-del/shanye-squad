import { describe, it, expect } from 'vitest';
import {
  MOVE_SPEED,
  NightState,
  Vec,
  createNight,
  hitsObstacle,
  isHome,
  nightProgress,
  reachedGoal,
  tickNight,
} from '../src/minigames/night/logic';

describe('暗夜盲行 · 初始', () => {
  it('起点未到终点、有障碍与脚印', () => {
    const s = createNight();
    expect(isHome(s)).toBe(false);
    expect(reachedGoal(s)).toBe(false);
    expect(s.obstacles.length).toBeGreaterThan(0);
    expect(s.waypoints.length).toBeGreaterThan(1);
    expect(nightProgress(s)).toBeCloseTo(0, 1);
  });
});

describe('暗夜盲行 · 移动', () => {
  it('朝方向移动改变位置', () => {
    const s = createNight();
    const s2 = tickNight(s, { x: 1, y: 0 }, 0.1);
    expect(s2.player.x).toBeGreaterThan(s.player.x);
  });

  it('零方向不移动', () => {
    const s = createNight();
    const s2 = tickNight(s, { x: 0, y: 0 }, 0.1);
    expect(s2.player).toEqual(s.player);
  });

  it('方向未归一化也按单位速度移动（对角不加速）', () => {
    const s = createNight();
    const s2 = tickNight(s, { x: 10, y: 0 }, 1);
    const moved = s2.player.x - s.player.x;
    expect(moved).toBeCloseTo(MOVE_SPEED, 0);
  });

  it('被限制在世界范围内', () => {
    let s = createNight();
    for (let i = 0; i < 200; i++) s = tickNight(s, { x: -1, y: 1 }, 0.1);
    expect(s.player.x).toBeGreaterThanOrEqual(0);
    expect(s.player.y).toBeLessThanOrEqual(540);
  });

  it('tickNight 不修改原状态（纯函数）', () => {
    const s = createNight();
    const copy = { ...s, player: { ...s.player } };
    tickNight(s, { x: 1, y: 1 }, 0.1);
    expect(s).toEqual(copy);
  });
});

describe('暗夜盲行 · 障碍', () => {
  it('hitsObstacle 命中判定', () => {
    const obstacles = [{ x: 100, y: 100, r: 30 }];
    expect(hitsObstacle({ x: 100, y: 100 }, obstacles)).toBe(true);
    expect(hitsObstacle({ x: 300, y: 300 }, obstacles)).toBe(false);
  });

  it('踩到障碍触发减速', () => {
    const s: NightState = {
      ...createNight(),
      player: { x: 260, y: 360 }, // 靠近第一个障碍(300,360,r34)
      obstacles: [{ x: 300, y: 360, r: 34 }],
    };
    const s2 = tickNight(s, { x: 1, y: 0 }, 0.1);
    expect(s2.slow).toBeGreaterThan(0);
  });

  it('减速状态下移动更慢', () => {
    const base: NightState = { ...createNight(), obstacles: [] };
    const normal = tickNight(base, { x: 1, y: 0 }, 0.1).player.x - base.player.x;
    const slowed = tickNight({ ...base, slow: 0.5 }, { x: 1, y: 0 }, 0.1).player.x - base.player.x;
    expect(slowed).toBeLessThan(normal);
  });
});

describe('暗夜盲行 · 到达', () => {
  it('走到营火即通关', () => {
    const s: NightState = { ...createNight(), player: { x: 850, y: 120 } };
    const s2 = tickNight(s, { x: 0, y: -1 }, 0.1);
    expect(s2.finished).toBe(true);
    expect(nightProgress(s2)).toBeCloseTo(1, 1);
  });

  it('通关后 tick 冻结', () => {
    const done: NightState = { ...createNight(), finished: true };
    const p = { ...done.player };
    const s2 = tickNight(done, { x: 1, y: 1 }, 1);
    expect(s2.player).toEqual(p);
  });

  it('朝营火径直走最终能到达（关卡可解）', () => {
    let s = createNight();
    let guard = 0;
    while (!s.finished && guard < 3000) {
      const dir: Vec = { x: s.goal.x - s.player.x, y: s.goal.y - s.player.y };
      s = tickNight(s, dir, 0.05);
      guard++;
    }
    expect(s.finished).toBe(true);
  });
});
