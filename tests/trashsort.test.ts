import { describe, it, expect } from 'vitest';
import {
  TRASH_ITEMS,
  BINS,
  binLabel,
  correctionText,
  isCorrect,
  comboMultiplier,
  sortResult,
  PASS_ACCURACY,
  type BinType,
} from '../src/minigames/trashsort/logic';

describe('trashsort · 数据完整性', () => {
  it('每个物品的 bin 都是合法桶类型', () => {
    const valid = new Set<BinType>(BINS.map((b) => b.type));
    for (const it of TRASH_ITEMS) expect(valid.has(it.bin)).toBe(true);
  });
  it('三类桶都有物品覆盖', () => {
    for (const b of BINS) {
      expect(TRASH_ITEMS.some((it) => it.bin === b.type)).toBe(true);
      expect(b.hint.length).toBeGreaterThan(0);
    }
  });
  it('有害垃圾条目使用明确名称，避免普通灯泡/普通温度计歧义', () => {
    expect(TRASH_ITEMS).toContainEqual({ name: '过期药片', emoji: '💊', bin: 'harmful' });
    expect(TRASH_ITEMS).toContainEqual({ name: '废荧光灯管', emoji: '💡', bin: 'harmful' });
    expect(TRASH_ITEMS).toContainEqual({ name: '水银温度计', emoji: '🌡️', bin: 'harmful' });
    expect(TRASH_ITEMS.some((it) => it.name === '灯泡')).toBe(false);
    expect(TRASH_ITEMS.some((it) => it.name === '温度计')).toBe(false);
  });
});

describe('trashsort · isCorrect', () => {
  it('丢对桶 = true', () => {
    expect(isCorrect({ name: '瓶', emoji: '🥤', bin: 'recycle' }, 'recycle')).toBe(true);
  });
  it('丢错桶 = false', () => {
    expect(isCorrect({ name: '瓶', emoji: '🥤', bin: 'recycle' }, 'harmful')).toBe(false);
  });
});

describe('trashsort · 反馈文案', () => {
  it('binLabel 返回桶中文名', () => {
    expect(binLabel('recycle')).toBe('可回收');
    expect(binLabel('kitchen')).toBe('厨余');
    expect(binLabel('harmful')).toBe('有害');
  });
  it('correctionText 明确告诉玩家物品应该进哪个桶', () => {
    expect(correctionText({ name: '废电池', emoji: '🔋', bin: 'harmful' })).toBe(
      '废电池 应进「有害」',
    );
  });
});

describe('trashsort · comboMultiplier', () => {
  it('0 连击 = 1 倍', () => {
    expect(comboMultiplier(0)).toBe(1);
  });
  it('连击越高倍率越高，封顶 2 倍', () => {
    expect(comboMultiplier(3)).toBeCloseTo(1.6);
    expect(comboMultiplier(5)).toBeCloseTo(2);
    expect(comboMultiplier(99)).toBeCloseTo(2);
  });
  it('负数按 0 处理', () => {
    expect(comboMultiplier(-3)).toBe(1);
  });
});

describe('trashsort · sortResult', () => {
  it('全对 → 满分成功', () => {
    const r = sortResult([true, true, true, true]);
    expect(r.accuracy).toBe(1);
    expect(r.perf).toBe(1);
    expect(r.success).toBe(true);
  });
  it('正确率低于阈值 → 不成功', () => {
    const r = sortResult([true, false, false, false]);
    expect(r.accuracy).toBe(0.25);
    expect(r.success).toBe(false);
  });
  it('恰好达阈值 → 成功', () => {
    const r = sortResult([true, true, false, false]);
    expect(r.accuracy).toBeGreaterThanOrEqual(PASS_ACCURACY);
    expect(r.success).toBe(true);
  });
  it('空输入不崩', () => {
    const r = sortResult([]);
    expect(r.total).toBe(0);
    expect(r.accuracy).toBe(0);
  });
});
