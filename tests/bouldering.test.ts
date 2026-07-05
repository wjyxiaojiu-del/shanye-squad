import { describe, it, expect } from 'vitest';
import {
  ClimbState,
  COLS,
  ROWS,
  WALL_W,
  buildWall,
  createClimb,
  currentPoint,
  highestReachableHold,
  isAtTop,
  moveTo,
  progress,
  reachable,
  reachableIds,
} from '../src/minigames/bouldering/logic';

describe('抱石岩壁生成', () => {
  it('铺满整面墙（COLS×ROWS 个岩点）', () => {
    const holds = buildWall();
    expect(holds).toHaveLength(COLS * ROWS);
  });

  it('岩点水平坐标都在墙内', () => {
    for (const h of buildWall()) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThanOrEqual(WALL_W);
    }
  });

  it('生成是确定性的（两次一致）', () => {
    const a = buildWall();
    const b = buildWall();
    expect(a).toEqual(b);
  });

  it('岩点类型多样（不止一种）', () => {
    const kinds = new Set(buildWall().map((h) => h.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    expect(kinds).toContain('sloper');
    expect(kinds).toContain('pinch');
    expect(kinds).toContain('pocket');
    expect(kinds).toContain('volume');
  });
});

describe('抱石攀爬逻辑（自由选点）', () => {
  it('初始在地面、未完成', () => {
    const s = createClimb();
    expect(s.currentId).toBe(-1);
    expect(s.finished).toBe(false);
    expect(isAtTop(s)).toBe(false);
    expect(progress(s)).toBe(0);
  });

  it('起步时底部有够得着的岩点', () => {
    const s = createClimb();
    expect(reachableIds(s).length).toBeGreaterThan(0);
  });

  it('点够得着的岩点会移动过去', () => {
    const s0 = createClimb();
    const target = reachableIds(s0)[0];
    const s1 = moveTo(s0, target);
    expect(s1.currentId).toBe(target);
  });

  it('点够不着的岩点无变化', () => {
    const s0 = createClimb();
    const reach = new Set(reachableIds(s0));
    const far = s0.holds.find((h) => !reach.has(h.id) && h.id !== s0.currentId)!;
    const s1 = moveTo(s0, far.id);
    expect(s1).toBe(s0);
  });

  it('moveTo 不修改原状态（纯函数）', () => {
    const s0 = createClimb();
    const target = reachableIds(s0)[0];
    const before = s0.currentId;
    moveTo(s0, target);
    expect(s0.currentId).toBe(before);
  });

  it('够得着范围始终在 REACH 半径内', () => {
    const s = createClimb();
    const cur = currentPoint(s);
    for (const id of reachableIds(s)) {
      const h = s.holds.find((x) => x.id === id)!;
      const d = Math.hypot(cur.x - h.x, cur.worldY - h.worldY);
      expect(d).toBeLessThanOrEqual(152 + 0.001);
    }
  });

  it('highestReachableHold 返回当前能到达的最高岩点', () => {
    const s = createClimb();
    const best = highestReachableHold(s);
    expect(best).toBeTruthy();
    const bestY = Math.min(...s.holds.filter((h) => reachable(s, h.id)).map((h) => h.worldY));
    expect(best?.worldY).toBe(bestY);
  });

  it('贪心一路选最高的够得着点，能登顶通关（岩壁可解）', () => {
    let s: ClimbState = createClimb();
    let guard = 0;
    while (!s.finished && guard < 200) {
      const cand = highestReachableHold(s);
      expect(cand).toBeTruthy(); // 任何时候都有得爬，不会卡死
      s = moveTo(s, cand!.id);
      guard++;
    }
    expect(s.finished).toBe(true);
    expect(progress(s)).toBe(1);
  });
});
