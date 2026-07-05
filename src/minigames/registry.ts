import type { MiniGame, MiniGameContext } from './MiniGame';
import type { SectionId } from '../core/types';
import { BoulderingGame } from './bouldering/BoulderingGame';
import { PaddleboardGame } from './paddleboard/PaddleboardGame';
import { KayakGame } from './kayak/KayakGame';
import { StreamGame } from './stream/StreamGame';
import { FireStartingGame } from './fire/FireStartingGame';
import { WaterFilterGame } from './waterfilter/WaterFilterGame';
import { LeaveNoTraceGame } from './lnt/LeaveNoTraceGame';
import { TrashSortGame } from './trashsort/TrashSortGame';
import { BambooRiceGame } from './cooking/BambooRiceGame';
import { MarshmallowGame } from './marshmallow/MarshmallowGame';
import { NightHikeGame } from './night/NightHikeGame';
import { ConstellationGame } from './constellation/ConstellationGame';
import { StretcherGame } from './stretcher/StretcherGame';

export type MiniGameFactory = (ctx: MiniGameContext) => MiniGame;

/**
 * 每个已注册游戏的 id / 所属板块 —— 单一来源，与 REGISTRY 同步维护。
 * section 维度查询靠它把板块 id 解析到具体 gameId。
 */
const META: Array<{ id: string; sectionId: SectionId }> = [
  { id: 'bouldering', sectionId: 'adventure' },
  { id: 'paddleboard', sectionId: 'adventure' },
  { id: 'kayak', sectionId: 'adventure' },
  { id: 'stream', sectionId: 'adventure' },
  { id: 'firestarter', sectionId: 'survival' },
  { id: 'waterfilter', sectionId: 'survival' },
  { id: 'leavenotrace', sectionId: 'ecology' },
  { id: 'trashsort', sectionId: 'ecology' },
  { id: 'bamboo-rice', sectionId: 'cooking' },
  { id: 'marshmallow', sectionId: 'cooking' },
  { id: 'night-hike', sectionId: 'trust' },
  { id: 'constellation', sectionId: 'trust' },
  { id: 'stretcher', sectionId: 'safety' },
];

/**
 * 游戏 id → 工厂 注册表。
 * 一个板块可含多个游戏（见 state/stickers 的 GAMES）；此处按 gameId 建工厂。
 */
const REGISTRY: Record<string, MiniGameFactory> = {
  bouldering: (ctx) => new BoulderingGame(ctx),
  paddleboard: (ctx) => new PaddleboardGame(ctx),
  kayak: (ctx) => new KayakGame(ctx),
  stream: (ctx) => new StreamGame(ctx),
  firestarter: (ctx) => new FireStartingGame(ctx),
  waterfilter: (ctx) => new WaterFilterGame(ctx),
  leavenotrace: (ctx) => new LeaveNoTraceGame(ctx),
  trashsort: (ctx) => new TrashSortGame(ctx),
  'bamboo-rice': (ctx) => new BambooRiceGame(ctx),
  marshmallow: (ctx) => new MarshmallowGame(ctx),
  'night-hike': (ctx) => new NightHikeGame(ctx),
  constellation: (ctx) => new ConstellationGame(ctx),
  stretcher: (ctx) => new StretcherGame(ctx),
};

export function getMiniGameFactory(gameId: string): MiniGameFactory | null {
  return REGISTRY[gameId] ?? null;
}

export function hasMiniGame(gameId: string): boolean {
  return gameId in REGISTRY;
}

/** 某板块下第一个已注册的 gameId（用于点击木牌直接进入） */
export function firstGameIdOf(sectionId: SectionId): string {
  const m = META.find((x) => x.sectionId === sectionId);
  return m?.id ?? '';
}

export function hasMiniGameBySection(sectionId: SectionId): boolean {
  return META.some((x) => x.sectionId === sectionId);
}

export function getMiniGameFactoryBySection(sectionId: SectionId): MiniGameFactory | null {
  const id = firstGameIdOf(sectionId);
  return id ? getMiniGameFactory(id) : null;
}
