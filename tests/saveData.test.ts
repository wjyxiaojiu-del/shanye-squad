import { describe, it, expect } from 'vitest';
import { MemoryStorage, SaveData } from '../src/state/SaveData';

describe('存档 SaveData', () => {
  it('初始为空', () => {
    const s = new SaveData(new MemoryStorage());
    expect(s.unlockedIds()).toEqual([]);
    expect(s.isUnlocked('bouldering')).toBe(false);
  });

  it('解锁后可查询到', () => {
    const s = new SaveData(new MemoryStorage());
    s.unlock('bouldering');
    expect(s.isUnlocked('bouldering')).toBe(true);
    expect(s.unlockedIds()).toEqual(['bouldering']);
  });

  it('重复解锁不产生重复项', () => {
    const s = new SaveData(new MemoryStorage());
    s.unlock('a');
    s.unlock('a');
    expect(s.unlockedIds()).toEqual(['a']);
  });

  it('通过同一存储持久化，新实例可读回', () => {
    const storage = new MemoryStorage();
    const a = new SaveData(storage);
    a.unlock('firestarter');
    const b = new SaveData(storage);
    expect(b.isUnlocked('firestarter')).toBe(true);
  });

  it('reset 清空并落盘', () => {
    const storage = new MemoryStorage();
    const s = new SaveData(storage);
    s.unlock('a');
    s.reset();
    expect(s.unlockedIds()).toEqual([]);
    expect(new SaveData(storage).isUnlocked('a')).toBe(false);
  });

  it('容忍损坏的存储内容', () => {
    const storage = new MemoryStorage();
    storage.setItem('shanye-squad:save:v1', '{不是合法JSON');
    const s = new SaveData(storage);
    expect(s.unlockedIds()).toEqual([]);
  });
});
