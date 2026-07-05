import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, drawPaper, handFont } from '../../render/handdrawn';
import {
  BINS,
  TRASH_ITEMS,
  ROUND_SIZE,
  binLabel,
  correctionText,
  isCorrect,
  sortResult,
  type BinType,
  type TrashItem,
  type SortResult,
} from './logic';

const H = 540;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 垃圾分类 —— 物品逐个出现，点对应垃圾桶完成分拣，连击加成，按正确率评星。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class TrashSortGame implements MiniGame {
  readonly title = '垃圾分类';

  private queue: TrashItem[] = [];
  private idx = 0;
  private flags: boolean[] = [];
  private combo = 0;
  private phase: 'show' | 'fly' | 'done' = 'show';
  private flyT = 0;
  private flyTo: BinType | null = null;
  private lastBin: BinType | null = null;
  private correctBin: BinType | null = null;
  private lastCorrect = false;
  private feedback = '';
  private feedbackT = 0;
  private bounce = 0;
  private result: SortResult | null = null;
  private finishClock = 0;
  private winFired = false;
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    // 洗牌取 ROUND_SIZE 个
    const pool = [...TRASH_ITEMS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.queue = pool.slice(0, Math.min(ROUND_SIZE, pool.length));
    this.idx = 0;
    this.flags = [];
    this.combo = 0;
    this.phase = 'show';
    this.flyT = 0;
    this.flyTo = null;
    this.lastBin = null;
    this.correctBin = null;
    this.feedback = '';
    this.feedbackT = 0;
    this.bounce = 0;
    this.result = null;
    this.finishClock = 0;
    this.winFired = false;
  }

  exit(): void {
    /* 无需清理 */
  }

  private binRect(i: number): Rect {
    const n = BINS.length;
    const gap = 12;
    const totalW = Math.min(this.viewW - 40, 540);
    const w = (totalW - gap * (n - 1)) / n;
    const x0 = (this.viewW - totalW) / 2;
    return { x: x0 + i * (w + gap), y: H - 150, w, h: 120 };
  }
  private retryRect(): Rect {
    const w = 200;
    return { x: this.viewW / 2 - w / 2, y: H * 0.62, w, h: 50 };
  }
  private hit(b: Rect, p: PointerPos): boolean {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  onPointer(p: PointerPos): void {
    if (this.phase !== 'show') return;
    for (let i = 0; i < BINS.length; i++) {
      if (this.hit(this.binRect(i), p)) {
        this.sortInto(BINS[i].type);
        return;
      }
    }
  }

  private sortInto(bin: BinType): void {
    const item = this.queue[this.idx];
    const correct = isCorrect(item, bin);
    this.lastBin = bin;
    this.correctBin = item.bin;
    this.flags.push(correct);
    this.lastCorrect = correct;
    if (correct) {
      this.combo += 1;
      this.feedback =
        this.combo >= 3 ? `✓ ${binLabel(bin)} · 连击 ×${this.combo}` : `✓ ${item.name} → ${binLabel(bin)}`;
      this.ctx.audio.play('success');
    } else {
      this.combo = 0;
      this.feedback = `✗ ${correctionText(item)}`;
      this.ctx.audio.play('fail');
    }
    this.feedbackT = 1.1;
    this.flyTo = bin;
    this.flyT = 0;
    this.phase = 'fly';
  }

  update(dt: number): void {
    this.bounce += dt;
    if (this.feedbackT > 0) this.feedbackT = Math.max(0, this.feedbackT - dt);

    if (this.phase === 'fly') {
      this.flyT += dt * 3;
      if (this.flyT >= 1) {
        this.idx += 1;
        if (this.idx >= this.queue.length) {
          this.phase = 'done';
          this.result = sortResult(this.flags);
        } else {
          this.phase = 'show';
        }
      }
    }

    if (this.phase === 'done' && this.result) {
      this.finishClock += dt;
      if (this.finishClock > 1.0 && !this.winFired) {
        if (this.result.success) {
          this.winFired = true;
          this.ctx.onWin({ perf: this.result.perf });
        }
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width } = r;
    this.viewW = width;
    const groundY = H - 150;

    drawPaper(ctx, width, H);
    drawGround(ctx, width, groundY + 118, H);

    this.drawBins(ctx, rough);
    this.drawItem(ctx, width);
    this.drawHud(ctx, width);

    if (this.feedbackT > 0) this.drawFeedback(ctx, width);
    if (this.phase === 'done' && this.result) this.drawResult(ctx, rough, width);
  }

  private drawBins(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    BINS.forEach((bin, i) => {
      const b = this.binRect(i);
      const selected = this.lastBin === bin.type && (this.phase === 'fly' || this.feedbackT > 0);
      const correct = this.correctBin === bin.type && !this.lastCorrect && (this.phase === 'fly' || this.feedbackT > 0);
      // 桶身
      rough.rectangle(b.x, b.y + 18, b.w, b.h - 18, {
        fill: bin.color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2.5,
        roughness: 1.1,
        seed: 70 + i,
      });
      if (selected || correct) {
        ctx.save();
        ctx.setLineDash(correct ? [] : [6, 5]);
        ctx.strokeStyle = correct ? PALETTE.moss : PALETTE.brick;
        ctx.lineWidth = correct ? 4 : 3;
        ctx.strokeRect(b.x - 7, b.y - 1, b.w + 14, b.h + 8);
        ctx.restore();
      }
      // 桶盖
      rough.rectangle(b.x - 4, b.y + 4, b.w + 8, 20, {
        fill: PALETTE.ink,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1,
        seed: 80 + i,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = handFont(30);
      ctx.fillText(bin.emoji, b.x + b.w / 2, b.y + 58);
      ctx.fillStyle = PALETTE.paper;
      ctx.font = handFont(18);
      ctx.fillText(bin.label, b.x + b.w / 2, b.y + b.h - 32);
      ctx.font = handFont(11);
      ctx.fillText(bin.hint, b.x + b.w / 2, b.y + b.h - 12);
      ctx.restore();
    });
  }

  private drawItem(ctx: CanvasRenderingContext2D, width: number): void {
    if (this.phase === 'done') return;
    const item = this.queue[this.idx];
    if (!item) return;
    const startX = width / 2;
    const startY = 150 + Math.sin(this.bounce * 3) * 6;
    let x = startX;
    let y = startY;
    let scale = 1;
    if (this.phase === 'fly' && this.flyTo) {
      const bi = BINS.findIndex((b) => b.type === this.flyTo);
      const b = this.binRect(bi);
      const tx = b.x + b.w / 2;
      const ty = b.y + 40;
      x = lerp(startX, tx, this.flyT);
      y = lerp(startY, ty, this.flyT);
      scale = 1 - this.flyT * 0.5;
    }
    // 物品牌
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = PALETTE.paper;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = handFont(40);
    ctx.fillText(item.emoji, 0, -4);
    ctx.restore();
    if (this.phase === 'show') {
      ctx.save();
      ctx.fillStyle = PALETTE.ink;
      ctx.font = handFont(18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.name, startX, startY + 52);
      ctx.restore();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`第 ${Math.min(this.idx + 1, this.queue.length)} / ${this.queue.length} 件`, 18, 14);
    ctx.textAlign = 'right';
    const correct = this.flags.filter(Boolean).length;
    ctx.fillText(`✓ ${correct}   🔥 连击 ${this.combo}`, width - 18, 14);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText('把它丢进正确的垃圾桶', width / 2, 40);
    ctx.restore();
  }

  private drawFeedback(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.feedbackT * 1.5);
    ctx.fillStyle = this.lastCorrect ? PALETTE.moss : PALETTE.brick;
    ctx.font = handFont(24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedback, width / 2, 92);
    ctx.restore();
  }

  private drawResult(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    width: number,
  ): void {
    if (!this.result) return;
    if (this.result.success) return; // 成功交给 onWin 的成功卡片
    // 未达标：本地重来
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,43,0.55)';
    ctx.fillRect(0, 0, width, H);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(26);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `分对 ${this.result.correct}/${this.result.total}，再仔细点～`,
      width / 2,
      H * 0.44,
    );
    ctx.restore();
    const b = this.retryRect();
    rough.rectangle(b.x, b.y, b.w, b.h, {
      fill: PALETTE.moss,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1.1,
      seed: 99,
    });
    ctx.save();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(19);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻ 再来一次', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  // 结果页的"再来一次"点击
  onPointerUp(p: PointerPos): void {
    if (this.phase === 'done' && this.result && !this.result.success) {
      if (this.hit(this.retryRect(), p)) this.enter();
    }
  }
}
