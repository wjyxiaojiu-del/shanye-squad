import type { SaveDataApi } from '../core/types';

const STORAGE_KEY = 'shanye-squad:save:v1';
const STARS_KEY = 'shanye-squad:stars:v1';
const SAFETY_PROGRESS_KEY = 'shanye-safety-progress:v1';
const STAMINA_KEY = 'shanye-squad:stamina:v1';

/** 安全小课堂章节进度 */
export interface SafetyProgress {
  /** 已完成测验的章节 id */
  completedChapters: string[];
  /** 已解锁的徽章 id（与 completedChapters 同步，但允许解耦） */
  unlockedBadges: string[];
}

/** 最小存储接口，便于测试注入内存实现（无需真实 localStorage / jsdom） */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 存档 —— 存"已解锁贴纸集合"与"每关最佳星级"，用 localStorage 持久化。
 * storage 可注入：浏览器传 window.localStorage，测试传内存 mock。
 */
export class SaveData implements SaveDataApi {
  private unlocked: Set<string>;
  private stars: Record<string, number>;
  private safetyProgress: SafetyProgress;
  private _stamina: number;

  constructor(private storage: StorageLike = window.localStorage) {
    this.unlocked = new Set(this.load());
    this.stars = this.loadStars();
    this.safetyProgress = this.loadSafetyProgress();
    this._stamina = this.loadStamina();
  }

  private load(): string[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private loadStars(): Record<string, number> {
    try {
      const raw = this.storage.getItem(STARS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number') out[k] = v;
        }
        return out;
      }
      return {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
  }

  private persistStars(): void {
    this.storage.setItem(STARS_KEY, JSON.stringify(this.stars));
  }

  // ---- 体力值 ----
  private loadStamina(): number {
    try {
      const raw = this.storage.getItem(STAMINA_KEY);
      if (!raw) return 100;
      const n = Number(raw);
      if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
      return 100;
    } catch {
      return 100;
    }
  }

  private persistStamina(): void {
    this.storage.setItem(STAMINA_KEY, String(this._stamina));
  }

  get stamina(): number {
    return this._stamina;
  }

  /** 消耗体力（玩小游戏调用），不低于 0 */
  consumeStamina(n: number): void {
    this._stamina = Math.max(0, this._stamina - n);
    this.persistStamina();
  }

  /** 睡觉恢复满 */
  rest(): void {
    this._stamina = 100;
    this.persistStamina();
  }

  // ---- 安全小课堂进度 ----
  private loadSafetyProgress(): SafetyProgress {
    try {
      const raw = this.storage.getItem(SAFETY_PROGRESS_KEY);
      if (!raw) return { completedChapters: [], unlockedBadges: [] };
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const cc: string[] = Array.isArray(parsed.completedChapters)
          ? parsed.completedChapters.filter((x: unknown) => typeof x === 'string')
          : [];
        const ub: string[] = Array.isArray(parsed.unlockedBadges)
          ? parsed.unlockedBadges.filter((x: unknown) => typeof x === 'string')
          : [];
        return { completedChapters: cc, unlockedBadges: ub };
      }
      return { completedChapters: [], unlockedBadges: [] };
    } catch {
      return { completedChapters: [], unlockedBadges: [] };
    }
  }

  private persistSafetyProgress(): void {
    this.storage.setItem(
      SAFETY_PROGRESS_KEY,
      JSON.stringify({
        completedChapters: [...new Set(this.safetyProgress.completedChapters)],
        unlockedBadges: [...new Set(this.safetyProgress.unlockedBadges)],
      }),
    );
  }

  /** 章节完成测验；已完成的章节不重复写入 */
  completeChapter(chapterId: string): void {
    if (!this.safetyProgress.completedChapters.includes(chapterId)) {
      this.safetyProgress.completedChapters.push(chapterId);
      this.persistSafetyProgress();
    }
  }

  chapterCompleted(chapterId: string): boolean {
    return this.safetyProgress.completedChapters.includes(chapterId);
  }

  /** 解锁章节徽章（解锁 = 已完成测验 + unlock 到 stickers） */
  unlockBadge(badgeId: string): void {
    if (!this.safetyProgress.unlockedBadges.includes(badgeId)) {
      this.safetyProgress.unlockedBadges.push(badgeId);
      this.unlock(badgeId); // 写进 sticker 系统
      this.persistSafetyProgress();
    }
  }

  badgeUnlocked(badgeId: string): boolean {
    return this.safetyProgress.unlockedBadges.includes(badgeId);
  }

  safetyBadgeCount(): number {
    return this.safetyProgress.unlockedBadges.length;
  }

  safetyChapterCompletedCount(): number {
    return this.safetyProgress.completedChapters.length;
  }

  safetyChapters(): ReadonlyArray<string> {
    return this.safetyProgress.completedChapters;
  }

  safetyBadges(): ReadonlyArray<string> {
    return this.safetyProgress.unlockedBadges;
  }

  isUnlocked(stickerId: string): boolean {
    return this.unlocked.has(stickerId);
  }

  /** 解锁贴纸；已解锁则不重复写盘 */
  unlock(stickerId: string): void {
    if (!this.unlocked.has(stickerId)) {
      this.unlocked.add(stickerId);
      this.persist();
    }
  }

  unlockedIds(): string[] {
    return [...this.unlocked];
  }

  recordStars(gameId: string, stars: number): void {
    const cur = this.stars[gameId] ?? 0;
    if (stars > cur) {
      this.stars[gameId] = stars;
      this.persistStars();
    }
  }

  bestStars(gameId: string): number {
    return this.stars[gameId] ?? 0;
  }

  reset(): void {
    this.unlocked.clear();
    this.stars = {};
    this.safetyProgress = { completedChapters: [], unlockedBadges: [] };
    this.storage.removeItem(STORAGE_KEY);
    this.storage.removeItem(STARS_KEY);
    this.storage.removeItem(SAFETY_PROGRESS_KEY);
    this.storage.removeItem(STAMINA_KEY);
  }
}

/** 内存存储实现（测试用；也可作为 localStorage 不可用时的降级） */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}
