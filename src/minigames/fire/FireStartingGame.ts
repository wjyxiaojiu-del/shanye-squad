import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, drawPaper, handFont } from '../../render/handdrawn';
import { FireState, createFire, isHeating, tickFire } from './logic';
import {
  DrillMethod,
  FerroMethod,
  FireLayout,
  FireMethod,
  FireMethodId,
  LensMethod,
} from './methods';

const H = 540;

interface Card {
  id: FireMethodId;
  icon: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 原始取火（容器）—— 三选一取火方式：放大镜 / 钻木 / 镁棒。
 * 选方式后委托给对应 FireMethod；温度、火绒、烟火、点燃判定由容器统一管。
 */
export class FireStartingGame implements MiniGame {
  readonly title = '原始取火';

  private phase: 'select' | 'play' = 'select';
  private method: FireMethod | null = null;
  private state: FireState = createFire();
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private heatQuality = 0;
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.phase = 'select';
    this.method = null;
    this.state = createFire();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.heatQuality = 0;
  }

  exit(): void {
    /* 无需清理 */
  }

  private layout(): FireLayout {
    const targetX = this.viewW / 2;
    const targetY = H * 0.78;
    return {
      viewW: this.viewW,
      height: H,
      time: this.time,
      targetX,
      targetY,
      idealY: targetY - 118,
      sunX: this.viewW / 2,
      sunY: 62,
    };
  }

  private cards(): Card[] {
    const w = Math.min(this.viewW * 0.26, 186);
    const gap = Math.min(this.viewW * 0.045, 28);
    const h = 132;
    const total = w * 3 + gap * 2;
    const startX = (this.viewW - total) / 2;
    const y = H * 0.3;
    const defs: Array<Omit<Card, 'x' | 'y' | 'w' | 'h'>> = [
      { id: 'lens', icon: '🔍', label: '放大镜', sub: '聚焦阳光' },
      { id: 'drill', icon: '🪵', label: '钻木', sub: '来回拉弓' },
      { id: 'ferro', icon: '⚡', label: '镁棒', sub: '刮出火花' },
    ];
    return defs.map((d, i) => ({ ...d, x: startX + i * (w + gap), y, w, h }));
  }

  private backRect() {
    return { x: 14, y: 14, w: 96, h: 34 };
  }

  private makeMethod(id: FireMethodId): FireMethod {
    if (id === 'drill') return new DrillMethod();
    if (id === 'ferro') return new FerroMethod();
    return new LensMethod();
  }

