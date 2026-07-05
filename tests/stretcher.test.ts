import { describe, it, expect } from 'vitest';
import {
  PartId,
  STEPS,
  createStretcher,
  currentStep,
  currentStepIndex,
  isBuilt,
  isPlaced,
  placePart,
  stepByPart,
  stretcherProgress,
} from '../src/minigames/stretcher/logic';

const ORDER: PartId[] = ['pole-left', 'pole-right', 'shirt', 'pants', 'rope'];

describe('简易担架 · 步骤定义', () => {
  it('五个有序步骤', () => {
    expect(STEPS).toHaveLength(5);
    expect(STEPS.map((s) => s.part)).toEqual(ORDER);
  });
  it('每步有材料名、说明、槽位', () => {
    for (const s of STEPS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.hint.length).toBeGreaterThan(0);
      expect(typeof s.slot.x).toBe('number');
    }
  });
  it('stepByPart 取到对应步骤', () => {
    expect(stepByPart('rope').label).toContain('绳');
  });
});

describe('简易担架 · 初始', () => {
  it('空、未建成、当前步为第一步', () => {
    const s = createStretcher();
    expect(s.placed).toEqual([]);
    expect(isBuilt(s)).toBe(false);
    expect(currentStepIndex(s)).toBe(0);
    expect(currentStep(s)?.part).toBe('pole-left');
    expect(stretcherProgress(s)).toBe(0);
  });
});

describe('简易担架 · 顺序组装', () => {
  it('按正确顺序逐步放置成功', () => {
    let s = createStretcher();
    ORDER.forEach((part, i) => {
      const out = placePart(s, part);
      expect(out.result).toBe('placed');
      s = out.state;
      expect(currentStepIndex(s)).toBe(i + 1);
    });
    expect(isBuilt(s)).toBe(true);
    expect(stretcherProgress(s)).toBe(1);
  });

  it('顺序不对被拒绝（wrong-order），状态不变', () => {
    const s = createStretcher();
    const out = placePart(s, 'rope'); // 第一步应是 pole-left
    expect(out.result).toBe('wrong-order');
    expect(out.state).toBe(s);
  });

  it('放过的部件再放返回 already', () => {
    let s = createStretcher();
    s = placePart(s, 'pole-left').state;
    const out = placePart(s, 'pole-left');
    expect(out.result).toBe('already');
  });

  it('isPlaced 正确反映已放部件', () => {
    let s = createStretcher();
    expect(isPlaced(s, 'pole-left')).toBe(false);
    s = placePart(s, 'pole-left').state;
    expect(isPlaced(s, 'pole-left')).toBe(true);
  });

  it('建成后再放返回 done', () => {
    let s = createStretcher();
    for (const p of ORDER) s = placePart(s, p).state;
    const out = placePart(s, 'pole-left');
    expect(out.result).toBe('done');
  });

  it('placePart 不修改原状态（纯函数）', () => {
    const s = createStretcher();
    const copy = { placed: [...s.placed], finished: s.finished };
    placePart(s, 'pole-left');
    expect(s).toEqual(copy);
  });

  it('中途进度正确（放两步=2/5）', () => {
    let s = createStretcher();
    s = placePart(s, 'pole-left').state;
    s = placePart(s, 'pole-right').state;
    expect(stretcherProgress(s)).toBeCloseTo(2 / 5, 5);
    expect(isBuilt(s)).toBe(false);
  });
});
