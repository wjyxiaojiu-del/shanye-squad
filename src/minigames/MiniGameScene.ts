import type { GameServices, PointerPos, RenderContext, Scene } from '../core/types';
import type { MiniGame, WinReport } from './MiniGame';
import type { MiniGameFactory } from './registry';
import { gameById, stickerByGame } from '../state/stickers';
import { score } from '../scoring/logic';
import { mountBackButton, showSuccessCard } from '../ui/cards';

/**
 * 小游戏场景 —— 把一个 MiniGame 包装成 Scene。
 * 通关时：评分 → 记录最佳星级 → 解锁贴纸 → 成功卡片（带星级/用时）→ 返回。
 * 统一挂一个"返回营地"按钮（防误触确认）。
 */
export class MiniGameScene implements Scene {
  readonly id = 'minigame' as const;
  private game: MiniGame | null = null;
  private won = false;
  private removeBack: (() => void) | null = null;

  constructor(
    private services: GameServices,
    private gameId: string,
    private factory: MiniGameFactory,
  ) {}

  private backTarget() {
    const def = gameById(this.gameId);
    return def ? { focusSection: def.sectionId } : undefined;
  }

  enter(): void {
    this.won = false;
    this.services.input.clear();
    this.game = this.factory({
      input: this.services.input,
      audio: this.services.audio,
      width: this.services.width,
      height: this.services.height,
      onWin: (report) => this.handleWin(report),
    });
    this.game.enter();
    this.removeBack = mountBackButton(this.services.uiLayer, () =>
      this.services.nav.goCamp(this.backTarget()),
    );
  }

  private handleWin(report?: WinReport): void {
    if (this.won) return;
    this.won = true;
    this.removeBack?.();
    this.removeBack = null;

    const result = score({ perf: report?.perf ?? 1, timeSec: report?.timeSec });
    this.services.save.recordStars(this.gameId, result.stars);
    const sticker = stickerByGame(this.gameId);
    this.services.save.unlock(sticker.id);
    this.services.audio.play('success');

    showSuccessCard(this.services.uiLayer, sticker, result, () =>
      this.services.nav.goCamp(this.backTarget()),
    );
  }

  update(dt: number): void {
    if (!this.won) this.game?.update(dt);
  }

  render(r: RenderContext): void {
    this.game?.render(r);
  }

  onPointer(p: PointerPos): void {
    if (!this.won) this.game?.onPointer?.(p);
  }
  onPointerMove(p: PointerPos): void {
    if (!this.won) this.game?.onPointerMove?.(p);
  }
  onPointerUp(p: PointerPos): void {
    if (!this.won) this.game?.onPointerUp?.(p);
  }

  exit(): void {
    this.removeBack?.();
    this.removeBack = null;
    this.game?.exit();
    this.game = null;
  }
}
