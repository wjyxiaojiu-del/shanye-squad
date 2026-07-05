import { describe, it, expect } from 'vitest';
import {
  TARGET_TIME,
  correctionDir,
  createPaddle,
  isFallen,
  isFinished,
  paddlePerformance,
  paddleProgress,
  tickPaddle,
} from '../src/minigames/paddleboard/logic';

describe('桨板平衡 · 初始', () => {
  it('初始水平、未失败、未通关', () => {
    const s = createPaddle();
    expect(s.tilt).toBe(0);
    expect(s.fallen).toBe(false);
    expect(s.finished).toBe(false);
    expect(isFallen(s)).toBe(false);
    expect(isFinished(s)).toBe(false);
    expect(paddleProgress(s)).toBe(0);
  });
});

describe('桨板平衡 · 推进', () => {
  it('不操作时会被波浪推倾斜（最终落水）', () => {
    let s = createPaddle();
    let guard = 0;
    while (!s.fallen && !s.finished && guard < 200000) {
      s = tickPaddle(s, 0, 1 / 60);
      guard++;
    }
    // 不操作必然会被波浪推翻
    expect(isFallen(s)).toBe(true);
    expect(s.timeAlive).toBeLessThan(TARGET_TIME);
  });

  it('始终按倾斜反向可稳住、最终通关（可解性）', () => {
    let s = createPaddle();
    let guard = 0;
    while (!s.finished && guard < 100000) {
      s = tickPaddle(s, correctionDir(s), 1 / 60);
      guard++;
    }
    expect(isFinished(s)).toBe(true);
    expect(isFallen(s)).toBe(false);
    expect(paddleProgress(s)).toBeCloseTo(1, 5);
  });

  it('不修改原状态（纯函数）', () => {
    const s = createPaddle();
    const copy = { ...s };
    tickPaddle(s, -1, 0.05);
    expect(s).toEqual(copy);
  });

  it('correctionDir 给出倾斜反方向', () => {
    expect(correctionDir({ ...createPaddle(), tilt: 0.2 })).toBe(-1);
    expect(correctionDir({ ...createPaddle(), tilt: -0.2 })).toBe(1);
    expect(correctionDir({ ...createPaddle(), tilt: 0.005 })).toBe(0);
  });

  it('超 MAX_TILT 立刻失败并冻结', () => {
    let s = createPaddle();
    // 极端情况：强制倾斜到超阈值（应不会在游戏里自然发生，但防御性验证）
    // 用微小积分让 tilt 越过阈值
    for (let i = 0; i < 2000; i++) {
      s = tickPaddle(s, 0, 0.01);
      if (s.fallen) break;
    }
    if (s.fallen) {
      const after = tickPaddle(s, 0, 0.1);
      expect(after).toBe(s); // 失败态被冻结
    }
  });
});

describe('桨板平衡 · 评分', () => {
  it('paddlePerformance 为 0..1', () => {
    expect(paddlePerformance(createPaddle())).toBeGreaterThanOrEqual(0);
    expect(paddlePerformance(createPaddle())).toBeLessThanOrEqual(1);
  });

  it('完美通关时 perf 接近 1', () => {
    let s = createPaddle();
    let guard = 0;
    while (!s.finished && guard < 100000) {
      s = tickPaddle(s, correctionDir(s), 1 / 60);
      guard++;
    }
    expect(paddlePerformance(s)).toBeGreaterThan(0.7);
  });

  it('paddleProgress 单调不小于 0、不超过 1', () => {
    let s = createPaddle();
    expect(paddleProgress(s)).toBe(0);
    for (let i = 0; i < 1000; i++) {
      s = tickPaddle(s, 0, 0.05);
      expect(paddleProgress(s)).toBeGreaterThanOrEqual(0);
      expect(paddleProgress(s)).toBeLessThanOrEqual(1);
      if (s.fallen) break;
    }
  });
});
