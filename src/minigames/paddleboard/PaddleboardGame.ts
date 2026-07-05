import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawPaper, drawPixelHero, handFont } from '../../render/handdrawn';
import {
  MAX_TILT,
  TARGET_TIME,
  correctionDir,
  createPaddle,
  paddlePerformance,
  paddleProgress,
  tickPaddle,
  type PaddleState,
} from './logic';

const H = 540;
const WATER_Y = H * 0.62;

/**
 * 桨板平衡 —— 按住 ←→ 或点击左右半屏抵消波浪，坚持 TARGET_TIME 秒不落水即通关。
 */
export class PaddleboardGame implements MiniGame {
  readonly title = '桨板平衡';

  private state: PaddleState = createPaddle();
  private time = 0;
  private dir: -1 | 0 | 1 = 0;
  private onWater = 0; // 波浪起伏的相位偏移
  private fallClock = 0; // 落水后的停顿计时
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
    this.state = createPaddle();
    this.time = 0;
    this.dir = 0;
    this.fallClock = 0;
    this.winClock = 0;
    this.winFired = false;
  }

  // 触屏：左半屏 = -1，右半屏 = +1，按下即设定方向
  onPointer(p: PointerPos): void {
    if (this.state.fallen || this.state.finished) return;
    this.dir = p.x < this.viewW / 2 ? -1 : 1;
  }
  onPointerMove(p: PointerPos): void {
    if (this.state.fallen || this.state.finished) return;
    this.dir = p.x < this.viewW / 2 ? -1 : 1;
  }
  onPointerUp(): void {
    this.dir = 0;
  }

  update(dt: number): void {
    this.time += dt;

    // 键盘输入覆盖触屏方向
    const input = this.ctx.input;
    let dir: -1 | 0 | 1 = 0;
    if (input.isDown('left')) dir = -1;
    else if (input.isDown('right')) dir = 1;
    else dir = this.dir; // 触屏

    this.state = tickPaddle(this.state, dir, dt);
    this.onWater += dt * 1.4;

    if (this.state.fallen) {
      if (this.fallClock === 0) this.ctx.audio.play('splash');
      this.fallClock += dt;
      if (this.fallClock > 1.0) this.reset();
      return;
    }

    if (this.state.finished) {
      if (this.winClock === 0) this.ctx.audio.play('success');
      this.winClock += dt;
      if (this.winClock > 0.8 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin({ perf: paddlePerformance(this.state), timeSec: this.time });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;

    drawPaper(ctx, width, height);

    // 天空渐变
    ctx.save();
    ctx.fillStyle = 'rgba(143,165,173,0.18)';
    ctx.fillRect(0, 0, width, WATER_Y);
    ctx.restore();

    // 水面 + 浪花
    this.drawWater(ctx, rough, width);

    // 桨板 + 小人
    this.drawBoardAndHero(ctx, width);

    // 倾斜表盘 + HUD
    this.drawTiltMeter(ctx, width);
    this.drawSteerHint(ctx, width);
    this.drawHud(ctx, width);

    // 落水遮罩
    if (this.state.fallen) {
      ctx.save();
      ctx.fillStyle = 'rgba(43,43,43,0.45)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = PALETTE.paper;
      ctx.font = handFont(28);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💦 落水啦！保持平衡', width / 2, height * 0.42);
      ctx.restore();
    }
  }

  private drawWater(ctx: CanvasRenderingContext2D, _rough: unknown, width: number): void {
    ctx.save();
    const baseY = WATER_Y;
    ctx.fillStyle = '#8FAAD0';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const step = 14;
    for (let x = 0; x <= width; x += step) {
      const y = baseY + Math.sin(x * 0.018 + this.onWater * 1.2) * 5 + Math.sin(x * 0.045 + this.onWater * 2.1) * 2.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // 波光
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const yy = baseY + 18 + i * 14;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const y = yy + Math.sin(x * 0.03 + this.onWater * 1.5 + i) * 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoardAndHero(ctx: CanvasRenderingContext2D, width: number): void {
    const cx = width / 2;
    const boardLen = Math.min(width * 0.36, 280);
    const bob = Math.sin(this.onWater * 1.6) * 6;
    const cy = WATER_Y - 14 + bob;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.state.tilt);

    // 桨板
    ctx.fillStyle = PALETTE.ochre;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-boardLen / 2, 0);
    ctx.quadraticCurveTo(0, 8, boardLen / 2, 0);
    ctx.quadraticCurveTo(boardLen / 2 - 12, -7, -boardLen / 2 + 12, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 板中线
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-boardLen / 2 + 18, -1);
    ctx.lineTo(boardLen / 2 - 18, -1);
    ctx.stroke();

    ctx.restore();

    // 小人站在板上（随 tilt 微移 + 反向倾倒时身体摆动）
    const lean = this.state.tilt * 0.4;
    ctx.save();
    ctx.translate(cx + lean * 30, cy - 4 + bob);
    ctx.rotate(lean * 0.25);
    drawPixelHero(ctx, 0, 0, { facing: 1, walk: this.state.tilt !== 0 ? (this.time * 1.2) % 1 : 0, scale: 3.2, shirt: PALETTE.mist });
    ctx.restore();

    // 桨
    const paddleAngle = Math.PI * 0.5 + Math.sin(this.time * 1.5) * 0.3;
    ctx.save();
    ctx.translate(cx + lean * 30, cy - 12 + bob);
    ctx.rotate(paddleAngle + lean * 0.4);
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 56);
    ctx.stroke();
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath();
    ctx.ellipse(0, 52, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawTiltMeter(ctx: CanvasRenderingContext2D, width: number): void {
    const r = 42;
    const cx = width - 60;
    const cy = 64;
    // 表盘
    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
    // 红色危险端
    ctx.strokeStyle = PALETTE.brick;
    ctx.lineWidth = 4;
    const aL = Math.PI * 0.15;
    const aR = Math.PI * 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, aL, aL + (aR - aL) * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, aR - (aR - aL) * 0.22, aR);
    ctx.stroke();
    // 指针
    const t = Math.max(-1, Math.min(1, this.state.tilt / MAX_TILT));
    const ang = Math.PI * 0.5 - t * (Math.PI * 0.35);
    const danger = Math.abs(t) > 0.7;
    ctx.strokeStyle = this.state.fallen || danger ? PALETTE.brick : PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 6), cy - Math.sin(ang) * (r - 6));
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('倾斜', cx, cy + r + 14);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const need = correctionDir(this.state);
    const action = need === -1 ? '按左边，把右倾拉回来' : need === 1 ? '按右边，把左倾拉回来' : '保持，别乱按';
    const tip = this.state.finished ? '🏄 平衡高手！稳住了！' : action;
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();

    // 存活进度条
    const barW = 200;
    const barH = 14;
    const bx = width / 2 - barW / 2;
    const by = 42;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * paddleProgress(this.state), barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.max(0, Math.ceil(TARGET_TIME - this.state.timeAlive))}s`, width / 2, by - 10);
    ctx.restore();
  }

  private drawSteerHint(ctx: CanvasRenderingContext2D, width: number): void {
    if (this.state.finished || this.state.fallen) return;
    const need = correctionDir(this.state);
    const y = H - 48;
    const padW = Math.min(width * 0.28, 180);
    const leftX = width * 0.24;
    const rightX = width * 0.76;

    ctx.save();
    ctx.globalAlpha = 0.86;
    for (const side of [-1, 1] as const) {
      const active = need === side;
      const x = side === -1 ? leftX : rightX;
      ctx.fillStyle = active ? PALETTE.moss : 'rgba(244,236,216,0.72)';
      ctx.strokeStyle = active ? PALETTE.ink : PALETTE.inkSoft;
      ctx.lineWidth = active ? 3 : 2;
      ctx.fillRect(x - padW / 2, y - 20, padW, 40);
      ctx.strokeRect(x - padW / 2, y - 20, padW, 40);
      ctx.fillStyle = active ? PALETTE.paper : PALETTE.inkSoft;
      ctx.font = handFont(18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(side === -1 ? '← 左边' : '右边 →', x, y);
    }
    if (need === 0) {
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.font = handFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('板身接近水平，先稳住', width / 2, y - 28);
    }
    ctx.restore();
  }
}
