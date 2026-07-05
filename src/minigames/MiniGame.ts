import type { AudioApi } from '../core/Audio';
import type { InputApi, PointerPos, RenderContext } from '../core/types';

/** 通关上报数据 —— 由 MiniGame 传给 MiniGameScene.onWin */
export interface WinReport {
  /** 表现分 0..1（越高越好） */
  perf: number;
  /** 用时（秒），仅用于展示 */
  timeSec?: number;
}

/** 小游戏运行所需的上下文（由 MiniGameScene 注入） */
export interface MiniGameContext {
  input: InputApi;
  audio: AudioApi;
  /** 初始虚拟宽（会变，绘制时以 RenderContext.width 为准） */
  width: number;
  /** 虚拟高（固定 540） */
  height: number;
  /** 通关时调用 —— 触发解锁贴纸、成功卡片；可上报表现/用时 */
  onWin: (report?: WinReport) => void;
}

/**
 * 小游戏接口 —— 所有小游戏实现它。
 * 由 registry 的工厂函数创建，被 MiniGameScene 包装成 Scene 运行。
 */
export interface MiniGame {
  readonly title: string;
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(r: RenderContext): void;
  /** 指针/触摸按下（虚拟坐标）。可选。 */
  onPointer?(p: PointerPos): void;
  /** 指针/触摸拖动。可选。 */
  onPointerMove?(p: PointerPos): void;
  /** 指针/触摸抬起。可选。 */
  onPointerUp?(p: PointerPos): void;
}
