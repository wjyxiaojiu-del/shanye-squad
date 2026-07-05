import type { GameServices, RenderContext, Scene, SectionId } from '../core/types';
import { gamesOf, sectionById } from '../state/stickers';
import { hasMiniGame } from '../minigames/registry';
import { drawPaper } from '../render/handdrawn';
import { el } from '../ui/dom';

/**
 * 关卡选择页 —— 某板块含多个小游戏时，先在此列出该板块所有关卡供玩家选择。
 * 已注册的关卡可点击进入并显示最佳星级；未实现的显示「敬请期待」。
 * 纯 DOM 场景（render 仅铺纸底）。
 */
export class LevelSelectScene implements Scene {
  readonly id = 'levelSelect' as const;
  private panel: HTMLElement | null = null;

  constructor(
    private services: GameServices,
    private sectionId: SectionId,
  ) {}

  enter(): void {
    const s = this.services;
    const section = sectionById(this.sectionId);
    const games = gamesOf(this.sectionId);

    const panel = el('div', { class: 'panel safety-overview' });
    panel.append(
      el('div', { class: 'panel-title', text: section.title }),
      el('div', { class: 'panel-sub', text: '选择一个关卡开始挑战' }),
    );

    const grid = el('div', { class: 'chapter-grid' });
    games.forEach((g) => {
      const registered = hasMiniGame(g.id);
      const stars = s.save.bestStars(g.id);
      const cleared = s.save.isUnlocked(g.id);
      const cell = el(
        'div',
        {
          class: 'chapter-card' + (registered ? '' : ' locked') + (cleared ? ' completed' : ''),
        },
        [
          el('div', { class: 'emoji', text: registered ? g.emoji : '🚧' }),
          el('div', { class: 'name', text: g.title }),
          el('div', {
            class: 'game',
            text: registered
              ? stars > 0
                ? '★'.repeat(stars) + '☆'.repeat(3 - stars)
                : '未挑战'
              : '敬请期待',
          }),
        ],
      );
      if (registered) {
        cell.addEventListener('click', () => {
          s.audio.play('click');
          s.nav.startGame(g.id);
        });
      }
      grid.append(cell);
    });
    panel.append(grid);

    const back = el('button', { class: 'hand-btn top-left-back', text: '← 返回营地' });
    back.addEventListener('click', () => s.nav.goCamp({ focusSection: this.sectionId }));
    panel.append(back);

    s.uiLayer.append(panel);
    this.panel = panel;
  }

  exit(): void {
    this.panel?.remove();
    this.panel = null;
  }

  update(): void {
    /* 静态 DOM 场景 */
  }

  render(r: RenderContext): void {
    drawPaper(r.ctx, r.width, r.height);
  }
}
