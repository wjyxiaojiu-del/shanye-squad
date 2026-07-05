// ============================================================
// 全局类型契约 —— 各模块共享的接口定义
// ============================================================

import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { AudioApi } from './Audio';

/** 场景标识 */
export type SceneId = 'start' | 'camp' | 'gallery' | 'room' | 'minigame' | 'levelSelect' | 'safetyCourse';

/** 六大板块标识（与营地里的 6 个木牌一一对应） */
export type SectionId =
  | 'adventure' // 山水大冒险
  | 'survival'  // 少年贝尔挑战
  | 'ecology'   // 先锋与生态
  | 'cooking'   // 烟火美学营
  | 'trust'     // 信任与团队
  | 'safety';   // 小小安全官

/** 板块元信息（用于木牌显示与主题色） */
export interface Section {
  id: SectionId;
  /** 木牌上的板块名，如「山水大冒险」 */
  title: string;
  /** 第一版对应的小游戏名，如「抱石体验」 */
  gameTitle: string;
  /** 主题点缀色（低饱和） */
  color: string;
}

/** 收集贴纸 */
export interface Sticker {
  id: string;
  sectionId: SectionId;
  /** 贴纸名，如「抱石达人」 */
  name: string;
  /** 简易图标 emoji */
  emoji: string;
}

/** 每帧渲染上下文 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  /** Rough.js 手绘画布句柄（画抖动线条/木牌/岩壁） */
  rough: RoughCanvas;
  width: number;
  height: number;
  /** 距上一帧的秒数 */
  dt: number;
  /** 累计运行秒数（用于动画相位） */
  time: number;
}

/** 虚拟坐标系中的一个点（已从屏幕像素换算） */
export interface PointerPos {
  x: number;
  y: number;
}

/**
 * 场景接口 —— 开始/营地/图鉴/房间/小游戏都实现它。
 * Canvas 型场景在 render 里画；纯 DOM 型场景在 enter 建 DOM、render 可空。
 */
export interface Scene {
  readonly id: SceneId;
  /** 进入场景：建 DOM、重置状态 */
  enter(): void;
  /** 离开场景：清理 DOM、解绑事件 */
  exit(): void;
  /** 逻辑更新，dt 为秒 */
  update(dt: number): void;
  /** 画面渲染 */
  render(r: RenderContext): void;
  /** 指针/触摸按下（虚拟坐标）。可选。 */
  onPointer?(p: PointerPos): void;
  /** 指针/触摸拖动（虚拟坐标，按下后移动）。可选。 */
  onPointerMove?(p: PointerPos): void;
  /** 指针/触摸抬起。可选。 */
  onPointerUp?(p: PointerPos): void;
}

/**
 * 导航器 —— 场景之间通过它切换，避免场景类互相 import 造成循环依赖。
 * 由 Game 实现。
 */
export interface Navigator {
  goStart(): void;
  goCamp(opts?: { focusSection?: SectionId }): void;
  goGallery(): void;
  goRoom(): void;
  /** 进入某板块：多游戏则显示关卡选择页，单游戏直接进 */
  openSection(sectionId: SectionId): void;
  /** 直接进入某个小游戏（按 gameId） */
  startGame(gameId: string): void;
  /** 进入安全小课堂（读书 + 测验章节） */
  openSafetyCourse(): void;
}

/** 注入给每个场景的服务集合 */
export interface GameServices {
  nav: Navigator;
  save: SaveDataApi;
  input: InputApi;
  audio: AudioApi;
  /** DOM 叠层容器（开始界面、成功卡片、图鉴等 UI 挂这里） */
  uiLayer: HTMLElement;
  /** 逻辑分辨率 */
  width: number;
  height: number;
}

/** 存档对外接口（便于测试注入 mock） */
export interface SaveDataApi {
  isUnlocked(stickerId: string): boolean;
  unlock(stickerId: string): void;
  unlockedIds(): string[];
  /** 记录某关卡最佳星级（1-3），仅在更高时更新 */
  recordStars(gameId: string, stars: number): void;
  /** 读取某关卡最佳星级，无记录返回 0 */
  bestStars(gameId: string): number;
  reset(): void;
  /** 安全小课堂：章节完成 + 徽章解锁 */
  completeChapter(chapterId: string): void;
  chapterCompleted(chapterId: string): boolean;
  unlockBadge(badgeId: string): void;
  badgeUnlocked(badgeId: string): boolean;
  safetyBadgeCount(): number;
  safetyChapterCompletedCount(): number;
  safetyChapters(): ReadonlyArray<string>;
  safetyBadges(): ReadonlyArray<string>;
  /** 体力值（0..100），玩小游戏消耗 */
  readonly stamina: number;
  consumeStamina(n: number): void;
  rest(): void;
}

/** 输入对外接口 */
export interface InputApi {
  isDown(key: LogicalKey): boolean;
  onPress(handler: (key: LogicalKey) => void): () => void;
  /** 清空当前按下状态（切场景时用） */
  clear(): void;
}

/** 逻辑按键（与物理键解耦） */
export type LogicalKey = 'left' | 'right' | 'action' | 'confirm';
