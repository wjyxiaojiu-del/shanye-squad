import { describe, it, expect } from 'vitest';
import {
  createRoast,
  tickRoast,
  serveRoast,
  roastResult,
  roastAdvice,
  OVERHEAT,
  GOLDEN_MIN,
  IDEAL_DONE,
} from '../src/minigames/marshmallow/logic';

describe('marshmallow · createRoast', () => {
  it('初始全 0 / 未完成', () => {
    const s = createRoast();
    expect(s).toEqual({ doneness: 0, burn: 0, finished: false, burnt: false });
  });
});

describe('marshmallow · tickRoast', () => {
  it('有热度 → 烤度上升', () => {
    const s = tickRoast(createRoast(), 0.5, 1);
    expect(s.doneness).toBeGreaterThan(0);
    expect(s.burnt).toBe(false);
  });

  it('热度 ≤ OVERHEAT 不积累焦化', () => {
    let s = createRoast();
    for (let i = 0; i < 30; i++) s = tickRoast(s, OVERHEAT, 0.1);
    expect(s.burn).toBe(0);
    expect(s.doneness).toBeGreaterThan(0);
  });

  it('持续过热 → 焦化累积直至烤焦', () => {
    let s = createRoast();
    let ticks = 0;
    while (!s.burnt && ticks < 500) {
      s = tickRoast(s, 1, 0.1);
      ticks++;
    }
    expect(s.burnt).toBe(true);
    expect(s.burn).toBe(100);
  });

  it('离火(低热) → 焦化回落', () => {
    let s = createRoast();
    for (let i = 0; i < 10; i++) s = tickRoast(s, 1, 0.1); // 先攒点焦
    const burned = s.burn;
    expect(burned).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) s = tickRoast(s, 0, 0.1); // 离火
    expect(s.burn).toBeLessThan(burned);
  });

  it('烤焦后状态冻结', () => {
    let s = createRoast();
    while (!s.burnt) s = tickRoast(s, 1, 0.1);
    const frozen = tickRoast(s, 1, 1);
    expect(frozen).toBe(s);
  });

  it('烤度封顶 100', () => {
    let s = createRoast();
    for (let i = 0; i < 100; i++) s = tickRoast(s, OVERHEAT, 0.2); // 高烤度但不焦
    expect(s.doneness).toBeLessThanOrEqual(100);
  });
});

describe('marshmallow · roastAdvice', () => {
  it('刚开始且离火远时建议靠近火', () => {
    expect(roastAdvice(createRoast(), 0)).toBe('move-closer');
  });

  it('热度过高时建议离火', () => {
    expect(roastAdvice(createRoast(), OVERHEAT + 0.1)).toBe('move-away');
  });

  it('接近理想金黄时建议出炉', () => {
    expect(roastAdvice({ doneness: IDEAL_DONE, burn: 0, finished: false, burnt: false }, 0.5)).toBe('serve');
  });

  it('完成态返回 done', () => {
    expect(roastAdvice({ ...createRoast(), finished: true }, 0)).toBe('done');
  });
});

describe('marshmallow · serveRoast', () => {
  it('出炉置 finished', () => {
    const s = serveRoast(createRoast());
    expect(s.finished).toBe(true);
  });
  it('烤焦不能出炉', () => {
    let s = createRoast();
    while (!s.burnt) s = tickRoast(s, 1, 0.1);
    expect(serveRoast(s).finished).toBe(false);
  });
});

describe('marshmallow · roastResult', () => {
  it('烤焦 → 失败 perf 0', () => {
    let s = createRoast();
    while (!s.burnt) s = tickRoast(s, 1, 0.1);
    const r = roastResult(s);
    expect(r.success).toBe(false);
    expect(r.perf).toBe(0);
  });

  it('没烤透(生) → 失败', () => {
    const s = { doneness: GOLDEN_MIN - 10, burn: 0, finished: true, burnt: false };
    expect(roastResult(s).success).toBe(false);
  });

  it('理想金黄 → 成功且高分', () => {
    const s = { doneness: IDEAL_DONE, burn: 0, finished: true, burnt: false };
    const r = roastResult(s);
    expect(r.success).toBe(true);
    expect(r.perf).toBeGreaterThan(0.8);
  });

  it('金黄但偏焦 → 成功但扣分', () => {
    const good = roastResult({ doneness: IDEAL_DONE, burn: 0, finished: true, burnt: false });
    const singed = roastResult({ doneness: IDEAL_DONE, burn: 60, finished: true, burnt: false });
    expect(singed.success).toBe(true);
    expect(singed.perf).toBeLessThan(good.perf);
  });
});
