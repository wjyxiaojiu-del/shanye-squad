import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage, SaveData } from '../src/state/SaveData';
import { gradeStep, calcResult, clampFire } from '../src/interact/miniCooking';

function freshSave() {
  return new SaveData(new MemoryStorage());
}

describe('SaveData · stamina', () => {
  let save: SaveData;
  beforeEach(() => {
    save = freshSave();
  });

  it('默认 100', () => {
    expect(save.stamina).toBe(100);
  });

  it('consume 不会低于 0', () => {
    save.consumeStamina(30);
    expect(save.stamina).toBe(70);
    save.consumeStamina(100);
    expect(save.stamina).toBe(0);
  });

  it('rest 恢复满', () => {
    save.consumeStamina(50);
    expect(save.stamina).toBe(50);
    save.rest();
    expect(save.stamina).toBe(100);
  });

  it('持久化 stamina 跨实例可读', () => {
    const storage = new MemoryStorage();
    const a = new SaveData(storage);
    a.consumeStamina(40);
    expect(a.stamina).toBe(60);
    const b = new SaveData(storage);
    expect(b.stamina).toBe(60);
    b.rest();
    const c = new SaveData(storage);
    expect(c.stamina).toBe(100);
  });

  it('老存档（无 key）自动补 100', () => {
    const storage = new MemoryStorage();
    // 没有 stamina key
    const s = new SaveData(storage);
    expect(s.stamina).toBe(100);
  });

  it('损坏的 stamina JSON 不抛错', () => {
    const storage = new MemoryStorage();
    storage.setItem('shanye-squad:stamina:v1', 'abc');
    const s = new SaveData(storage);
    expect(s.stamina).toBe(100);
  });
});

describe('miniCooking · gradeStep', () => {
  it('stirFire 在适中火（50%）= 完美/不错', () => {
    const g = gradeStep('stirFire', 50);
    expect(['perfect', 'good']).toContain(g);
  });

  it('stirFire 离线太远 = miss', () => {
    expect(gradeStep('stirFire', 5)).toBe('miss');
    expect(gradeStep('stirFire', 95)).toBe('miss');
  });

  it('边界火力 0 / 100 = miss（烧焦/熄火）', () => {
    expect(gradeStep('stirFire', 0)).toBe('miss');
    expect(gradeStep('flip', 100)).toBe('miss');
  });
});

describe('miniCooking · calcResult', () => {
  it('完美三步 + miss 一步 → 失败', () => {
    const r = calcResult(['perfect', 'perfect', 'good', 'miss']);
    expect(r.success).toBe(false);
  });

  it('无 miss + 多个 good → 成功', () => {
    const r = calcResult(['perfect', 'good', 'good', 'ok']);
    expect(r.success).toBe(true);
    expect(r.staminaRestored).toBeGreaterThanOrEqual(10);
  });

  it('全部 perfect → 满分恢复', () => {
    const r = calcResult(['perfect', 'perfect', 'perfect', 'perfect']);
    expect(r.success).toBe(true);
    expect(r.staminaRestored).toBe(30);
  });
});

describe('miniCooking · clampFire', () => {
  it('边界夹紧', () => {
    expect(clampFire(-10)).toBe(0);
    expect(clampFire(150)).toBe(100);
    expect(clampFire(50)).toBe(50);
  });
});
