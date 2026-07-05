import { describe, it, expect } from 'vitest';
import {
  COOL_RATE,
  DRILL_REF,
  HEAT_RATE,
  HEAT_THRESHOLD,
  SPARK_DECAY,
  createFire,
  decayHeat,
  drillQuality,
  fireProgress,
  focusQuality,
  heatDelta,
  isHeating,
  isIgnited,
  tickFire,
} from '../src/minigames/fire/logic';

describe('取火聚焦质量', () => {
  it('完全对准焦点 → 质量 1', () => {
    expect(focusQuality(100, 50, 100, 50, 40, 40)).toBe(1);
  });

  it('水平或竖直偏离 → 质量下降', () => {
    const q = focusQuality(120, 50, 100, 50, 40, 40); // x 偏 20/40
    expect(q).toBeCloseTo(0.5, 5);
  });

  it('任一维度超出容差 → 质量 0', () => {
    expect(focusQuality(200, 50, 100, 50, 40, 40)).toBe(0);
    expect(focusQuality(100, 200, 100, 50, 40, 40)).toBe(0);
  });

  it('两维都偏 → 相乘更低', () => {
    const q = focusQuality(120, 70, 100, 50, 40, 40); // 0.5 * 0.5
    expect(q).toBeCloseTo(0.25, 5);
  });
});

describe('取火温度演化', () => {
  it('初始温度 0、未点燃', () => {
    const s = createFire();
    expect(s.temperature).toBe(0);
    expect(isIgnited(s)).toBe(false);
    expect(fireProgress(s)).toBe(0);
  });

  it('满聚焦升温', () => {
    const s = tickFire(createFire(), 1, 1);
    expect(s.temperature).toBeGreaterThan(0);
  });

  it('松手(质量0)时降温但不低于 0', () => {
    let s = createFire();
    s = { temperature: 3, ignited: false };
    s = tickFire(s, 0, 1);
    expect(s.temperature).toBe(Math.max(0, 3 - COOL_RATE));
    expect(s.temperature).toBeGreaterThanOrEqual(0);
  });

  it('持续满聚焦最终点燃', () => {
    let s = createFire();
    let guard = 0;
    while (!s.ignited && guard < 1000) {
      s = tickFire(s, 1, 0.1);
      guard++;
    }
    expect(s.ignited).toBe(true);
    expect(s.temperature).toBe(100);
    expect(fireProgress(s)).toBe(1);
  });

  it('点燃后状态冻结（幂等）', () => {
    const ignited = { temperature: 100, ignited: true };
    expect(tickFire(ignited, 0, 5)).toEqual(ignited);
    expect(tickFire(ignited, 1, 5)).toEqual(ignited);
  });

  it('低聚焦(净散热)不会点燃', () => {
    let s = createFire();
    for (let i = 0; i < 100; i++) s = tickFire(s, 0.2, 0.1); // 0.2*15=3 < 6
    expect(s.ignited).toBe(false);
    expect(s.temperature).toBe(0);
  });

  it('加热阈值由升温和散热共同决定', () => {
    expect(HEAT_THRESHOLD).toBeCloseTo(COOL_RATE / HEAT_RATE, 5);
    expect(isHeating(HEAT_THRESHOLD / 2)).toBe(false);
    expect(isHeating(HEAT_THRESHOLD + 0.01)).toBe(true);
    expect(heatDelta(1, 1)).toBeGreaterThan(0);
    expect(heatDelta(0, 1)).toBeLessThan(0);
  });

  it('tickFire 不修改原状态（纯函数）', () => {
    const s = createFire();
    const copy = { ...s };
    tickFire(s, 1, 1);
    expect(s).toEqual(copy);
  });
});

describe('钻木取火：手速→强度', () => {
  it('静止=0，达参考速=1', () => {
    expect(drillQuality(0)).toBe(0);
    expect(drillQuality(DRILL_REF)).toBe(1);
  });
  it('超参考速也封顶 1', () => {
    expect(drillQuality(DRILL_REF * 3)).toBe(1);
  });
  it('半速约 0.5', () => {
    expect(drillQuality(DRILL_REF / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('镁棒取火：火花热衰减', () => {
  it('按 SPARK_DECAY 线性衰减', () => {
    expect(decayHeat(1, 0.5)).toBeCloseTo(1 - SPARK_DECAY * 0.5, 5);
  });
  it('不会衰减到负数', () => {
    expect(decayHeat(0.1, 1)).toBe(0);
  });
  it('刮火花回补的热能推动点燃', () => {
    let s = createFire();
    let heat = 0;
    // 玩家密集快刮：每 3 帧(≈3次/秒)刮一下
    for (let i = 0; i < 80; i++) {
      if (i % 3 === 0) heat = Math.min(1, heat + 0.5);
      heat = decayHeat(heat, 0.1);
      s = tickFire(s, heat, 0.1);
    }
    expect(s.temperature).toBeGreaterThan(0);
  });
});
