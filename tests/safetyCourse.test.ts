import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage, SaveData } from '../src/state/SaveData';
import {
  SAFETY_CHAPTERS,
  chapterById,
  chapterCount,
} from '../src/state/safetyChapters';

function freshSave() {
  return new SaveData(new MemoryStorage());
}

describe('安全小课堂 · 章节内容', () => {
  it('8 个章节齐套 + 每章都有测验和徽章 id', () => {
    expect(chapterCount()).toBe(8);
    for (const ch of SAFETY_CHAPTERS) {
      expect(ch.id.length).toBeGreaterThan(0);
      expect(ch.badgeId.length).toBeGreaterThan(0);
      expect(ch.title.length).toBeGreaterThan(0);
      expect(ch.body.length).toBeGreaterThan(0);
      expect(ch.quiz.question.length).toBeGreaterThan(0);
      expect(ch.quiz.choices).toHaveLength(4);
      expect(ch.quiz.answer).toMatch(/^[A-D]$/);
    }
  });

  it('chapterById 能拿到对应章节', () => {
    for (const ch of SAFETY_CHAPTERS) {
      expect(chapterById(ch.id)).toBe(ch);
    }
    expect(chapterById('nope')).toBeUndefined();
  });

  it('SOS 正确选项明确区分短音和长音', () => {
    const sos = chapterById('sos');
    const answer = sos?.quiz.choices.find((c) => c.key === sos.quiz.answer)?.text ?? '';
    expect(answer).toContain('短短短');
    expect(answer).toContain('长长长');
  });
});

describe('SaveData · SafetyProgress', () => {
  let save: SaveData;
  beforeEach(() => {
    save = freshSave();
  });

  it('初始：0 徽章 / 0 章节', () => {
    expect(save.safetyBadgeCount()).toBe(0);
    expect(save.safetyChapterCompletedCount()).toBe(0);
    expect(save.badgeUnlocked('safety-gear')).toBe(false);
    expect(save.chapterCompleted('gear')).toBe(false);
  });

  it('完成章节 → chapterCompleted 变为 true', () => {
    save.completeChapter('gear');
    expect(save.chapterCompleted('gear')).toBe(true);
    expect(save.safetyChapterCompletedCount()).toBe(1);
  });

  it('完成章节不重复计数', () => {
    save.completeChapter('gear');
    save.completeChapter('gear');
    expect(save.safetyChapterCompletedCount()).toBe(1);
  });

  it('解锁徽章 → badgeUnlocked 为 true + 写入 stickers 解锁集合', () => {
    save.unlockBadge('safety-gear');
    expect(save.badgeUnlocked('safety-gear')).toBe(true);
    expect(save.isUnlocked('safety-gear')).toBe(true);
    expect(save.safetyBadgeCount()).toBe(1);
  });

  it('同徽章重复解锁不重复写 stickers', () => {
    save.unlockBadge('safety-gear');
    save.unlockBadge('safety-gear');
    save.unlockBadge('safety-gear');
    expect(save.safetyBadgeCount()).toBe(1);
    expect(save.unlockedIds().filter((x) => x === 'safety-gear')).toHaveLength(1);
  });

  it('progress 持久化到新实例', () => {
    const storage = new MemoryStorage();
    const a = new SaveData(storage);
    a.completeChapter('gear');
    a.completeChapter('water');
    a.unlockBadge('safety-gear');
    const b = new SaveData(storage);
    expect(b.chapterCompleted('gear')).toBe(true);
    expect(b.chapterCompleted('water')).toBe(true);
    expect(b.chapterCompleted('pack')).toBe(false);
    expect(b.badgeUnlocked('safety-gear')).toBe(true);
    expect(b.safetyBadgeCount()).toBe(1);
    expect(b.safetyChapterCompletedCount()).toBe(2);
  });

  it('reset 同时清空 safety 进度', () => {
    save.completeChapter('gear');
    save.unlockBadge('safety-gear');
    save.reset();
    expect(save.safetyBadgeCount()).toBe(0);
    expect(save.safetyChapterCompletedCount()).toBe(0);
  });

  it('解析损坏的 progress JSON 不抛错', () => {
    const storage = new MemoryStorage();
    storage.setItem('shanye-safety-progress:v1', '{corrupt!!!!!json');
    const s = new SaveData(storage);
    expect(s.safetyBadgeCount()).toBe(0);
    expect(s.safetyChapterCompletedCount()).toBe(0);
  });

  it('chapters / badges 返回数组', () => {
    save.completeChapter('gear');
    save.unlockBadge('safety-pack');
    expect(save.safetyChapters()).toContain('gear');
    expect(save.safetyBadges()).toContain('safety-pack');
  });
});
