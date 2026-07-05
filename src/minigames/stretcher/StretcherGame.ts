import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawGround, drawPaper, drawPixelHero, handFont } from '../../render/handdrawn';
import {
  PartId,
  STEPS,
  StretcherState,
  createStretcher,
  currentStep,
  isPlaced,
  placePart,
  stepByPart,
} from './logic';

const H = 540;
const DESIGN_W = 960;

/** 托盘里一个可拖材料 */
interface Tray {
  part: PartId;
  x: number; // 托盘原位（屏幕）
  y: number;
}

/**
 * 简易担架（分步组装）—— 把材料按正确顺序拖到目标槽位，组成担架。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class StretcherGame implements MiniGame {
  readonly title = '简易担架';

  private state: StretcherState = createStretcher();
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private viewW: number;

  // 拖拽
  private dragPart: PartId | null = null;
  private dragPos: PointerPos = { x: 0, y: 0 };
  private wrongFlash = 0; // 顺序错误红闪

  // 承重测试：成型后小人躺上去
  private restClock = 0;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.state = createStretcher();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.dragPart = null;
    this.wrongFlash = 0;
    this.restClock = 0;
  }

  exit(): void {
    /* 无需清理 */
  }

  private sx(x: number): number {
    return (x / DESIGN_W) * this.viewW;
  }

  /** 托盘材料位置（底部一排，未放置的才显示） */
  private trays(): Tray[] {
    const parts: PartId[] = ['pole-left', 'pole-right', 'shirt', 'pants', 'rope'];
    const remain = parts.filter((p) => !isPlaced(this.state, p));
    const n = remain.length;
    const gap = Math.min(this.viewW / 6, 150);
    const startX = this.viewW / 2 - ((n - 1) * gap) / 2;
    const y = H - 66;
    return remain.map((part, i) => ({ part, x: startX + i * gap, y }));
  }

  private trayHit(p: PointerPos): PartId | null {
    for (const t of this.trays()) {
      if (Math.hypot(p.x - t.x, p.y - t.y) < 46) return t.part;
    }
    return null;
  }

  onPointer(p: PointerPos): void {
    if (this.state.finished) return;
    const part = this.trayHit(p);
    if (part) {
      this.dragPart = part;
      this.dragPos = p;
    }
  }

  onPointerMove(p: PointerPos): void {
    if (this.dragPart) this.dragPos = p;
  }

  onPointerUp(p: PointerPos): void {
    if (!this.dragPart) return;
    const part = this.dragPart;
    this.dragPart = null;

    // 松手位置离目标槽位够近才算放置
    const step = currentStep(this.state);
    const target = stepByPart(part).slot;
    const near = Math.hypot(p.x - this.sx(target.x), p.y - target.y) < 80;

    if (step && step.part === part && near) {
      this.state = placePart(this.state, part).state;
    } else if (step && step.part !== part) {
      // 顺序不对
      this.wrongFlash = 0.6;
    } else if (!near) {
      // 放歪了：无事发生，材料弹回托盘
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.wrongFlash > 0) this.wrongFlash = Math.max(0, this.wrongFlash - dt);

    if (this.state.finished) {
      this.restClock += dt;
      this.finishClock += dt;
      if (this.finishClock > 1.4 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin();
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;
    const groundY = H * 0.82;

    drawPaper(ctx, width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(143,165,173,0.12)';
    ctx.fillRect(0, 0, width, groundY);
    ctx.restore();
    drawGround(ctx, width, groundY, height);

    // 目标区：当前步骤的槽位高亮
    this.drawSlots(ctx);

    // 已放置的部件（组成担架）
    this.drawAssembly(ctx, rough);

    // 承重测试：成型后小人躺上
    if (this.state.finished) this.drawRestTest(ctx);

    // 托盘材料
    this.drawTrays(ctx, rough);

    // 拖拽中的材料
    if (this.dragPart) this.drawPart(ctx, rough, this.dragPart, this.dragPos.x, this.dragPos.y, 1);

    this.drawHud(ctx, width);
  }

  /** 目标槽位：当前步骤高亮虚线圈 */
  private drawSlots(ctx: CanvasRenderingContext2D): void {
    const step = currentStep(this.state);
    if (!step) return;
    const x = this.sx(step.slot.x);
    const y = step.slot.y;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.4 * pulse;
    ctx.strokeStyle = this.wrongFlash > 0 ? PALETTE.brick : PALETTE.moss;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 放这里
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.font = handFont(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('放这里', x, y - 60);
    ctx.restore();
  }

  /** 已放置部件组成的担架 */
  private drawAssembly(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    for (const part of this.state.placed) {
      const slot = stepByPart(part).slot;
      this.drawPart(ctx, rough, part, this.sx(slot.x), slot.y, 1);
    }
  }

  /** 托盘材料（未放置的） */
  private drawTrays(ctx: CanvasRenderingContext2D, rough: RenderContext['rough']): void {
    // 托盘底板
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,43,0.06)';
    ctx.fillRect(0, H - 96, this.viewW, 96);
    ctx.restore();

    for (const t of this.trays()) {
      if (this.dragPart === t.part) continue; // 拖起来的不在托盘画
      const step = currentStep(this.state);
      const isNext = step?.part === t.part;
      // 下一个该放的材料：轻微高亮
      if (isNext) {
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.time * 5);
        ctx.strokeStyle = PALETTE.moss;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      this.drawPart(ctx, rough, t.part, t.x, t.y, isNext ? 1 : 0.7);
    }
  }

  /** 画一个部件（木棍/上衣/裤子/绳结） */
  private drawPart(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    part: PartId,
    x: number,
    y: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (part === 'pole-left' || part === 'pole-right') {
      // 木棍：竖长条
      const placed = isPlaced(this.state, part);
      const h = placed ? 150 : 64;
      rough.rectangle(x - 7, y - h / 2, 14, h, {
        fill: PALETTE.woodDark,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.1,
        seed: part === 'pole-left' ? 61 : 62,
      });
    } else if (part === 'shirt') {
      ctx.font = handFont(isPlaced(this.state, part) ? 54 : 40);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👕', x, y);
    } else if (part === 'pants') {
      ctx.font = handFont(isPlaced(this.state, part) ? 54 : 40);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👖', x, y);
    } else if (part === 'rope') {
      if (isPlaced(this.state, part)) {
        // 绳结绑在四角
        ctx.strokeStyle = '#B0895B';
        ctx.lineWidth = 3;
        for (const [sx2, sy2] of [
          [this.sx(380), 200],
          [this.sx(580), 200],
          [this.sx(380), 330],
          [this.sx(580), 330],
        ] as const) {
          ctx.beginPath();
          ctx.arc(sx2, sy2, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.font = handFont(40);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪢', x, y);
      }
    }
    // 材料名
    if (!isPlaced(this.state, part)) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PALETTE.ink;
      ctx.font = handFont(12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(stepByPart(part).label, x, y + 28);
    }
    ctx.restore();
  }

  /** 承重测试：小人躺上担架 */
  private drawRestTest(ctx: CanvasRenderingContext2D): void {
    const cx = this.sx(480);
    const y = 200 + Math.min(1, this.restClock) * 40; // 从上方落下躺上
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(-Math.PI / 2); // 躺平
    drawPixelHero(ctx, 0, 0, { facing: 1, walk: 0, scale: 3, shirt: PALETTE.brick });
    ctx.restore();
    // 稳固对勾
    if (this.restClock > 0.8) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (this.restClock - 0.8) * 3);
      ctx.fillStyle = PALETTE.moss;
      ctx.font = handFont(30);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✅ 稳固！', cx, 130);
      ctx.restore();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    const step = currentStep(this.state);
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let tip: string;
    if (this.state.finished) tip = '🚑 担架完成！可以安全搬运伤员了';
    else if (this.wrongFlash > 0) tip = '⚠ 顺序不对！先完成当前高亮的步骤';
    else if (step) tip = `第 ${this.state.placed.length + 1}/${STEPS.length} 步：把「${step.label}」拖到高亮处`;
    else tip = '';
    ctx.fillText(tip, width / 2, 14);

    // 步骤说明
    if (step && this.wrongFlash <= 0) {
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.font = handFont(14);
      ctx.fillText(`💡 ${step.hint}`, width / 2, 40);
    }
    ctx.restore();

    // 进度点（5 步）
    const dotY = 66;
    const n = STEPS.length;
    const gap = 26;
    const startX = width / 2 - ((n - 1) * gap) / 2;
    ctx.save();
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < this.state.placed.length ? PALETTE.moss : PALETTE.paperDark;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(startX + i * gap, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}
