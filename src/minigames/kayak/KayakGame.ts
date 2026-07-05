import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawPaper, drawPixelHero, handFont } from '../../render/handdrawn';
import {
  DISTANCE,
  KayakState,
  createKayak,
  kayakDodgeDir,
  kayakPerformance,
  kayakProgress,
  nextHazard,
  tickKayak,
} from './logic';

const H = 540;
const KAYAK_SCREEN_Y = H * 0.62;

/**
 * 皮划艇脱困 —— 俯视角激流下滚，按 ←→ 闪避障碍，跑完 DISTANCE 米通关。
 */
export class KayakGame implements MiniGame {
  readonly title = '皮划艇脱困';

  private state: KayakState = createKayak();
  private time = 0;
  private dir: -1 | 0 | 1 = 0;
  private gameOverClock = 0;
  private winClock = 0;
  private winFired = false;
  private viewW = 960;

  constructor(private ctx: MiniGameContext) {}

  enter(): void {
    this.reset();
  }

  exit(): void {
    /* 无需清理 */
  }

  private reset(): void {
    this.state = createKayak();
    this.time = 0;
    this.dir = 0;
    this.gameOverClock = 0;
    this.winClock = 0;
    this.winFired = false;
  }

  // 触屏：左半屏按住持续左移，右半屏持续右移
  onPointer(p: PointerPos): void {
    if (this.state.gameOver || this.state.finished) return;
    this.dir = p.x < this.viewW / 2 ? -1 : 1;
  }
  onPointerMove(p: PointerPos): void {
    if (this.state.gameOver || this.state.finished) return;
    this.dir = p.x < this.viewW / 2 ? -1 : 1;
  }
  onPointerUp(): void {
    this.dir = 0;
  }

  update(dt: number): void {
    this.time += dt;

    const input = this.ctx.input;
    let dir: -1 | 0 | 1 = 0;
    if (input.isDown('left')) dir = -1;
    else if (input.isDown('right')) dir = 1;
    else dir = this.dir;

    this.state = tickKayak(this.state, dir, dt);

    if (this.state.gameOver) {
      if (this.gameOverClock === 0) this.ctx.audio.play('fail');
      this.gameOverClock += dt;
      if (this.gameOverClock > 0.9) this.reset();
      return;
    }

    if (this.state.finished) {
      if (this.winClock === 0) this.ctx.audio.play('success');
      this.winClock += dt;
      if (this.winClock > 0.8 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin({ perf: kayakPerformance(this.state), timeSec: this.time });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;

    drawPaper(ctx, width, height);
    // 河流背景
    const riverW = Math.min(width * 0.62, 480);
    const riverX = width / 2 - riverW / 2;

    // 河岸
    ctx.save();
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(0, 0, riverX, height);
    ctx.fillRect(riverX + riverW, 0, width - (riverX + riverW), height);
    ctx.restore();

    // 激流水面
    ctx.save();
    ctx.fillStyle = '#7DA8C8';
    ctx.fillRect(riverX, 0, riverW, height);
    ctx.restore();

    // 流动白线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    const flow = (this.state.scrollY * 40) % 28;
    for (let y = -28 + flow; y < height; y += 28) {
      ctx.beginPath();
      for (let x = riverX; x <= riverX + riverW; x += 14) {
        const yy = y + Math.sin((x + this.time * 80) * 0.05) * 3;
        if (x === riverX) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    const warningHazard = nextHazard(this.state);

    // 障碍
    for (const o of this.state.obstacles) {
      const sx = riverX + (o.x / 360) * riverW;
      const sy = KAYAK_SCREEN_Y + (o.y - this.state.scrollY - 60);
      if (sy < -80 || sy > height + 40) continue;
      if (o.kind === 'rock') {
        rough.circle(sx, sy, o.w, {
          fill: PALETTE.stone,
          fillStyle: 'solid',
          stroke: PALETTE.ink,
          strokeWidth: 2,
          roughness: 1.3,
          seed: o.id + 5,
        });
      } else {
        ctx.save();
        ctx.strokeStyle = PALETTE.woodDark;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - o.w / 2, sy);
        ctx.lineTo(sx + o.w / 2, sy + (o.id % 2 ? 6 : -6));
        ctx.stroke();
        ctx.strokeStyle = PALETTE.wood;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - o.w / 4, sy - 4);
        ctx.lineTo(sx + 2, sy + 4);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (warningHazard) {
      const sx = riverX + (warningHazard.x / 360) * riverW;
      const sy = KAYAK_SCREEN_Y + (warningHazard.y - this.state.scrollY - 60);
      this.drawHazardWarning(ctx, sx, sy, warningHazard.w);
    }

    // 皮划艇 + 小人
    const kx = riverX + (this.state.kayakX / 360) * riverW;
    this.drawKayak(ctx, rough, kx, KAYAK_SCREEN_Y);
    this.drawTouchHints(ctx, width);

    // HUD
    this.drawHud(ctx, width);

    // 失败遮罩
    if (this.state.gameOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(43,43,43,0.45)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = PALETTE.paper;
      ctx.font = handFont(28);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 撞上了！重新出发', width / 2, height * 0.42);
      ctx.restore();
    }
  }

  private drawKayak(ctx: CanvasRenderingContext2D, _rough: unknown, x: number, y: number): void {
    const w = 56;
    const h = 26;
    ctx.save();
    ctx.translate(x, y);
    // 船体（椭圆两头尖）
    ctx.fillStyle = PALETTE.brick;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, -h, w / 2, 0);
    ctx.quadraticCurveTo(0, h, -w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 小人在船中
    drawPixelHero(ctx, x, y - 6, { facing: 1, walk: (this.time * 2) % 1, scale: 2.6, shirt: PALETTE.mist });
  }

  private drawHazardWarning(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    if (y < 80 || y > H - 80) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 8);
    ctx.save();
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    ctx.strokeStyle = PALETTE.brick;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 14);
    ctx.lineTo(x + 14, y + 14);
    ctx.moveTo(x + 14, y - 14);
    ctx.lineTo(x - 14, y + 14);
    ctx.stroke();
    ctx.restore();
  }

  private drawTouchHints(ctx: CanvasRenderingContext2D, width: number): void {
    if (this.state.finished || this.state.gameOver) return;
    const dir = kayakDodgeDir(this.state);
    const y = H - 38;
    ctx.save();
    ctx.font = handFont(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dir < 0 ? PALETTE.brick : 'rgba(43,43,43,0.45)';
    ctx.fillText('← 左闪', width * 0.28, y);
    ctx.fillStyle = dir > 0 ? PALETTE.brick : 'rgba(43,43,43,0.45)';
    ctx.fillText('右闪 →', width * 0.72, y);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dir = kayakDodgeDir(this.state);
    const tip = this.state.finished
      ? '🛶 成功脱困！'
      : dir < 0
        ? '前方有障碍，往左闪！'
        : dir > 0
          ? '前方有障碍，往右闪！'
          : '保持路线，盯住红圈障碍';
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();

    // 进度条
    const barW = 220;
    const barH = 14;
    const bx = width / 2 - barW / 2;
    const by = 42;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = PALETTE.brick;
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * kayakProgress(this.state), barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(this.state.scrollY)}m / ${DISTANCE}m`, width / 2, by - 10);
    ctx.restore();
  }
}
