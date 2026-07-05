import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, handFont } from '../../render/handdrawn';
import {
  RoastState,
  createRoast,
  tickRoast,
  serveRoast,
  roastResult,
  roastAdvice,
  RoastResult,
  GOLDEN_MIN,
} from './logic';

const H = 540;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 烤棉花糖 —— 按住"靠近火"探向火焰控制热度，烤到金黄出炉，太近太久会烤焦。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class MarshmallowGame implements MiniGame {
  readonly title = '烤棉花糖';

  private state: RoastState = createRoast();
  private mh = 1; // 棉花糖高度 0..1（0=探入火焰，1=远离）
  private holding = false;
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private result: RoastResult | null = null;
  private flash = '';
  private flashT = 0;
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.state = createRoast();
    this.mh = 1;
    this.holding = false;
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.result = null;
    this.flash = '';
    this.flashT = 0;
  }

  exit(): void {
    /* 无需清理 */
  }

  private fireBtn(): Btn {
    const w = Math.min(this.viewW * 0.32, 200);
    return { x: this.viewW / 2 - w - 12, y: H - 74, w, h: 52 };
  }
  private serveBtn(): Btn {
    const w = Math.min(this.viewW * 0.32, 200);
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
      if (this.hit(this.retryBtn(), p)) this.enter();
      return;
    }
    if (this.state.finished) return;
    if (this.hit(this.fireBtn(), p)) {
      this.holding = true;
    } else if (this.hit(this.serveBtn(), p)) {
      const res = roastResult(this.state);
      if (res.success) {
        this.state = serveRoast(this.state);
        this.result = res;
        this.ctx.audio.play('success');
      } else {
        this.flash = res.message;
        this.flashT = 1.4;
        this.ctx.audio.play('fail');
      }
    }
  }
  onPointerUp(): void {
    this.holding = false;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);

    if (!this.state.finished && !this.state.burnt) {
      // 按住下探(靠火)，松手上抬(离火)
      this.mh = Math.max(0, Math.min(1, this.mh + (this.holding ? -1.4 : 1.1) * dt));
      const heat = Math.max(0, Math.min(1, 1 - this.mh));
      this.state = tickRoast(this.state, heat, dt);
      if (this.state.burnt) this.ctx.audio.play('fail');
    }

    if (this.state.finished) {
      this.finishClock += dt;
      if (this.finishClock > 0.9 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin({ perf: this.result?.perf ?? 1 });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width } = r;
    this.viewW = width;
    const groundY = H * 0.74;

    // 夜色渐变背景（篝火氛围）
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#2C3550');
    sky.addColorStop(1, '#6B5E7A');
    ctx.save();
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, groundY);
    ctx.restore();
    drawGround(ctx, width, groundY, H);

    const cx = width / 2;
    this.drawFire(ctx, cx, groundY);
    this.drawMarshmallow(ctx, cx, groundY);

    this.drawDoneBar(ctx, width);
    this.drawButtons(ctx, rough);
    this.drawHud(ctx, width);

    if (this.state.burnt) this.drawBurnt(ctx, rough, width);
    if (this.state.finished && this.result) this.drawServed(ctx, width);
  }

  // ---- 篝火（火苗随时间跳动） ----
  private drawFire(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 44, groundY);
    ctx.lineTo(cx + 32, groundY - 14);
    ctx.moveTo(cx + 44, groundY);
    ctx.lineTo(cx - 32, groundY - 14);
    ctx.stroke();
    ctx.restore();

    const flames = 6;
    for (let i = 0; i < flames; i++) {
      const t = i / flames;
      const flick = Math.sin(this.time * 12 + i * 2) * 5;
      const fx = cx + (i - flames / 2) * 13 + flick;
      const fh = (46 + Math.sin(this.time * 8 + i) * 8) * (1 - t * 0.4);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = ['#E4772F', '#E8A93A', '#F2E06B'][i % 3];
      ctx.beginPath();
      ctx.moveTo(fx - 9, groundY - 12);
      ctx.quadraticCurveTo(fx - 3, groundY - 12 - fh * 0.6, fx, groundY - 12 - fh);
      ctx.quadraticCurveTo(fx + 3, groundY - 12 - fh * 0.6, fx + 9, groundY - 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- 棉花糖 + 扦子 ----
  private drawMarshmallow(ctx: CanvasRenderingContext2D, cx: number, groundY: number): void {
    const flameTop = groundY - 60;
    const blobY = flameTop - 20 - this.mh * 150; // mh 越小越贴近火
    const d = this.state.doneness / 100;
    const b = this.state.burn / 100;
    // 白 → 金黄 → 焦黑
    let cr = lerp(245, 205, d);
    let cg = lerp(240, 150, d);
    let cb = lerp(225, 70, d);
    cr = lerp(cr, 42, b);
    cg = lerp(cg, 32, b);
    cb = lerp(cb, 28, b);
    const col = `rgb(${cr | 0},${cg | 0},${cb | 0})`;

    // 扦子（从右上伸入）
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 200, blobY - 70);
    ctx.lineTo(cx, blobY);
    ctx.stroke();
    ctx.restore();

    // 棉花糖（缓慢自转呈现均匀烤色）
    ctx.save();
    ctx.translate(cx, blobY);
    ctx.rotate(Math.sin(this.time * 1.5) * 0.25);
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(43,43,43,0.55)';
    ctx.lineWidth = 2;
    this.roundedRect(ctx, -20, -18, 40, 36, 12);
    ctx.fill();
    ctx.stroke();
    // 焦斑
    if (b > 0.15) {
      ctx.fillStyle = `rgba(40,28,24,${Math.min(0.8, b)})`;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + this.time * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 10, Math.sin(a * 1.3) * 8, 2 + b * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- 烤度条 + 焦化警告 ----
  private drawDoneBar(ctx: CanvasRenderingContext2D, width: number): void {
    const barW = 240;
    const barH = 16;
    const bx = width / 2 - barW / 2;
    const by = 66;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    // 金黄达标区（GOLDEN_MIN..100）
    ctx.fillStyle = 'rgba(216,164,65,0.35)';
    ctx.fillRect(bx + 2 + (barW - 4) * (GOLDEN_MIN / 100), by + 2, (barW - 4) * (1 - GOLDEN_MIN / 100), barH - 4);
    // 烤度填充
    ctx.fillStyle = '#D8A441';
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * (this.state.doneness / 100), barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('金黄度', width / 2, by - 4);
    ctx.restore();

    if (this.state.burn > 8 && !this.state.burnt) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 9);
      ctx.fillStyle = PALETTE.brick;
      ctx.font = handFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`⚠ 有点焦了(${Math.round(this.state.burn)}%)，离火一点！`, width / 2, by + barH + 6);
      ctx.restore();
    }
  }

  private drawButtons(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    if (this.state.burnt || this.state.finished) return;
    const advice = roastAdvice(this.state, 1 - this.mh);
    this.drawBtn(
      ctx,
      rough,
      this.fireBtn(),
      this.holding ? '🔥 靠火中…' : '🔥 按住靠近火',
      PALETTE.brick,
      61,
      advice === 'move-closer',
    );
    this.drawBtn(ctx, rough, this.serveBtn(), '🍡 出炉', PALETTE.moss, 62, advice === 'serve');
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
      ctx.strokeStyle = PALETTE.paper;
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
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(19);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tip =
      this.flashT > 0
        ? this.flash
        : this.state.finished
          ? '🍡 出炉！'
          : this.state.burnt
            ? ''
            : this.roastTip();
    ctx.fillText(tip, width / 2, 16);
    ctx.restore();
  }

  private roastTip(): string {
    const advice = roastAdvice(this.state, 1 - this.mh);
    if (advice === 'move-closer') return '离火远了，按住靠近火';
    if (advice === 'move-away') return '太热了，松手离火一点';
    if (advice === 'serve') return '颜色正好，可以出炉！';
    return '保持这个距离，慢慢烤';
  }

  private drawServed(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.result?.message ?? '', width / 2, H * 0.44);
    ctx.restore();
  }

  private drawBurnt(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    width: number,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,43,0.6)';
    ctx.fillRect(0, 0, width, H);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😵 烤成小木炭啦！', width / 2, H * 0.42);
    ctx.restore();
    this.drawBtn(ctx, rough, this.retryBtn(), '↻ 再来一次', PALETTE.moss, 99);
  }
}
