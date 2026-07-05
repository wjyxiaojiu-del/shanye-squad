import { describe, it, expect } from 'vitest';
import {
  BEST_HIGH,
  BEST_LOW,
  CookState,
  OVERHEAT,
  addWood,
  cookAdvice,
  cookProgress,
  createCook,
  flip,
  inBestZone,
  isCooked,
  tickCook,
} from '../src/minigames/cooking/logic';

describe('竹筒饭 · 火候区间', () => {
  it('最佳区间判定', () => {
    expect(inBestZone(BEST_LOW)).toBe(true);
    expect(inBestZone(BEST_HIGH)).toBe(true);
    expect(inBestZone(BEST_LOW - 1)).toBe(false);
    expect(inBestZone(BEST_HIGH + 1)).toBe(false);
  });
});

describe('竹筒饭 · 初始与操作', () => {
  it('初始未熟未糊', () => {
    const s = createCook();
    expect(s.cookedness).toBe(0);
    expect(s.burn).toBe(0);
    expect(isCooked(s)).toBe(false);
    expect(cookProgress(s)).toBe(0);
  });

  it('添柴抬升火力', () => {
    const s = createCook();
    const s2 = addWood(s);
    expect(s2.heat).toBeGreaterThan(s.heat);
  });

  it('火力封顶 100', () => {
    let s = createCook();
    for (let i = 0; i < 20; i++) s = addWood(s);
    expect(s.heat).toBe(100);
  });

  it('翻面切换受热面并重置暴露度', () => {
    let s = createCook();
    s = { ...s, exposure: 0.8 };
    const f = flip(s);
    expect(f.side).toBe(1);
    expect(f.exposure).toBe(0);
    expect(flip(f).side).toBe(0);
  });

  it('addWood/flip 不修改原状态（纯函数）', () => {
    const s = createCook();
    const copy = { ...s };
    addWood(s);
    flip(s);
    expect(s).toEqual(copy);
  });
});

describe('竹筒饭 · 操作建议', () => {
  it('初始火候偏低时建议添柴', () => {
    expect(cookAdvice(createCook())).toBe('add-wood');
  });

  it('同一面暴露太久时建议翻面', () => {
    const s: CookState = { ...createCook(), temp: 66, heat: 66, exposure: 0.8 };
    expect(cookAdvice(s)).toBe('flip');
  });

  it('过热时建议先降火等待', () => {
    const s: CookState = { ...createCook(), temp: OVERHEAT + 2, heat: 95 };
    expect(cookAdvice(s)).toBe('cool');
  });

  it('绿区且不危险时建议稳住', () => {
    const s: CookState = { ...createCook(), temp: 66, heat: 66 };
    expect(cookAdvice(s)).toBe('hold');
  });
});

describe('竹筒饭 · 温度演化', () => {
  it('不添柴时火力衰减、温度回落', () => {
    let s = createCook();
    s = { ...s, heat: 80, temp: 80 };
    s = tickCook(s, 1);
    expect(s.heat).toBeLessThan(80);
  });

  it('温度趋向火力', () => {
    let s = createCook();
    s = { ...s, heat: 90, temp: 40 };
    const before = s.temp;
    s = tickCook(s, 0.5);
    expect(s.temp).toBeGreaterThan(before);
  });

  it('在最佳区间内熟度增长', () => {
    let s = createCook();
    s = { ...s, heat: 65, temp: 65 };
    s = tickCook(s, 0.5);
    expect(s.cookedness).toBeGreaterThan(0);
  });

  it('过热时焦度增长', () => {
    let s = createCook();
    s = { ...s, heat: 95, temp: OVERHEAT + 5, exposure: 0.5 };
    s = tickCook(s, 0.5);
    expect(s.burn).toBeGreaterThan(0);
  });

  it('久不翻面(暴露度高)焦得更快', () => {
    const base: CookState = { ...createCook(), heat: 95, temp: OVERHEAT + 8 };
    const low = tickCook({ ...base, exposure: 0 }, 0.5).burn;
    const high = tickCook({ ...base, exposure: 1 }, 0.5).burn;
    expect(high).toBeGreaterThan(low);
  });
});

describe('竹筒饭 · 成败', () => {
  it('控火保持在最佳区间可烤熟', () => {
    let s = createCook();
    let guard = 0;
    while (!s.finished && !s.burnt && guard < 2000) {
      // 玩家策略：温度低于最佳下限就添柴，否则等
      if (s.temp < BEST_LOW + 5) s = addWood(s);
      s = tickCook(s, 0.1);
      guard++;
    }
    expect(s.finished).toBe(true);
    expect(s.burnt).toBe(false);
    expect(cookProgress(s)).toBe(1);
  });

  it('一路猛添柴会过热烤糊', () => {
    let s = createCook();
    let guard = 0;
    while (!s.finished && !s.burnt && guard < 2000) {
      s = addWood(s); // 每帧都添柴
      s = tickCook(s, 0.1);
      guard++;
    }
    expect(s.burnt).toBe(true);
  });

  it('烤糊后 tick 冻结', () => {
    const burnt: CookState = { ...createCook(), burn: 100, burnt: true };
    expect(tickCook(burnt, 1)).toEqual(burnt);
  });

  it('tickCook 不修改原状态（纯函数）', () => {
    const s = createCook();
    const copy = { ...s };
    tickCook(s, 1);
    expect(s).toEqual(copy);
  });
});