  onPointer(p: PointerPos): void {
    if (this.phase === 'select') {
      for (const c of this.cards()) {
        if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
          this.method = this.makeMethod(c.id);
          this.phase = 'play';
          this.state = createFire();
          this.heatQuality = 0;
          this.ctx.audio.play('click');
          return;
        }
      }
      return;
    }
    // play：先看"换方式"按钮
    const b = this.backRect();
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      this.phase = 'select';
      this.method = null;
      this.state = createFire();
      this.heatQuality = 0;
      this.ctx.audio.play('click');
      return;
    }
    this.method?.onDown(p);
  }

  onPointerMove(p: PointerPos): void {
    if (this.phase === 'play') this.method?.onMove(p);
  }
  onPointerUp(): void {
    if (this.phase === 'play') this.method?.onUp();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.phase !== 'play' || !this.method) return;

    this.heatQuality = this.method.update(dt, this.layout());
    this.state = tickFire(this.state, this.heatQuality, dt);

    if (this.state.ignited) {
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
    const layout = this.layout();
    const { targetX, targetY, sunX, sunY } = layout;
    const temp = this.state.temperature;

    drawPaper(ctx, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(143,165,173,0.16)';
    ctx.fillRect(0, 0, width, targetY);
    ctx.restore();
    drawGround(ctx, width, targetY, height);
    this.drawSun(ctx, rough, sunX, sunY);
    this.drawTinder(ctx, rough, targetX, targetY, temp);

    if (this.phase === 'select') {
      this.drawSelect(ctx, rough, width);
      return;
    }

    // play
    this.method?.render(r, layout, temp);
    if (temp > 30 && !this.state.ignited) this.drawSmoke(ctx, targetX, targetY, (temp - 30) / 70);
    if (this.state.ignited) this.drawFlame(ctx, targetX, targetY);
    this.drawHud(ctx, width, temp, this.heatQuality);
    this.drawBack(ctx);
  }

  // ---------------- 公共道具绘制 ----------------
  private drawSun(ctx: CanvasRenderingContext2D, rough: RenderContext['rough'], x: number, y: number): void {
    ctx.save();
    ctx.strokeStyle = '#E4B94A';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.time * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
      ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
      ctx.stroke();
    }
    ctx.restore();
    rough.circle(x, y, 48, {
      fill: '#F2D06B',
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2,
      roughness: 1.1,
      seed: 7,
    });
  }

  private drawTinder(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    x: number,
    y: number,
    temp: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = temp > 60 ? '#8A5A3A' : PALETTE.woodDark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const s of [-1, -0.5, 0, 0.5, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 34, y);
      ctx.lineTo(x + s * 12, y - 22);
      ctx.stroke();
    }
    ctx.restore();
    const heat = Math.min(1, temp / 100);
    rough.circle(x, y - 6, 16, {
      fill: `rgb(${Math.round(150 + 100 * heat)},${Math.round(120 - 60 * heat)},${Math.round(90 - 60 * heat)})`,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 1.5,
      roughness: 1.2,
      seed: 11,
    });
  }

  private drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, intensity: number): void {
    ctx.save();
    const n = 3 + Math.floor(intensity * 3);
    for (let i = 0; i < n; i++) {
      const t = (this.time * 0.8 + i / n) % 1;
      const sx = x + Math.sin(this.time * 2 + i) * 10 * t;
      const sy = y - 10 - t * 70;
      ctx.globalAlpha = (1 - t) * 0.4 * (0.5 + intensity);
      ctx.fillStyle = '#8a8a82';
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + t * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const flick = Math.sin(this.time * 18) * 3;
    const layers = [
      { c: '#E4772F', w: 22, h: 54 },
      { c: '#E8A93A', w: 14, h: 38 },
      { c: '#F2E06B', w: 7, h: 22 },
    ];
    ctx.save();
    for (const l of layers) {
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(x - l.w, y);
      ctx.quadraticCurveTo(x - l.w * 0.4, y - l.h * 0.6, x + flick, y - l.h);
      ctx.quadraticCurveTo(x + l.w * 0.4, y - l.h * 0.6, x + l.w, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- 选择界面 ----------------
  private drawSelect(ctx: CanvasRenderingContext2D, rough: RenderContext['rough'], width: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(244,236,216,0.55)';
    ctx.fillRect(0, 0, width, H);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择取火方式', width / 2, H * 0.2);
    ctx.restore();

    for (const c of this.cards()) {
      rough.rectangle(c.x, c.y, c.w, c.h, {
        fill: PALETTE.paper,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2.5,
        roughness: 1.2,
        seed: c.id === 'lens' ? 31 : c.id === 'drill' ? 32 : 33,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.ink;
      ctx.textBaseline = 'middle';
      ctx.font = handFont(46);
      ctx.fillText(c.icon, c.x + c.w / 2, c.y + 44);
      ctx.font = handFont(21);
      ctx.fillText(c.label, c.x + c.w / 2, c.y + 88);
      ctx.font = handFont(14);
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.fillText(c.sub, c.x + c.w / 2, c.y + 112);
      ctx.restore();
    }
  }

  private drawBack(ctx: CanvasRenderingContext2D): void {
    const b = this.backRect();
    ctx.save();
    ctx.fillStyle = 'rgba(244,236,216,0.85)';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↩ 换方式', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number, temp: number, quality: number): void {
    let tip: string;
    if (this.state.ignited) tip = '🔥 点燃成功！';
    else if (this.method?.id === 'lens') tip = '对准火绒、上下微调让光斑最小最亮，保持住！';
    else if (this.method?.id === 'drill') tip = '手指左右快速来回拉动，越快越稳越热！';
    else tip = '手指在镁棒上快速向下刮，连续刮出火花！';

    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(tip, width / 2, 58);
    ctx.restore();

    const barW = 220;
    const barH = 16;
    const bx = width / 2 - barW / 2;
    const by = 90;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    const heat = temp / 100;
    ctx.fillStyle = `rgb(${Math.round(150 + 90 * heat)},${Math.round(90 + 40 * heat)},${Math.round(60 - 20 * heat)})`;
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * heat, barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('温度', width / 2, by - 10);
    ctx.restore();

    const q = Math.max(0, Math.min(1, quality));
    const heatMsg = this.state.ignited
      ? '火已经起来了'
      : isHeating(q)
        ? '升温中，保持这个节奏'
        : '热量不足，调整动作';
    const qy = by + 34;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, qy, barW, barH);
    ctx.strokeRect(bx, qy, barW, barH);
    ctx.fillStyle = isHeating(q) || this.state.ignited ? PALETTE.moss : PALETTE.ochre;
    ctx.fillRect(bx + 2, qy + 2, (barW - 4) * q, barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`加热强度 · ${heatMsg}`, width / 2, qy + barH + 14);
    ctx.restore();
  }
}
