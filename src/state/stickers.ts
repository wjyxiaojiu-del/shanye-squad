import type { Section, SectionId, Sticker } from '../core/types';

/**
 * 六大板块定义 —— 与营地里 6 个木牌一一对应。
 * 一个板块可包含多个小游戏（见 GAMES）。color 为低饱和主题点缀色。
 */
export const SECTIONS: Section[] = [
  { id: 'safety', title: '小小安全官', gameTitle: '安全小课堂', color: '#B0574A' },
  { id: 'adventure', title: '山水大冒险', gameTitle: '攀爬与水上', color: '#8FA5AD' },
  { id: 'survival', title: '少年贝尔挑战', gameTitle: '原始取火', color: '#C1786A' },
  { id: 'ecology', title: '先锋与生态', gameTitle: '无痕山林', color: '#7A8B6F' },
  { id: 'cooking', title: '烟火美学营', gameTitle: '竹筒饭', color: '#B08968' },
  { id: 'trust', title: '信任与团队', gameTitle: '暗夜盲行', color: '#6B6B8A' },
];

/**
 * 游戏清单 —— 单一数据源。每个小游戏一条，含所属板块、标题、图标。
 * gameId 同时用作贴纸 id 与星级记录 key。
 * 一个板块的多个游戏在此按顺序排列（关卡选择页据此展示）。
 */
export interface GameDef {
  id: string;
  sectionId: SectionId;
  title: string;
  emoji: string;
  stickerName: string;
}

export const GAMES: GameDef[] = [
  // 山水大冒险（多游戏：攀爬 + 三项水上运动）
  { id: 'bouldering', sectionId: 'adventure', title: '抱石体验', emoji: '🧗', stickerName: '抱石达人' },
  { id: 'paddleboard', sectionId: 'adventure', title: '桨板平衡', emoji: '🏄', stickerName: '平衡高手' },
  { id: 'kayak', sectionId: 'adventure', title: '皮划艇脱困', emoji: '🛶', stickerName: '脱险勇者' },
  { id: 'stream', sectionId: 'adventure', title: '溯溪探险', emoji: '💦', stickerName: '溯溪能手' },
  // 其余板块（各一个游戏）
  { id: 'firestarter', sectionId: 'survival', title: '原始取火', emoji: '🔥', stickerName: '取火高手' },
  { id: 'waterfilter', sectionId: 'survival', title: '净水大作战', emoji: '💧', stickerName: '净水专家' },
  { id: 'leavenotrace', sectionId: 'ecology', title: '无痕山林', emoji: '🌿', stickerName: '无痕行者' },
  { id: 'trashsort', sectionId: 'ecology', title: '垃圾分类', emoji: '♻️', stickerName: '分类小能手' },
  { id: 'bamboo-rice', sectionId: 'cooking', title: '竹筒饭', emoji: '🍚', stickerName: '竹筒厨神' },
  { id: 'marshmallow', sectionId: 'cooking', title: '烤棉花糖', emoji: '🍡', stickerName: '棉花糖大师' },
  { id: 'night-hike', sectionId: 'trust', title: '暗夜盲行', emoji: '🌙', stickerName: '暗夜勇者' },
  { id: 'constellation', sectionId: 'trust', title: '星空连线', emoji: '⭐', stickerName: '观星领航员' },
  { id: 'stretcher', sectionId: 'safety', title: '简易担架', emoji: '🚑', stickerName: '救护小兵' },
  // 安全小课堂 —— 8 枚户外安全知识徽章（按章节完成解锁）
  { id: 'safety-gear',     sectionId: 'safety', title: '小小安全官 · 装备篇',     emoji: '🎒', stickerName: '装备小达人' },
  { id: 'safety-pack',     sectionId: 'safety', title: '小小安全官 · 背包篇',     emoji: '🎒', stickerName: '背包小专家' },
  { id: 'safety-water',    sectionId: 'safety', title: '小小安全官 · 饮水篇',     emoji: '💧', stickerName: '饮水科学家' },
  { id: 'safety-tent',     sectionId: 'safety', title: '小小安全官 · 帐篷篇',     emoji: '⛺', stickerName: '帐篷工程师' },
  { id: 'safety-knot',     sectionId: 'safety', title: '小小安全官 · 绳结篇',     emoji: '🪢', stickerName: '绳结高手' },
  { id: 'safety-sos',      sectionId: 'safety', title: '小小安全官 · 求救篇',     emoji: '🆘', stickerName: '求救小勇士' },
  { id: 'safety-firstaid', sectionId: 'safety', title: '小小安全官 · 伤护篇',     emoji: '🩹', stickerName: '伤护小护士' },
  { id: 'safety-weather',  sectionId: 'safety', title: '小小安全官 · 防雷篇',     emoji: '⛈️', stickerName: '天气观察员' },
];

/** 每个小游戏一枚收集贴纸（由 GAMES 派生） */
export const STICKERS: Sticker[] = GAMES.map((g) => ({
  id: g.id,
  sectionId: g.sectionId,
  name: g.stickerName,
  emoji: g.emoji,
}));

export function gamesOf(sectionId: SectionId): GameDef[] {
  return GAMES.filter((g) => g.sectionId === sectionId);
}

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export function sectionById(id: SectionId): Section {
  const s = SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error(`未知板块: ${id}`);
  return s;
}

export function stickerByGame(gameId: string): Sticker {
  const s = STICKERS.find((x) => x.id === gameId);
  if (!s) throw new Error(`游戏无贴纸: ${gameId}`);
  return s;
}

export function stickerById(id: string): Sticker | undefined {
  return STICKERS.find((x) => x.id === id);
}

