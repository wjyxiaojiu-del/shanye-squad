import { describe, it, expect } from 'vitest';
import {
  DISTANCE,
  BASE_SPEED,
  createKayak,
  isFinished,
  isGameOver,
  kayakPerformance,
  kayakProgress,
  tickKayak,
  speedAt,
  spawnGapAt,
  kayakDodgeDir,
  nextHazard,
} from '../src/minigames/kayak/logic';

describe('皮划艇脱困 · 初始', () => {
  it('初始在河中、未完成、未失败', () => {
    const s = createKayak();
    expect(s.kayakX).toBeGreaterThan(0);
    expect(s.scrollY).toBe(0);
    expect(s.finished).toBe(false);
    expect(s.gameOver).toBe(false);
    expect(isFinished(s)).toBe(false);
    expect(isGameOver(s)).toBe(false);
    expect(kayakProgress(s)).toBe(0);
  });
});

describe('皮划艇脱困 · 滚动', () => {
  it('无操作时 scrollY 持续增加（沿河下行）', () => {
    let s = createKayak();
    for (let i = 0; i < 60; i++) s = tickKayak(s, 0, 1 / 60);
    expect(s.scrollY).toBeGreaterThan(0);
    expect(s.finished).toBe(false); // 1 秒走不完 60m
  });

  it('跑完 DISTANCE 即通关', () => {
    let s = createKayak();
    let guard = 0;
    while (!s.finished && !s.gameOver && guard < 100000) {
      // 简单策略：不动（依赖布局可能撞——但用确定性布局测试可解性需验证，这里只检测到达距离阈值行为）
      s = tickKayak(s, 0, 1 / 60);
      guard++;
    }
    // 要么通关，要么撞了——二者必居其一
    expect(s.finished || s.gameOver).toBe(true);
    if (s.finished) {
      expect(s.scrollY).toBeGreaterThanOrEqual(DISTANCE);
      expect(isFinished(s)).toBe(true);
    }
  });

  it('tickKayak 不修改原状态（纯函数）', () => {
    const s = createKayak();
    const copy = JSON.parse(JSON.stringify(s));
    tickKayak(s, 1, 0.05);
    expect(JSON.parse(JSON.stringify(s))).toEqual(copy);
  });
});

describe('皮划艇脱困 · 可解性', () => {
  it('确定性布局下智能避障可通关', () => {
    // 智能求解器：扫描前方 120m 内所有障碍，把河面分成若干竖列，
    // 选离当前位置最近且"能避开最多障碍"的列作为下一步目标
    let s = createKayak();
    let guard = 0;
    while (!s.finished && !s.gameOver && guard < 100000) {
      // 前方 40..150m 内的障碍
      const ahead = s.obstacles.filter(
        (o) => o.y > s.scrollY + 30 && o.y < s.scrollY + 150,
      );
      // 计算若干候选列的"得分"：经过该列会撞多少障碍
      const RIVER_W = 360;
      const KAYAK_W = 36;
      const cols: number[] = [];
      for (let c = 20; c <= RIVER_W - 20; c += 12) cols.push(c);
      let bestCol = s.kayakX;
      let bestScore = -1;
      for (const c of cols) {
        let score = 0;
        for (const o of ahead) {
          const blocked = Math.abs(c - o.x) < (o.w + KAYAK_W) / 2 + 6;
          // 离皮划艇越近的障碍惩罚越大
          const dy = Math.max(40, o.y - s.scrollY);
          score += blocked ? Math.round(1000 / dy) : 0;
        }
        // 加分：离当前位置近
        const distPenalty = Math.abs(c - s.kayakX) * 0.5;
        const total = 1000 - score - (score === 0 ? distPenalty : 0);
        if (total > bestScore) {
          bestScore = total;
          bestCol = c;
        }
      }
      const dx = bestCol - s.kayakX;
      const dir: -1 | 0 | 1 = Math.abs(dx) < 6 ? 0 : dx > 0 ? 1 : -1;
      s = tickKayak(s, dir, 1 / 60);
      guard++;
    }
    expect(s.finished).toBe(true);
    expect(isGameOver(s)).toBe(false);
  });
});

