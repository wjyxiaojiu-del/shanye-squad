import type { GameServices, RenderContext, Scene } from '../core/types';
import { el } from '../ui/dom';
import { SECTIONS, STICKERS } from '../state/stickers';
import { drawPaper } from '../render/handdrawn';

/** 活动图鉴 —— 展示 6 枚贴纸，已解锁彩色、未解锁灰掉 */
export class GalleryScene implements Scene {
  readonly id = 'gallery' as const;
  private panel: HTMLElement | null = null;
  private unsub: (() => void) | null = null;

  constructor(private services: GameServices) {}

  enter(): void {
    const s = this.services;
    const panel = el('div', { class: 'panel' });
    panel.append(
      el('div', { class: 'panel-title', text: '活动图鉴' }),
      el('div', {
        class: 'panel-sub',
        text: `已收集 ${s.save.unlockedIds().length} / ${STICKERS.length} 枚贴纸`,
      }),
    );

    const grid = el('div', { class: 'sticker-grid' });
    for (const st of STICKERS) {
      const unlocked = s.save.isUnlocked(st.id);
      const section = SECTIONS.find((x) => x.id === st.sectionId)!;
      const cell = el('div', { class: 'sticker-cell' + (unlocked ? '' : ' locked') });
      cell.append(
        el('div', { class: 'emoji', text: unlocked ? st.emoji : '❔' }),
        el('div', { class: 'name', text: unlocked ? st.name : '未解锁' }),
        el('div', { class: 'game', text: section.gameTitle }),
      );
      grid.append(cell);
    }
    panel.append(grid);

    const back = el('button', { class: 'hand-btn top-left-back', text: '← 返回' });
    back.addEventListener('click', () => s.nav.goCamp());
    panel.append(back);

    s.uiLayer.append(panel);
    this.panel = panel;
    this.unsub = s.input.onPress((k) => {
      if (k === 'action' || k === 'confirm') s.nav.goCamp();
    });
  }

  update(): void {}

  render(r: RenderContext): void {
    drawPaper(r.ctx, r.width, r.height);
  }

  exit(): void {
    this.panel?.remove();
    this.panel = null;
    this.unsub?.();
    this.unsub = null;
  }
}
