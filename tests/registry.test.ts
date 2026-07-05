import { describe, it, expect } from 'vitest';
import {
  firstGameIdOf,
  getMiniGameFactory,
  getMiniGameFactoryBySection,
  hasMiniGame,
  hasMiniGameBySection,
} from '../src/minigames/registry';
import { GAMES, SECTIONS, STICKERS } from '../src/state/stickers';
import type { SectionId } from '../src/core/types';

const MINI_GAME_IDS = GAMES.filter((g) => !g.id.startsWith('safety-')).map((g) => g.id);

describe('注册表 · gameId 维度', () => {
  it('所有小游戏都已注册', () => {
    expect(MINI_GAME_IDS).toHaveLength(13);
    for (const id of MINI_GAME_IDS) {
      expect(hasMiniGame(id)).toBe(true);
      expect(getMiniGameFactory(id)).toBeTypeOf('function');
    }
  });

  it('安全课堂徽章不是小游戏入口', () => {
    const safetyBadgeIds = GAMES.filter((g) => g.id.startsWith('safety-')).map((g) => g.id);
    expect(safetyBadgeIds).toHaveLength(8);
    for (const id of safetyBadgeIds) {
      expect(hasMiniGame(id)).toBe(false);
      expect(getMiniGameFactory(id)).toBeNull();
    }
  });
});

describe('注册表 · section 维度', () => {
  const all: SectionId[] = ['adventure', 'survival', 'ecology', 'cooking', 'trust', 'safety'];

  it('6 个板块全部有游戏', () => {
    for (const id of all) {
      expect(hasMiniGameBySection(id)).toBe(true);
      expect(getMiniGameFactoryBySection(id)).toBeTypeOf('function');
    }
  });

  it('每个板块的首个游戏 id 可解析', () => {
    for (const id of all) {
      const fid = firstGameIdOf(id);
      expect(fid.length).toBeGreaterThan(0);
      expect(hasMiniGame(fid)).toBe(true);
    }
  });

  it('首个实现：adventure → bouldering（直接进入）', () => {
    expect(firstGameIdOf('adventure')).toBe('bouldering');
    // 所有其他板块各自只有一个传统实现
    expect(firstGameIdOf('survival')).toBe('firestarter');
    expect(firstGameIdOf('ecology')).toBe('leavenotrace');
    expect(firstGameIdOf('cooking')).toBe('bamboo-rice');
    expect(firstGameIdOf('trust')).toBe('night-hike');
    expect(firstGameIdOf('safety')).toBe('stretcher');
  });
});

describe('板块与贴纸数据', () => {
  it('恰好 6 个板块', () => {
    expect(SECTIONS).toHaveLength(6);
  });

  it('每个板块都有对应贴纸', () => {
    for (const section of SECTIONS) {
      const sticker = STICKERS.find((s) => s.sectionId === section.id);
      expect(sticker).toBeTruthy();
      expect(sticker?.sectionId).toBe(section.id);
      expect(sticker?.emoji.length).toBeGreaterThan(0);
    }
  });
});
