import { describe, it, expect } from 'vitest';
import {
  CORRECT_ORDER,
  LAYERS,
  layerById,
  nextExpected,
  isCorrectNext,
  isComplete,
  filterResult,
} from '../src/minigames/waterfilter/logic';

describe('waterfilter · 数据完整性', () => {
  it('倒置滤水瓶应从下往上铺：纱布→木炭→细沙→小石子→大石子', () => {
    expect(CORRECT_ORDER).toEqual(['cloth', 'charcoal', 'sand', 'pebble', 'gravel']);
  });
  it('CORRECT_ORDER 里每个 id 都能在 LAYERS 找到', () => {
    for (const id of CORRECT_ORDER) expect(layerById(id)).toBeDefined();
  });
  it('LAYERS 数量与正确顺序一致', () => {
    expect(LAYERS.length).toBe(CORRECT_ORDER.length);
  });
});

describe('waterfilter · nextExpected', () => {
  it('从第 0 层开始按顺序给出', () => {
    expect(nextExpected(0)).toBe(CORRECT_ORDER[0]);
    expect(nextExpected(2)).toBe(CORRECT_ORDER[2]);
  });
  it('放完后返回 null', () => {
    expect(nextExpected(CORRECT_ORDER.length)).toBeNull();
  });
});

describe('waterfilter · isCorrectNext', () => {
  it('放对当前层 = true', () => {
    expect(isCorrectNext(0, CORRECT_ORDER[0])).toBe(true);
  });
  it('放错层 = false', () => {
    expect(isCorrectNext(0, CORRECT_ORDER[1])).toBe(false);
  });
});

describe('waterfilter · isComplete', () => {
  it('未铺满 false，铺满 true', () => {
    expect(isComplete(CORRECT_ORDER.length - 1)).toBe(false);
    expect(isComplete(CORRECT_ORDER.length)).toBe(true);
  });
});

describe('waterfilter · filterResult', () => {
  it('零失误 → 满分', () => {
    const r = filterResult(0);
    expect(r.perf).toBe(1);
    expect(r.success).toBe(true);
  });
  it('失误越多分越低，但有下限 0.2', () => {
    expect(filterResult(2).perf).toBeCloseTo(0.7);
    expect(filterResult(100).perf).toBe(0.2);
  });
  it('完成始终算成功（鼓励式）', () => {
    expect(filterResult(50).success).toBe(true);
  });
});

describe('waterfilter · 模拟一局(只放对的)', () => {
  it('依次放对可铺满', () => {
    let placed = 0;
    for (const step of CORRECT_ORDER) {
      expect(isCorrectNext(placed, step)).toBe(true);
      placed++;
    }
    expect(isComplete(placed)).toBe(true);
  });
});
