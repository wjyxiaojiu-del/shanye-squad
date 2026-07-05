import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import {
  PALETTE,
  drawGround,
  drawPaper,
  drawTent,
  drawTree,
  handFont,
} from '../../render/handdrawn';
import {
  Item,
  ItemKind,
  LntState,
  PRINCIPLES,
  actionTextForKind,
  clickItem,
  createLnt,
  isLitter,
  litterTotal,
  lntProgress,
  principleByN,
  principleForKind,
} from './logic';

const DESIGN_W = 960;
const H = 540;
const HIT_R = 40; // 点击命中半径

/** 一次清理的飞行动画 */
interface Poof {
  x: number;
  y: number;
  t: number; // 0..1
  kind: ItemKind;
}
/** 点天然物的文字提示 */
interface Toast {
  x: number;
  y: number;
  t: number;
  text: string;
}

/**
 * 无痕山林 —— 点击清理营地里的人为痕迹，天然物不能动。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class LeaveNoTraceGame implements MiniGame {
  readonly title = '无痕山林';

  private phase: 'learn' | 'clean' = 'learn';
  private state: LntState = createLnt();
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private poofs: Poof[] = [];
  private toasts: Toast[] = [];
  /** 顶部"准则横幅"：清理时展示对应准则 */
  private banner: { text: string; t: number } | null = null;
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.phase = 'learn';
    this.state = createLnt();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.poofs = [];
    this.toasts = [];
    this.banner = null;
  }

  exit(): void {
    /* 无需清理 */
  }

  /** 设计坐标 → 屏幕 x（按当前视宽缩放，保持居中比例） */
  private sx(x: number): number {
    return (x / DESIGN_W) * this.viewW;
  }

  /** 学习页"开始清理"按钮区域 */
  private startBtnRect() {
    const w = Math.min(this.viewW * 0.42, 260);
    return { x: this.viewW / 2 - w / 2, y: H - 66, w, h: 44 };
  }

  onPointer(p: PointerPos): void {
    if (this.phase === 'learn') {
      const b = this.startBtnRect();
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        this.phase = 'clean';
      }
      return;
    }

    if (this.state.finished) return;
    // 找命中的物品（屏幕距离最近）
    let hit: Item | null = null;
    let bestD = HIT_R;
    for (const it of this.state.items) {
      const d = Math.hypot(p.x - this.sx(it.x), p.y - it.y);
      if (d <= bestD) {
        bestD = d;
        hit = it;
      }
    }
    if (!hit) return;

    const out = clickItem(this.state, hit.id);
    this.state = out.state;
    if (out.result === 'cleaned') {
      this.poofs.push({ x: this.sx(hit.x), y: hit.y, t: 0, kind: hit.kind });
      this.toasts.push({ x: this.sx(hit.x), y: hit.y - 30, t: 1, text: actionTextForKind(hit.kind) });
      this.ctx.audio.play(hit.kind === 'campfire' ? 'splash' : 'pickup');
      // 弹出该痕迹对应的 LNT 准则
      const pr = principleByN(principleForKind(hit.kind));
      this.banner = { text: `准则 ${pr.n} · ${pr.title}`, t: 2.4 };
    } else if (out.result === 'natural') {
      const pr = principleByN(4);
      this.toasts.push({ x: this.sx(hit.x), y: hit.y - 30, t: 1, text: actionTextForKind(hit.kind) });
      this.ctx.audio.play('fail');
      this.banner = { text: `准则 ${pr.n} · ${pr.title}`, t: 2.4 };
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.phase === 'learn') return;

    for (const p of this.poofs) p.t += dt * 2.2;
    this.poofs = this.poofs.filter((p) => p.t < 1);
    for (const t of this.toasts) t.t -= dt * 0.7;
    this.toasts = this.toasts.filter((t) => t.t > 0);

    if (this.state.finished) {
      this.finishClock += dt;
      if (this.finishClock > 0.8 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin();
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;
    const groundY = H * 0.62;

    // 背景
    drawPaper(ctx, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(143,165,173,0.14)';
    ctx.fillRect(0, 0, width, groundY);
    ctx.restore();
    drawGround(ctx, width, groundY, height);

    // 营地布景
    drawTree(rough, this.sx(90), groundY, 1.5, 61);
    drawTree(rough, this.sx(900), groundY, 1.3, 63);
    drawTent(rough, this.sx(770), groundY + 6, 65);

    if (this.phase === 'learn') {
      this.drawLearn(ctx, rough, width, height);
      return;
    }

    // 物品
    for (const it of this.state.items) {
      if (it.cleaned) continue;
      this.drawItem(r, it);
    }

    // 清理飞屑动画
    this.drawPoofs(ctx);
    // 天然物提示
    this.drawToasts(ctx);
    // 背包（右下，收纳指示）
    this.drawBackpack(ctx, width, height);

    this.drawHud(ctx, width);
    this.drawBanner(ctx, width);
  }

  /** 学习页：七大准则图鉴 + 开始清理按钮 */
  private drawLearn(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    width: number,
    height: number,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(244,236,216,0.82)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('无痕山林 · 七大准则', width / 2, 20);
    ctx.font = handFont(14);
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText('记住这七条，出发前先在心里过一遍', width / 2, 52);
    ctx.restore();

    // 3×3 网格排 7 条（最后两格留空/居中感）
    const cols = width < 640 ? 2 : 4;
    const rows = Math.ceil(PRINCIPLES.length / cols);
    const cellW = Math.min((width - 60) / cols, 220);
    const cellH = 82;
    const gridW = cellW * cols;
    const startX = (width - gridW) / 2;
    const startY = 80;

    PRINCIPLES.forEach((p, i) => {
      const cx = startX + (i % cols) * cellW;
      const cy = startY + Math.floor(i / cols) * (cellH + 8);
      rough.rectangle(cx + 4, cy, cellW - 8, cellH, {
        fill: PALETTE.paper,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.2,
        seed: 40 + p.n,
      });
      ctx.save();
      ctx.textBaseline = 'top';
      // 序号圈 + emoji
      ctx.font = handFont(22);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(`${p.emoji}`, cx + 14, cy + 12);
      ctx.font = handFont(16);
      ctx.fillText(`${p.n}. ${p.title}`, cx + 44, cy + 14);
      // 描述（截断到卡内）
      ctx.font = handFont(12);
      ctx.fillStyle = PALETTE.inkSoft;
      this.wrapText(ctx, p.desc, cx + 14, cy + 42, cellW - 28, 15);
      ctx.restore();
    });
    void rows;

    // 开始清理按钮
    const b = this.startBtnRect();
    rough.rectangle(b.x, b.y, b.w, b.h, {
      fill: PALETTE.moss,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1.1,
      seed: 88,
    });
    ctx.save();
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('开始清理营地 →', b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  /** 简单折行绘制 */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number,
  ): void {
    let line = '';
    let yy = y;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, x, yy);
        line = ch;
        yy += lineH;
      } else {
        line += ch;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  /** 清理时顶部准则横幅 */
  private drawBanner(ctx: CanvasRenderingContext2D, width: number): void {
    if (!this.banner) return;
    const alpha = Math.min(1, this.banner.t);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.moss;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    const w = Math.min(width * 0.7, 340);
    const x = width / 2 - w / 2;
    const y = 74;
    ctx.fillRect(x, y, w, 30);
    ctx.strokeRect(x, y, w, 30);
    ctx.fillStyle = PALETTE.paper;
    ctx.font = handFont(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`✅ ${this.banner.text}`, width / 2, y + 15);
    ctx.restore();
  }

  private drawItem(r: RenderContext, it: Item): void {
    const { ctx } = r;
    const x = this.sx(it.x);
    const y = it.y;
    const litter = isLitter(it.kind);

    // 可清理物：轻微呼吸高亮圈，提示"可点"；天然物不加圈
    if (litter) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3 + it.id);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * pulse;
      ctx.strokeStyle = PALETTE.moss;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.font = handFont(34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.iconFor(it.kind), x, y);
    ctx.restore();

    // 没熄的火堆额外画小火苗跳动
    if (it.kind === 'campfire') {
      const flick = Math.sin(this.time * 16) * 2;
      ctx.save();
      ctx.fillStyle = '#E4772F';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 6);
      ctx.quadraticCurveTo(x - 2, y - 8 + flick, x + flick, y - 14);
      ctx.quadraticCurveTo(x + 3, y - 8, x + 6, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private iconFor(kind: ItemKind): string {
    switch (kind) {
      case 'trash-peel':
        return '🍌';
      case 'trash-bottle':
        return '🧴';
      case 'trash-can':
        return '🥫';
      case 'trash-bag':
        return '🛍️';
      case 'campfire':
        return '🔥';
      case 'carved-tree':
        return '🪓';
      case 'rock':
        return '🪨';
      case 'flower':
        return '🌼';
      case 'mushroom':
        return '🍄';
    }
  }

  private drawPoofs(ctx: CanvasRenderingContext2D): void {
    for (const p of this.poofs) {
      const bagX = this.viewW - 60;
      const bagY = H - 60;
      // 飞向背包
      const cx = p.x + (bagX - p.x) * p.t;
      const cy = p.y + (bagY - p.y) * p.t - Math.sin(p.t * Math.PI) * 40;
      ctx.save();
      ctx.globalAlpha = 1 - p.t;
      ctx.font = handFont(28 * (1 - p.t * 0.5));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.iconFor(p.kind), cx, cy);
      ctx.restore();
    }
  }

  private drawToasts(ctx: CanvasRenderingContext2D): void {
    for (const t of this.toasts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.t);
      ctx.fillStyle = PALETTE.moss;
      ctx.font = handFont(15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t.text, t.x, t.y - (1 - t.t) * 16);
      ctx.restore();
    }
  }

  private drawBackpack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const x = width - 60;
    const y = height - 60;
    ctx.save();
    ctx.font = handFont(40);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎒', x, y);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    const cleaned = this.state.items.filter((it) => it.cleaned).length;
    const total = litterTotal(this.state);

    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tip = this.state.finished
      ? '🌿 无痕山林！营地恢复原样'
      : '点击清理营地里的垃圾和痕迹，天然的东西别动';
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();

    // 进度条
    const barW = 200;
    const barH = 15;
    const bx = width / 2 - barW / 2;
    const by = 42;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * lntProgress(this.state), barH - 4);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`已清理 ${cleaned} / ${total}`, width / 2, by + barH + 12);
    ctx.restore();
  }
}
