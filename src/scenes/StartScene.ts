import type { GameServices, RenderContext, Scene } from '../core/types';
import { el } from '../ui/dom';
import {
  PALETTE,
  drawCloud,
  drawGround,
  drawHill,
  drawPaper,
  drawTent,
  drawTree,
} from '../render/handdrawn';

/** 开始界面 —— 手绘营地远景 + 标题 + 开始按钮 */
export class StartScene implements Scene {
  readonly id = 'start' as const;
  private overlay: HTMLElement | null = null;
  private unsub: (() => void) | null = null;

  constructor(private services: GameServices) {}

  enter(): void {
    const s = this.services;
    const overlay = el('div', { class: 'overlay' });
    const btn = el('button', { class: 'hand-btn', text: '▶ 开始探险' });
    btn.addEventListener('click', () => s.nav.goCamp());
    overlay.append(
      el('div', { class: 'start-title', text: '山野小队' }),
      el('div', { class: 'start-sub', text: '一起去山野闯关，集齐六枚徽章贴纸！' }),
      btn,
      el('div', { class: 'start-hint', text: '← → 移动　·　E 互动　·　回车确认' }),
    );
    s.uiLayer.append(overlay);
    this.overlay = overlay;

    this.unsub = s.input.onPress((k) => {
      if (k === 'confirm') s.nav.goCamp();
    });
  }

  update(): void {
    /* 静态背景，无需更新 */
  }

  onPointer(): void {
    // 移动端点画面任意处也可开始
    this.services.nav.goCamp();
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    const groundY = height * 0.78;
    drawPaper(ctx, width, height);
    drawCloud(rough, width * 0.22, height * 0.2, 1.1, 11);
    drawCloud(rough, width * 0.7, height * 0.14, 0.9, 21);
    drawHill(rough, width * 0.3, groundY, 520, 200, PALETTE.mist, 5);
    drawHill(rough, width * 0.68, groundY, 640, 260, PALETTE.moss, 8);
    drawGround(ctx, width, groundY, height);
    drawTree(rough, width * 0.15, groundY, 1.7, 31);
    drawTent(rough, width * 0.82, groundY, 41);
    drawTree(rough, width * 0.92, groundY, 1.3, 37);
  }

  exit(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.unsub?.();
    this.unsub = null;
  }
}
