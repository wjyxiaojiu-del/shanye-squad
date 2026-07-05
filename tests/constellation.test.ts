import { describe, it, expect } from 'vitest';
import {
  DIPPER_STARS,
  DIPPER_ORDER,
  POINTER_STAR_IDS,
  POLARIS,
  nextDipperId,
  isCorrectDipper,
  dipperComplete,
  constellationResult,
  dist,
} from '../src/minigames/constellation/logic';

describe('constellation · 数据完整性', () => {
  it('北斗七星共 7 颗', () => {
    expect(DIPPER_STARS.length).toBe(7);
    expect(DIPPER_ORDER.length).toBe(7);
  });
  it('连线顺序里每个 id 都在星表中', () => {
    const ids = new Set(DIPPER_STARS.map((s) => s.id));
    for (const id of DIPPER_ORDER) expect(ids.has(id)).toBe(true);
  });
  it('指极星是勺口两颗', () => {
    for (const id of POINTER_STAR_IDS) {
      expect(DIPPER_STARS.some((s) => s.id === id)).toBe(true);
    }
  });
  it('归一化坐标都在 0..1', () => {
    for (const s of [...DIPPER_STARS, POLARIS]) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });
});

describe('constellation · 连线顺序', () => {
  it('nextDipperId 依序推进', () => {
    expect(nextDipperId(0)).toBe(DIPPER_ORDER[0]);
    expect(nextDipperId(6)).toBe(DIPPER_ORDER[6]);
  });
  it('连完返回 null', () => {
    expect(nextDipperId(7)).toBeNull();
  });
  it('isCorrectDipper 判定正确的下一颗', () => {
    expect(isCorrectDipper(0, DIPPER_ORDER[0])).toBe(true);
    expect(isCorrectDipper(0, DIPPER_ORDER[3])).toBe(false);
  });
  it('dipperComplete 在连满 7 颗后为真', () => {
    expect(dipperComplete(6)).toBe(false);
    expect(dipperComplete(7)).toBe(true);
  });
  it('完整走一遍', () => {
    let progress = 0;
    for (const id of DIPPER_ORDER) {
      expect(isCorrectDipper(progress, id)).toBe(true);
      progress++;
    }
    expect(dipperComplete(progress)).toBe(true);
  });
});

describe('constellation · 指极星指向北极星（几何合理性）', () => {
  it('勺口两星连线延长方向应接近北极星', () => {
    const a = DIPPER_STARS.find((s) => s.id === POINTER_STAR_IDS[0])!; // 天璇
    const b = DIPPER_STARS.find((s) => s.id === POINTER_STAR_IDS[1])!; // 天枢
    // 从 a→b 的方向延长，应比 b 更接近 POLARIS（即延长线朝北极星）
    const ext = { x: b.x + (b.x - a.x) * 3, y: b.y + (b.y - a.y) * 3 };
    const dExt = dist(ext.x, ext.y, POLARIS.x, POLARIS.y);
    const dB = dist(b.x, b.y, POLARIS.x, POLARIS.y);
    expect(dExt).toBeLessThan(dB);
  });
});

describe('constellation · constellationResult', () => {
  it('零失误 → 满分', () => {
    expect(constellationResult(0).perf).toBe(1);
  });
  it('失误扣分，下限 0.2', () => {
    expect(constellationResult(2).perf).toBeCloseTo(0.76);
    expect(constellationResult(100).perf).toBe(0.2);
  });
  it('完成始终成功', () => {
    expect(constellationResult(9).success).toBe(true);
  });
});
