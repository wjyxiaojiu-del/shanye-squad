import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import { SceneManager } from './SceneManager';
import { Input } from './Input';
import { GameAudio, NullAudio, type AudioApi } from './Audio';
import type { GameServices, Navigator, RenderContext, Scene, SectionId } from './types';
import { MemoryStorage, SaveData, type StorageLike } from '../state/SaveData';
import { StartScene } from '../scenes/StartScene';
import { CampScene } from '../scenes/CampScene';
import { GalleryScene } from '../scenes/GalleryScene';
import { RoomScene } from '../scenes/RoomScene';
import { MiniGameScene } from '../minigames/MiniGameScene';
import {
  getMiniGameFactory,
} from '../minigames/registry';
import { gameById, gamesOf, sectionById } from '../state/stickers';
import { showComingSoonCard } from '../ui/cards';
import { SafetyCourseScene } from '../scenes/SafetyCourseScene';
import { LevelSelectScene } from '../scenes/LevelSelectScene';
import { clear, el } from '../ui/dom';

/** 虚拟高度固定，宽度随窗口比例动态 → 画面铺满、元素比例稳定 */
const DESIGN_HEIGHT = 540;

/** 浏览器提供的 AudioContext 构造函数（不存在则返回 null） */
function AudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** localStorage 不可用时降级到内存存储 */
function safeStorage(): StorageLike {
  try {
    const k = '__shanye_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}

/**
 * 游戏主控 —— 响应式画布、主循环、指针分发，并作为 Navigator 负责场景切换。
 */
export class Game implements Navigator {
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rc: RoughCanvas;
  private uiLayer: HTMLElement;
  private input: Input;
  private save: SaveData;
  private audio: AudioApi;
  private scenes = new SceneManager();
  private services: GameServices;

  private last = 0;
  private time = 0;
  private modal = false;

  /** 物理像素/虚拟单位 的缩放 */
  private scale = 1;
  /** 当前虚拟宽度（随窗口比例变化） */
  private virtualWidth = 960;
  /** 指针是否处于按下拖动状态 */
  private dragging = false;

  constructor(mount: HTMLElement) {
    this.stage = el('div', { class: 'stage' });
    this.canvas = document.createElement('canvas');
    this.uiLayer = el('div');
    this.uiLayer.id = 'ui-layer';
    this.stage.append(this.canvas, this.uiLayer);
    mount.append(this.stage);

    this.ctx = this.canvas.getContext('2d')!;
    this.rc = rough.canvas(this.canvas);
    this.input = new Input();
    this.save = new SaveData(safeStorage());
    const AC = AudioContextCtor();
    this.audio = AC ? new GameAudio() : new NullAudio();
    this.services = {
      nav: this,
      save: this.save,
      input: this.input,
      audio: this.audio,
      uiLayer: this.uiLayer,
      width: this.virtualWidth,
      height: DESIGN_HEIGHT,
    };

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);

    // 首次用户手势时解锁音频（浏览器策略要求）
    const unlock = () => {
      this.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // move/up 挂 window：拖出画布仍持续，松手可靠
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    // 移动端：切到后台（切 App、锁屏）暂停 rAF，回到前台再续，省电流电
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private bgId = 0;
  private destroyed = false;

  start(): void {
    this.goStart();
    this.bgId = requestAnimationFrame(this.frame);
  }

  /** 彻底销毁：停主循环、解绑全部窗口事件（页面卸载 / 热更新时调用） */
  destroy(): void {
    this.destroyed = true;
    if (this.bgId) cancelAnimationFrame(this.bgId);
    this.bgId = 0;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.destroy();
    this.audio.stopMusic();
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      if (this.bgId) {
        cancelAnimationFrame(this.bgId);
        this.bgId = 0;
      }
    } else if (!this.bgId) {
      this.last = 0;
      this.bgId = requestAnimationFrame(this.frame);
    }
  };

  /** 画布铺满容器，按 DPR 提升清晰度，重算虚拟宽度 */
  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = this.stage.clientWidth || window.innerWidth;
    const cssH = this.stage.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = this.canvas.height / DESIGN_HEIGHT;
    this.virtualWidth = this.canvas.width / this.scale;
    this.services.width = this.virtualWidth;
    this.services.height = DESIGN_HEIGHT;
  };

  /** 屏幕像素 → 虚拟坐标；超出画布返回 null */
  private toVirtual(e: PointerEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const x = (cssX / rect.width) * this.virtualWidth;
    const y = (cssY / rect.height) * DESIGN_HEIGHT;
    return { x, y };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.modal) return;
    const rect = this.canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) return;
    this.dragging = true;
    this.scenes.active?.onPointer?.(this.toVirtual(e)!);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.modal || !this.dragging) return;
    this.scenes.active?.onPointerMove?.(this.toVirtual(e)!);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.scenes.active?.onPointerUp?.(this.toVirtual(e)!);
  };

  // ---------------- Navigator ----------------
  goStart(): void {
    this.enterScene(new StartScene(this.services));
  }
  goCamp(opts?: { focusSection?: SectionId }): void {
    this.enterScene(new CampScene(this.services, opts));
  }
  goGallery(): void {
    this.enterScene(new GalleryScene(this.services));
  }
  goRoom(): void {
    this.enterScene(new RoomScene(this.services));
  }
  openSection(sectionId: SectionId): void {
    // 安全板块是"读书+测验"课程，走专门场景
    if (sectionId === 'safety') {
      this.openSafetyCourse();
      return;
    }
    const games = gamesOf(sectionId);
    // 该板块没有任何关卡 → 敬请期待
    if (games.length === 0) {
      this.modal = true;
      showComingSoonCard(this.uiLayer, sectionById(sectionId), () => {
        this.modal = false;
        this.input.clear();
      });
      return;
    }
    // 单关卡直接进入；多关卡先进关卡选择页
    if (games.length === 1) {
      this.startGame(games[0].id);
      return;
    }
    this.enterScene(new LevelSelectScene(this.services, sectionId));
  }

  startGame(gameId: string): void {
    const factory = getMiniGameFactory(gameId);
    if (!factory) {
      const def = gameById(gameId);
      const sectionId = def?.sectionId;
      if (!sectionId) return;
      this.modal = true;
      showComingSoonCard(this.uiLayer, sectionById(sectionId), () => {
        this.modal = false;
        this.input.clear();
      });
      return;
    }
    this.enterScene(new MiniGameScene(this.services, gameId, factory));
  }

  openSafetyCourse(): void {
    this.enterScene(new SafetyCourseScene(this.services));
  }

  private enterScene(scene: Scene): void {
    this.modal = false;
    clear(this.uiLayer);
    this.input.clear();
    this.scenes.change(scene);
  }

  private frame = (t: number): void => {
    if (this.destroyed) return;
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    this.time += dt;

    if (!this.modal) this.scenes.update(dt);

    // 虚拟坐标 → 物理像素 的统一缩放
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx.clearRect(0, 0, this.virtualWidth, DESIGN_HEIGHT);

    const rc: RenderContext = {
      ctx: this.ctx,
      rough: this.rc,
      width: this.virtualWidth,
      height: DESIGN_HEIGHT,
      dt,
      time: this.time,
    };
    this.scenes.render(rc);
    requestAnimationFrame(this.frame);
  };
}
