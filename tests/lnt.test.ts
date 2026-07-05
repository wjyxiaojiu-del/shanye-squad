import { describe, it, expect } from 'vitest';
import {
  PRINCIPLES,
  actionTextForKind,
  clickItem,
  cleanedCount,
  createLnt,
  isDone,
  isLitter,
  isNatural,
  litterTotal,
  lntProgress,
  principleByN,
  principleForKind,
} from '../src/minigames/lnt/logic';

describe('无痕山林 · 物品分类', () => {
  it('垃圾/痕迹归为可清理', () => {
    for (const k of ['trash-peel', 'trash-bottle', 'trash-can', 'trash-bag', 'campfire', 'carved-tree'] as const) {
      expect(isLitter(k)).toBe(true);
      expect(isNatural(k)).toBe(false);
    }
  });
  it('石头/野花/蘑菇归为天然物', () => {
    for (const k of ['rock', 'flower', 'mushroom'] as const) {
      expect(isNatural(k)).toBe(true);
      expect(isLitter(k)).toBe(false);
    }
  });
  it('每类物品都有明确行动提示', () => {
    expect(actionTextForKind('trash-bottle')).toBe('带走垃圾');
    expect(actionTextForKind('campfire')).toBe('彻底熄灭火堆');
    expect(actionTextForKind('carved-tree')).toBe('不要刻画树木');
    expect(actionTextForKind('flower')).toContain('不采摘');
  });
});

describe('无痕山林 · 关卡', () => {
  it('初始有多个痕迹、未完成', () => {
    const s = createLnt();
    expect(litterTotal(s)).toBeGreaterThan(0);
    expect(isDone(s)).toBe(false);
    expect(cleanedCount(s)).toBe(0);
    expect(lntProgress(s)).toBe(0);
  });

  it('同时包含天然干扰物', () => {
    const s = createLnt();
    expect(s.items.some((it) => isNatural(it.kind))).toBe(true);
  });
});

describe('无痕山林 · 点击', () => {
  it('点痕迹 → 清理成功', () => {
    const s0 = createLnt();
    const litter = s0.items.find((it) => isLitter(it.kind))!;
    const out = clickItem(s0, litter.id);
    expect(out.result).toBe('cleaned');
    expect(out.state.items.find((it) => it.id === litter.id)!.cleaned).toBe(true);
    expect(cleanedCount(out.state)).toBe(1);
  });

  it('点天然物 → 不清理，返回 natural', () => {
    const s0 = createLnt();
    const nat = s0.items.find((it) => isNatural(it.kind))!;
    const out = clickItem(s0, nat.id);
    expect(out.result).toBe('natural');
    expect(cleanedCount(out.state)).toBe(0);
    expect(out.state).toBe(s0); // 未改变
  });

  it('重复点已清理的痕迹 → already', () => {
    const s0 = createLnt();
    const litter = s0.items.find((it) => isLitter(it.kind))!;
    const once = clickItem(s0, litter.id).state;
    const twice = clickItem(once, litter.id);
    expect(twice.result).toBe('already');
  });

  it('点不存在的 id → miss', () => {
    const s0 = createLnt();
    expect(clickItem(s0, 999).result).toBe('miss');
  });

  it('clickItem 不修改原状态（纯函数）', () => {
    const s0 = createLnt();
    const litter = s0.items.find((it) => isLitter(it.kind))!;
    const before = s0.items.map((it) => it.cleaned);
    clickItem(s0, litter.id);
    expect(s0.items.map((it) => it.cleaned)).toEqual(before);
  });

  it('清完所有痕迹 → 通关；天然物无需处理', () => {
    let s = createLnt();
    for (const it of s.items) {
      if (isLitter(it.kind)) s = clickItem(s, it.id).state;
    }
    expect(isDone(s)).toBe(true);
    expect(lntProgress(s)).toBe(1);
    // 天然物仍然在场、未被清理
    expect(s.items.some((it) => isNatural(it.kind) && !it.cleaned)).toBe(true);
  });

  it('只清一部分不会通关', () => {
    const s0 = createLnt();
    const litter = s0.items.find((it) => isLitter(it.kind))!;
    const out = clickItem(s0, litter.id);
    expect(isDone(out.state)).toBe(false);
  });
});

describe('无痕山林 · LNT 七准则', () => {
  it('恰好七条准则，编号 1..7', () => {
    expect(PRINCIPLES).toHaveLength(7);
    expect(PRINCIPLES.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('每条准则都有标题和描述', () => {
    for (const p of PRINCIPLES) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.desc.length).toBeGreaterThan(0);
    }
  });

  it('principleByN 取到对应准则', () => {
    expect(principleByN(3).title).toContain('垃圾');
    expect(principleByN(5).title).toContain('火');
  });

  it('未知编号抛错', () => {
    expect(() => principleByN(9)).toThrow();
  });

  it('垃圾类痕迹关联准则3(处理垃圾)', () => {
    for (const k of ['trash-peel', 'trash-bottle', 'trash-can', 'trash-bag'] as const) {
      expect(principleForKind(k)).toBe(3);
    }
  });

  it('火堆关联准则5(减少用火)、刻树关联准则4(保持原貌)', () => {
    expect(principleForKind('campfire')).toBe(5);
    expect(principleForKind('carved-tree')).toBe(4);
  });

  it('天然物关联准则4(保持自然原貌)', () => {
    for (const k of ['rock', 'flower', 'mushroom'] as const) {
      expect(principleForKind(k)).toBe(4);
    }
  });
});
