import { describe, it, expect } from 'vitest';
import { clamp, isWithinRange, lerp, nearestInteractable } from '../src/core/collision';

describe('几何/交互工具', () => {
  it('clamp 夹取区间', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('lerp 线性插值', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('isWithinRange 水平邻近', () => {
    expect(isWithinRange(100, 150, 60)).toBe(true);
    expect(isWithinRange(100, 170, 60)).toBe(false);
    expect(isWithinRange(100, 100, 0)).toBe(true);
  });

  describe('nearestInteractable', () => {
    const targets = [{ x: 0 }, { x: 100 }, { x: 220 }];

    it('无目标在范围内返回 -1', () => {
      expect(nearestInteractable(500, targets, 50)).toBe(-1);
    });

    it('返回范围内最近目标的索引', () => {
      expect(nearestInteractable(90, targets, 50)).toBe(1);
      expect(nearestInteractable(10, targets, 50)).toBe(0);
    });

    it('两个都在范围内时取更近的', () => {
      // 玩家 60：到 0 距离 60，到 100 距离 40 → 取索引 1
      expect(nearestInteractable(60, [{ x: 0 }, { x: 100 }], 80)).toBe(1);
    });
  });
});
