import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, drawPaper, handFont } from '../../render/handdrawn';
import {
  BEST_HIGH,
  BEST_LOW,
  CookState,
  OVERHEAT,
  addWood,
  cookAdvice,
  createCook,
  flip,
  inBestZone,
  tickCook,
} from './logic';

const H = 540;

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 竹筒饭（火候节奏）—— 控火保持温度在最佳区间、按时翻面，烤熟不烤糊。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class BambooRiceGame implements MiniGame {
  readonly title = '竹筒饭';

  private state: CookState = createCook();
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private flipAnim = 0; // 翻面动画 0..1
  private sparks = 0; // 添柴迸火花计时
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.state = createCook();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.flipAnim = 0;
    this.sparks = 0;
  }

  exit(): void {
    /* 无需清理 */
  }

  private woodBtn(): Btn {
    const w = Math.min(this.viewW * 0.3, 190);
    return { x: this.viewW / 2 - w - 12, y: H - 74, w, h: 52 };
  }
  private flipBtn(): Btn {
    const w = Math.min(this.viewW * 0.3, 190);
    return { x: this.viewW / 2 + 12, y: H - 74, w, h: 52 };
  }
  private retryBtn(): Btn {
    const w = 200;
    return { x: this.viewW / 2 - w / 2, y: H * 0.6, w, h: 50 };
  }

  private hit(b: Btn, p: PointerPos): boolean {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  onPointer(p: PointerPos): void {
    if (this.state.burnt) {
      if (this.hit(this.retryBtn(), p)) this.state = createCook();
      return;
    }
    if (this.state.finished) return;
    if (this.hit(this.woodBtn(), p)) {
      this.state = addWood(this.state);
      this.sparks = 0.4;
    } else if (this.hit(this.flipBtn(), p)) {
      this.state = flip(this.state);
      this.flipAnim = 1;
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.flipAnim > 0) this.flipAnim = Math.max(0, this.flipAnim - dt * 3);
    if (this.sparks > 0) this.sparks = Math.max(0, this.sparks - dt);

    this.state = tickCook(this.state, dt);

    if (this.state.finished) {
      this.finishClock += dt;
      if (this.finishClock > 0.9 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin();
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;
    const groundY = H * 0.72;

    drawPaper(ctx, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(30,30,40,0.10)';
    ctx.fillRect(0, 0, width, groundY);
    ctx.restore();
    drawGround(ctx, width, groundY, height);

    const cx = width / 2;
    this.drawFire(ctx, cx, groundY);
    this.drawBambooRig(ctx, rough, cx, groundY);

    this.drawGauge(ctx, width);
    this.drawCookBar(ctx, width);
    this.drawButtons(ctx, rough);
    this.drawHud(ctx, width);

    if (this.state.burnt) this.drawBurnt(ctx, rough, width);
  }

  // ---- 火堆（大小随火力） ----
  private drawFire(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const heat = this.state.heat / 100;
    // 柴堆
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 40, groundY);
    ctx.lineTo(cx + 30, groundY - 14);
    ctx.moveTo(cx + 40, groundY);
    ctx.lineTo(cx - 30, groundY - 14);
    ctx.stroke();
    ctx.restore();

    // 火苗（层数/高度随火力）
    const flames = 3 + Math.round(heat * 4);
    for (let i = 0; i < flames; i++) {
      const t = i / flames;
      const flick = Math.sin(this.time * 12 + i * 2) * 4;
      const fx = cx + (i - flames / 2) * 12 + flick;
      const fh = (30 + heat * 60) * (1 - t * 0.4);
      const col = this.state.temp > OVERHEAT ? ['#E4552F', '#F27A2F', '#F2C04B'] : ['#E4772F', '#E8A93A', '#F2E06B'];
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = col[i % 3];
      ctx.beginPath();
      ctx.moveTo(fx - 8, groundY - 12);
      ctx.quadraticCurveTo(fx - 3, groundY - 12 - fh * 0.6, fx, groundY - 12 - fh);
      ctx.quadraticCurveTo(fx + 3, groundY - 12 - fh * 0.6, fx + 8, groundY - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 添柴火花
    if (this.sparks > 0) {
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const a = this.time * 20 + i;
        ctx.globalAlpha = this.sparks * 2;
        ctx.fillStyle = i % 2 ? '#F2E06B' : '#E4772F';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(a) * 30, groundY - 40 - Math.abs(Math.cos(a)) * 30, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- 支架 + 竹筒 ----
  private drawBambooRig(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    cx: number,
    groundY: number,
  ): void {
    const barY = groundY - 96;
    // 支架
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 90, groundY);
    ctx.lineTo(cx - 70, barY);
    ctx.moveTo(cx + 90, groundY);
    ctx.lineTo(cx + 70, barY);
    ctx.moveTo(cx - 78, barY);
    ctx.lineTo(cx + 78, barY);
    ctx.stroke();
    ctx.restore();

    // 竹筒（翻面时上下压扁模拟翻转）
    const squash = 1 - this.flipAnim * 0.7;
    const bw = 150;
    const bh = 30 * squash;
    // 焦色：随 burn 变深
    const burn = this.state.burn / 100;
    const base = `rgb(${Math.round(154 - 60 * burn)},${Math.round(174 - 90 * burn)},${Math.round(96 - 50 * burn)})`;
    ctx.save();
    ctx.translate(cx, barY - 6);
    rough.rectangle(-bw / 2, -bh / 2, bw, bh, {
      fill: base,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1.1,
      seed: 51,
    });
    // 竹节
    ctx.strokeStyle = 'rgba(43,43,43,0.5)';
    ctx.lineWidth = 2;
    for (const dx of [-bw / 4, 0, bw / 4]) {
      ctx.beginPath();
      ctx.moveTo(dx, -bh / 2);
      ctx.lineTo(dx, bh / 2);
      ctx.stroke();
    }
    ctx.restore();

    // 焦度高时冒黑烟
    if (burn > 0.35) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const t = (this.time * 0.7 + i / 3) % 1;
        ctx.globalAlpha = (1 - t) * 0.5 * burn;
        ctx.fillStyle = '#3a3a38';
        ctx.beginPath();
        ctx.arc(cx + Math.sin(this.time * 2 + i) * 12, barY - 20 - t * 60, 5 + t * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- 火候温度表 ----
  private drawGauge(ctx: CanvasRenderingContext2D, width: number): void {
    const gx = width - 60;
    const gy = 60;
    const gh = 200;
    const gw = 22;
    // 轨
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);
    // 最佳绿区
    const yOf = (t: number) => gy + gh * (1 - t / 100);
    ctx.fillStyle = 'rgba(122,139,111,0.55)';
    ctx.fillRect(gx, yOf(BEST_HIGH), gw, yOf(BEST_LOW) - yOf(BEST_HIGH));
    // 过热红线
    ctx.strokeStyle = PALETTE.brick;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, yOf(OVERHEAT));
    ctx.lineTo(gx + gw, yOf(OVERHEAT));
    ctx.stroke();
    // 温度指针
    const ty = yOf(this.state.temp);
    ctx.fillStyle = inBestZone(this.state.temp) ? PALETTE.moss : this.state.temp > OVERHEAT ? PALETTE.brick : PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(gx - 10, ty);
    ctx.lineTo(gx, ty - 6);
    ctx.lineTo(gx, ty + 6);
    ctx.closePath();
    ctx.fill();
    // 标签
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('火候', gx + gw / 2, gy - 6);
    ctx.restore();
  }

  private drawCookBar(ctx: CanvasRenderingContext2D, width: number): void {
    const barW = 220;
    const barH = 16;
    const bx = width / 2 - barW / 2;
    const by = 78;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#D9A441';
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * (this.state.cookedness / 100), barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('熟度', width / 2, by - 10);
    ctx.restore();

    // 焦度警告（burn>0 才显示）
    if (this.state.burn > 5 && !this.state.burnt) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 8);
      ctx.fillStyle = PALETTE.brick;
      ctx.font = handFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`⚠ 焦度 ${Math.round(this.state.burn)}%  火太大了！`, width / 2, by + barH + 6);
      ctx.restore();
    }
  }

  private drawButtons(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    if (this.state.burnt) return;
    const w = this.woodBtn();
    const f = this.flipBtn();
    const advice = cookAdvice(this.state);
    this.drawBtn(ctx, rough, w, '🪵 添柴', PALETTE.ochre, 71, advice === 'add-wood');
    this.drawBtn(ctx, rough, f, '🔄 翻面', PALETTE.mist, 72, advice === 'flip');
  }

  private drawBtn(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    b: Btn,
    label: string,
    color: string,
    seed: number,
    emphasize = false,
  ): void {
    if (emphasize) {
      ctx.save();
      ctx.strokeStyle = PALETTE.brick;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
      ctx.restore();
    }
    rough.rectangle(b.x, b.y, b.w, b.h, {
      fill: color,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1.1,
      seed,
    });
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const advice = cookAdvice(this.state);
    const tip = this.state.finished
      ? '🍚 竹筒饭熟啦，喷香！'
      : this.state.burnt
        ? ''
        : advice === 'add-wood'
          ? '火候偏低，添一把柴'
          : advice === 'flip'
            ? '这一面烤久了，翻面！'
            : advice === 'cool'
              ? '火太旺，先别添柴'
              : '火候在绿区，稳住等熟';
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();
  }

  private drawBurnt(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    width: number,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,43,0.55)';
    ctx.fillRect(0, 0, width, H);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(30);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😵 烤糊啦！火候没控制住', width / 2, H * 0.42);
    ctx.restore();
    const b = this.retryBtn();
    this.drawBtn(ctx, rough, b, '↻ 再来一次', PALETTE.moss, 99);
  }
}
