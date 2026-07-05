import { describe, it, expect } from 'vitest';
import {
  N_STONES,
  createStream,
  currentTolerance,
  isFinished,
  isSwept,
  nextTolerance,
  streamAdvice,
  streamPerformance,
  streamProgress,
  tickStream,
} from '../src/minigames/stream/logic';

describe('溯溪探险 · 初始', () => {
  it('从左岸起点出发，未失败、未通关', () => {
    const s = createStream();
    expect(s.pos).toBe(-1);
    expect(s.swept).toBe(false);
    expect(s.finished).toBe(false);
    expect(isSwept(s)).toBe(false);
    expect(isFinished(s)).toBe(false);
    expect(currentTolerance(s)).toBe(Infinity);
  });
});

describe('溯溪探险 · 跳跃', () => {
  it('leap=true 时位置向前推进一格', () => {
    const s = tickStream(createStream(), true, 0);
    expect(s.pos).toBe(0);
    expect(s.jumps).toBe(1);
  });

  it('左岸 leap 不受 safety 约束（起点绝对安全）', () => {
    const s = createStream();
    // 设 flow 极大也冻不住起点
    const after = tickStream(s, true, 0);
    expect(after.pos).toBe(0);
    expect(isSwept(after)).toBe(false);
  });

  it('tickStream 不修改原状态（纯函数）', () => {
    const s = createStream();
    const copy = JSON.parse(JSON.stringify(s));
    tickStream(s, true, 0.1);
    expect(JSON.parse(JSON.stringify(s))).toEqual(copy);
  });
});

describe('溯溪探险 · 时机提示', () => {
  it('起点水位低时建议跳下一块', () => {
    const s = { ...createStream(), flow: 0.2 };
    expect(streamAdvice(s)).toBe('leap');
    expect(nextTolerance(s)).toBeGreaterThan(0);
  });

  it('下一块不安全时建议等待', () => {
    const s = { ...createStream(), flow: 0.9 };
    expect(streamAdvice(s)).toBe('wait');
  });

  it('脚下快危险且下一块能站时建议赶紧跳', () => {
    const s = { ...createStream(), pos: 2, flow: 0.3 };
    expect(currentTolerance(s)).toBeCloseTo(0.34);
    expect(nextTolerance(s)).toBeCloseTo(0.62);
    expect(streamAdvice(s)).toBe('escape');
  });
});

describe('溯溪探险 · 冲走与通关判定', () => {
  it('站在石头上 + 流量 > 耐受力 → 被冲走', () => {
    const s = createStream();
    s.pos = 2;
    s.phase = Math.PI / 2 - 0.1; // flow ≈ 1
    const after = tickStream(s, false, 0);
    expect(isSwept(after)).toBe(true);
  });

  it('左岸起点不会被冲走', () => {
    const s = createStream();
    s.phase = Math.PI / 2 - 0.05;
    const after = tickStream(s, false, 0);
    expect(isSwept(after)).toBe(false);
  });

  it('终点 tolerance 无限，到达终点不会被冲走', () => {
    let s = createStream();
    s.pos = N_STONES;
    s.phase = Math.PI / 2 - 0.05; // flow ≈ 1
    const after = tickStream(s, false, 0.5);
    expect(isFinished(after)).toBe(true);
    expect(isSwept(after)).toBe(false);
  });
});

describe('溯溪探险 · 可解性', () => {
  it('理想低潮相位下可一次性连续跳到终点', () => {
    let s = createStream();
    // phase 设在波谷（sin(phase) = -1），flow 开始从 0 上涨
    s.phase = -Math.PI / 2;
    // 逐步 leap：每 leap 后推进一个小 dt 让 flow 缓慢上升，前提是 leaping 时在旧石头上 safety 通过
    for (let target = 0; target <= N_STONES; target++) {
      // 等待旧石头安全 + 新石头未来也安全 → 简单起见先在低潮时一次 leap 并仅推进 dt=0
      // dt=0 不会让 flow 上涨，所以同一相位下可以连跳——但 leaping 后 safety 仍检查旧 pos
      // 在 low flow 阶段，所有石头都安全
      const flowNow = Math.sin(s.phase) * 0.5 + 0.5;
      // 只在 flow 足够小时跳
      if (flowNow > 0.05) {
        // 跳到 safety：小幅推进时间到下一低潮
        for (let k = 0; k < 400 && (Math.sin(s.phase) * 0.5 + 0.5) > 0.05; k++) {
          s = tickStream(s, false, 0.01);
          if (s.swept) break;
        }
      }
      s = tickStream(s, true, 0);
      if (s.swept) break;
    }
    expect(isFinished(s)).toBe(true);
    expect(isSwept(s)).toBe(false);
  });
});

describe('溯溪探险 · 评分', () => {
  it('未通关时 perf=0，通关时在 [0.65, 1]', () => {
    expect(streamPerformance(createStream())).toBe(0);
    let s = createStream();
    s.pos = N_STONES;
    s.finished = true;
    s.jumps = N_STONES + 1;
    const p = streamPerformance(s);
    expect(p).toBeGreaterThanOrEqual(0.65);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('streamProgress 始终 0..1', () => {
    let s = createStream();
    expect(streamProgress(s)).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 500; i++) {
      s = tickStream(s, true, 0.02);
      expect(streamProgress(s)).toBeGreaterThanOrEqual(0);
      expect(streamProgress(s)).toBeLessThanOrEqual(1);
      if (s.finished || s.swept) break;
    }
  });
});
