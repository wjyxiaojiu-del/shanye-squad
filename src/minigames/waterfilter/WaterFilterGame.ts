import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, drawPaper, handFont } from '../../render/handdrawn';
import {
  LAYERS,
  CORRECT_ORDER,
  layerById,
  nextExpected,
  isCorrectNext,
  isComplete,
  filterResult,
  type FilterLayer,
  type FilterResult,
} from './logic';

const H = 540;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 净水大作战 —— 从下往上按正确顺序铺滤层，铺满后脏水层层过滤变清。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class WaterFilterGame implements MiniGame {
  readonly title = '净水大作战';

  private placed: string[] = [];
  private mistakes = 0;
  private palette: FilterLayer[] = [];
  private phase: 'build' | 'pour' | 'done' = 'build';
  private pourT = 0;
  private feedback = '';
  private feedbackT = 0;
  private shakeId: string | null = null;
  private shakeT = 0;
  private result: FilterResult | null = null;
  private winFired = false;
  private time = 0;
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.palette = [...LAYERS];
    for (let i = this.palette.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.palette[i], this.palette[j]] = [this.palette[j], this.palette[i]];
    }
    this.placed = [];
    this.mistakes = 0;
    this.phase = 'build';
    this.pourT = 0;
    this.feedback = '';
    this.feedbackT = 0;
    this.shakeId = null;
    this.shakeT = 0;
    this.result = null;
    this.winFired = false;
    this.time = 0;
  }

  exit(): void {
    /* 无需清理 */
  }

  // 瓶身
  private jar(): Rect {
    const w = 150;
    return { x: this.viewW / 2 - w / 2, y: 96, w, h: 240 };
  }

  private tileRect(i: number): Rect {
    const n = LAYERS.length;
    const gap = 8;
    const totalW = Math.min(this.viewW - 32, 560);
    const w = (totalW - gap * (n - 1)) / n;
    const x0 = (this.viewW - totalW) / 2;
    return { x: x0 + i * (w + gap), y: H - 96, w, h: 76 };
  }

  private hit(b: Rect, p: PointerPos): boolean {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  onPointer(p: PointerPos): void {
    if (this.phase !== 'build') return;
    for (let i = 0; i < this.palette.length; i++) {
      const layer = this.palette[i];
      if (this.placed.includes(layer.id)) continue; // 已放
      if (this.hit(this.tileRect(i), p)) {
        this.tap(layer);
        return;
      }
    }
  }

  private tap(layer: FilterLayer): void {
    if (isCorrectNext(this.placed.length, layer.id)) {
      this.placed.push(layer.id);
      this.feedback = `✓ 第 ${this.placed.length} 层：${layer.name}`;
      this.feedbackT = 1.0;
      this.ctx.audio.play('success');
      if (isComplete(this.placed.length)) {
        this.phase = 'pour';
        this.pourT = 0;
      }
    } else {
      this.mistakes += 1;
      const want = layerById(nextExpected(this.placed.length) ?? '');
      this.feedback = `✗ 第 ${this.placed.length + 1} 层应放「${want?.name ?? ''}」`;
      this.feedbackT = 1.2;
      this.shakeId = layer.id;
      this.shakeT = 0.4;
      this.ctx.audio.play('fail');
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.feedbackT > 0) this.feedbackT = Math.max(0, this.feedbackT - dt);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);

    if (this.phase === 'pour') {
      this.pourT += dt * 0.6;
      if (this.pourT >= 1) {
        this.phase = 'done';
        this.result = filterResult(this.mistakes);
      }
    }
    if (this.phase === 'done' && this.result && !this.winFired) {
      this.pourT += dt * 0.3;
      if (this.pourT >= 1.8) {
        this.winFired = true;
        this.ctx.onWin({ perf: this.result.perf });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width } = r;
    this.viewW = width;
    drawPaper(ctx, width, H);
    drawGround(ctx, width, H - 150, H);

    this.drawJar(ctx, rough);
    if (this.phase !== 'build') this.drawPour(ctx);
    this.drawPalette(ctx, rough);
    this.drawHud(ctx, width);
    if (this.feedbackT > 0) this.drawFeedback(ctx, width);
  }

  private drawJar(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    const j = this.jar();
    // 瓶（倒置漏斗口在上，出水口在下）
    rough.rectangle(j.x, j.y, j.w, j.h, {
      fill: 'rgba(200,220,225,0.25)',
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1,
      seed: 40,
    });
    // 出水口
    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(j.x + j.w / 2 - 12, j.y + j.h);
    ctx.lineTo(j.x + j.w / 2, j.y + j.h + 18);
    ctx.lineTo(j.x + j.w / 2 + 12, j.y + j.h);
    ctx.stroke();
    ctx.restore();

    if (this.viewW > 520) {
      ctx.save();
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.font = handFont(12);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('脏水从上进', j.x + j.w + 18, j.y + 16);
      ctx.fillText('清水从下出', j.x + j.w + 18, j.y + j.h + 26);
      ctx.strokeStyle = PALETTE.inkSoft;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(j.x + j.w + 8, j.y - 14);
      ctx.lineTo(j.x + j.w + 8, j.y + 34);
      ctx.moveTo(j.x + j.w + 4, j.y + 28);
      ctx.lineTo(j.x + j.w + 8, j.y + 34);
      ctx.lineTo(j.x + j.w + 12, j.y + 28);
      ctx.stroke();
      ctx.restore();
    }

    // 已铺滤层（从下往上）
    const n = CORRECT_ORDER.length;
    const bandH = (j.h - 6) / n;
    this.placed.forEach((id, i) => {
      const layer = layerById(id)!;
      const by = j.y + j.h - 3 - (i + 1) * bandH;
      ctx.save();
      ctx.fillStyle = layer.color;
      ctx.fillRect(j.x + 3, by, j.w - 6, bandH - 2);
      // 颗粒质感
      ctx.fillStyle = 'rgba(43,43,43,0.18)';
      for (let k = 0; k < 10; k++) {
        const gx = j.x + 8 + ((k * 37) % (j.w - 16));
        const gy = by + ((k * 19) % (bandH - 4)) + 2;
        ctx.fillRect(gx, gy, 3, 3);
      }
      ctx.fillStyle = id === 'charcoal' ? PALETTE.paper : PALETTE.ink;
      ctx.globalAlpha = id === 'charcoal' ? 0.9 : 0.82;
      ctx.font = handFont(11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}. ${layer.name}`, j.x + j.w / 2, by + bandH / 2);
      ctx.restore();
    });

    // 下一层目标槽：直接在瓶内高亮，避免上下方向理解反了。
    if (this.phase === 'build') {
      const want = layerById(nextExpected(this.placed.length) ?? '');
      if (want) {
        const i = this.placed.length;
        const by = j.y + j.h - 3 - (i + 1) * bandH;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = want.color;
        ctx.fillRect(j.x + 3, by, j.w - 6, bandH - 2);
        ctx.globalAlpha = 1;
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = PALETTE.moss;
        ctx.lineWidth = 2;
        ctx.strokeRect(j.x + 5, by + 2, j.w - 10, bandH - 6);
        ctx.fillStyle = PALETTE.ink;
        ctx.font = handFont(13);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`第 ${i + 1} 层：${want.name}`, j.x + j.w / 2, by + bandH / 2);
        ctx.restore();
      }
    }
  }

  private drawPour(ctx: CanvasRenderingContext2D): void {
    const j = this.jar();
    const cx = j.x + j.w / 2;
    // 上方脏水流入（前半段浑浊）
    const clarity = this.result?.clarity ?? 0.6;
    const t = Math.min(1, this.pourT);
    ctx.save();
    ctx.strokeStyle = `rgba(120,140,120,${0.6 * (1 - t * 0.3)})`;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, j.y - 40);
    ctx.lineTo(cx, j.y + 6);
    ctx.stroke();
    ctx.restore();

    // 出水口清水滴（清澈度由 clarity 决定）
    if (this.pourT > 0.5) {
      const g = Math.round(150 + clarity * 60);
      ctx.save();
      ctx.fillStyle = `rgb(${Math.round(120 + clarity * 60)},${g},${Math.round(200 + clarity * 40)})`;
      for (let i = 0; i < 3; i++) {
        const dt2 = (this.time * 1.5 + i / 3) % 1;
        const dy = j.y + j.h + 18 + dt2 * 90;
        ctx.globalAlpha = 1 - dt2;
        ctx.beginPath();
        ctx.arc(cx, dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 接水杯
      ctx.save();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - 26, j.y + j.h + 108, 52, 40);
      ctx.fillStyle = `rgba(${Math.round(120 + clarity * 60)},${Math.round(170 + clarity * 50)},235,0.6)`;
      const fillH = Math.min(34, (this.pourT - 0.5) * 40);
      ctx.fillRect(cx - 24, j.y + j.h + 146 - fillH, 48, fillH);
      ctx.restore();
    }

    if (this.phase === 'done') {
      ctx.save();
      ctx.fillStyle = PALETTE.ink;
      ctx.font = handFont(20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = clarity > 0.85 ? '💧 清澈见底，可以喝啦！' : clarity > 0.5 ? '💧 水变清了，不错！' : '💧 勉强能用，顺序要更准';
      ctx.fillText(msg, this.viewW / 2, 60);
      ctx.restore();
    }
  }

  private drawPalette(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    if (this.phase !== 'build') return;
    this.palette.forEach((layer, i) => {
      const used = this.placed.includes(layer.id);
      const b = this.tileRect(i);
      const shake = this.shakeId === layer.id && this.shakeT > 0 ? Math.sin(this.time * 40) * 4 : 0;
      ctx.save();
      ctx.translate(shake, 0);
      rough.rectangle(b.x, b.y, b.w, b.h, {
        fill: used ? PALETTE.paperDark : layer.color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2.5,
        roughness: 1.1,
        seed: 50 + i,
      });
      ctx.globalAlpha = used ? 0.4 : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = handFont(26);
      ctx.fillText(layer.emoji, b.x + b.w / 2, b.y + b.h / 2 - 8);
      ctx.fillStyle = PALETTE.ink;
      ctx.font = handFont(14);
      ctx.fillText(used ? '已放' : layer.name, b.x + b.w / 2, b.y + b.h - 14);
      ctx.restore();
    });
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.font = handFont(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const want = layerById(nextExpected(this.placed.length) ?? '');
    const stepText = want
      ? `第 ${this.placed.length + 1}/${CORRECT_ORDER.length} 层：${want.name}`
      : '滤层铺好了，准备倒水';
    ctx.fillText(`${stepText} · 从出水口往上铺`, width / 2, 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.mistakes > 0 ? PALETTE.brick : PALETTE.inkSoft;
    ctx.fillText(`失误 ${this.mistakes}`, width - 16, 36);
    ctx.restore();
  }

  private drawFeedback(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.feedbackT * 1.5);
    ctx.fillStyle = this.feedback.startsWith('✓') ? PALETTE.moss : PALETTE.brick;
    ctx.font = handFont(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedback, width / 2, H - 128);
    ctx.restore();
  }
}