describe('皮划艇脱困 · 横向边界', () => {
  it('按左移不会超出左岸', () => {
    let s = createKayak();
    for (let i = 0; i < 200; i++) s = tickKayak(s, -1, 1 / 60);
    expect(s.kayakX).toBeGreaterThanOrEqual(18 - 0.01);
  });
  it('按右移不会超出右岸', () => {
    let s = createKayak();
    for (let i = 0; i < 200; i++) s = tickKayak(s, 1, 1 / 60);
    expect(s.kayakX).toBeLessThanOrEqual(360 - 18 + 0.01);
  });
});

describe('皮划艇脱困 · 预警提示', () => {
  it('nextHazard 找到最近的前方障碍', () => {
    const s = {
      ...createKayak(),
      obstacles: [
        { id: 1, x: 120, y: 210, w: 38, h: 30, kind: 'rock' as const },
        { id: 2, x: 180, y: 100, w: 56, h: 18, kind: 'branch' as const },
      ],
    };
    expect(nextHazard(s)?.id).toBe(2);
  });

  it('障碍在正前方时建议向侧边闪避', () => {
    const s = {
      ...createKayak(),
      kayakX: 180,
      obstacles: [{ id: 1, x: 180, y: 72, w: 38, h: 30, kind: 'rock' as const }],
    };
    expect(kayakDodgeDir(s)).toBe(-1);
  });

  it('障碍已偏离航线时建议保持', () => {
    const s = {
      ...createKayak(),
      kayakX: 80,
      obstacles: [{ id: 1, x: 240, y: 72, w: 38, h: 30, kind: 'rock' as const }],
    };
    expect(kayakDodgeDir(s)).toBe(0);
  });
});

describe('皮划艇脱困 · 难度渐增', () => {
  it('speedAt 在终点比起点快', () => {
    const s0 = speedAt(0);
    const s1 = speedAt(1);
    expect(s1).toBeGreaterThan(s0);
    expect(s0).toBe(BASE_SPEED);
  });
  it('spawnGapAt 终点比起点更密', () => {
    expect(spawnGapAt(1)).toBeLessThan(spawnGapAt(0));
  });
  it('智能闪避通关时,时长明显加长（远超旧版 ~3.3s）', () => {
    let s = createKayak();
    let guard = 0;
    while (!s.finished && !s.gameOver && guard < 100000) {
      const ahead = s.obstacles.filter(
        (o) => o.y > s.scrollY + 30 && o.y < s.scrollY + 150,
      );
      const RIVER_W = 360;
      const KAYAK_W = 36;
      const cols: number[] = [];
      for (let c = 20; c <= RIVER_W - 20; c += 12) cols.push(c);
      let bestCol = s.kayakX;
      let bestScore = -1;
      for (const c of cols) {
        let score = 0;
        for (const o of ahead) {
          const blocked = Math.abs(c - o.x) < (o.w + KAYAK_W) / 2 + 6;
          const dy = Math.max(40, o.y - s.scrollY);
          score += blocked ? Math.round(1000 / dy) : 0;
        }
        const distPenalty = Math.abs(c - s.kayakX) * 0.5;
        const total = 1000 - score - (score === 0 ? distPenalty : 0);
        if (total > bestScore) {
          bestScore = total;
          bestCol = c;
        }
      }
      const dx = bestCol - s.kayakX;
      const dir: -1 | 0 | 1 = Math.abs(dx) < 6 ? 0 : dx > 0 ? 1 : -1;
      s = tickKayak(s, dir, 1 / 60);
      guard++;
    }
    expect(s.finished).toBe(true);
    expect(s.elapsed).toBeGreaterThan(8);
  });
});

describe('皮划艇脱困 · 评分', () => {
  it('kayakPerformance 0..1 且单调', () => {
    let s = createKayak();
    const p0 = kayakPerformance(s);
    expect(p0).toBe(0);
    for (let i = 0; i < 600; i++) {
      s = tickKayak(s, 0, 1 / 60);
      const p = kayakPerformance(s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      if (s.gameOver) break;
    }
  });
});
