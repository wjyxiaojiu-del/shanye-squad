import type { PointerPos, RenderContext } from '../../core/types';
import { clamp, lerp } from '../../core/collision';
import { PALETTE } from '../../render/handdrawn';
import { decayHeat, drillQuality, focusQuality } from './logic';

export type FireMethodId = 'lens' | 'drill' | 'ferro';

/** 火绒/太阳等公共布局，由容器传入 */
export interface FireLayout {
  viewW: number;
  height: number;
  time: number;
  targetX: number;
  targetY: number;
  idealY: number;
  sunX: number;
  sunY: number;
}

/**
 * 取火方式统一接口 —— 各方式负责自己的交互与道具绘制，
 * 每帧输出 0..1 的"加热强度"给容器喂进 tickFire。
 */
export interface FireMethod {
  readonly id: FireMethodId;
  onDown(p: PointerPos): void;
  onMove(p: PointerPos): void;
  onUp(): void;
  update(dt: number, layout: FireLayout): number;
  render(r: RenderContext, layout: FireLayout, temperature: number): void;
}

const TOL_X = 52;
const TOL_Y = 46;
const FINGER_OFFSET = 46;

// ============================================================
// 🔍 放大镜聚焦
// ============================================================
export class LensMethod implements FireMethod {
  readonly id = 'lens' as const;
  private held = false;
  private lensX = 0;
  private lensY = 0;
  private tx = 0;
  private ty = 0;
  private quality = 0;
  private inited = false;

  onDown(p: PointerPos): void {
    this.held = true;
    this.tx = p.x;
    this.ty = p.y - FINGER_OFFSET;
  }
  onMove(p: PointerPos): void {
    if (this.held) {
      this.tx = p.x;
      this.ty = p.y - FINGER_OFFSET;
    }
  }
  onUp(): void {
    this.held = false;
  }

  update(dt: number, layout: FireLayout): number {
    if (!this.inited) {
      this.lensX = this.tx = layout.targetX - 140;
      this.lensY = this.ty = layout.targetY - 180;
      this.inited = true;
    }
    const cx = clamp(this.tx, 30, layout.viewW - 30);
    const cy = clamp(this.ty, 46, layout.targetY - 16);
    this.lensX = lerp(this.lensX, cx, Math.min(1, dt * 18));
    this.lensY = lerp(this.lensY, cy, Math.min(1, dt * 18));
    this.quality = this.held
      ? focusQuality(this.lensX, this.lensY, layout.targetX, layout.idealY, TOL_X, TOL_Y)
      : 0;
    return this.quality;
  }

  render(r: RenderContext, layout: FireLayout): void {
    const { ctx, rough } = r;
    const { sunX, sunY, targetY, idealY } = layout;

    // 阳光束：太阳→放大镜
    ctx.save();
    ctx.strokeStyle = 'rgba(228,185,74,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sunX - 26, sunY);
    ctx.lineTo(this.lensX - 22, this.lensY);
    ctx.moveTo(sunX + 26, sunY);
    ctx.lineTo(this.lensX + 22, this.lensY);
    ctx.stroke();
    ctx.restore();

    // 会聚束 + 光斑
    const qy = Math.max(0, 1 - Math.abs(this.lensY - idealY) / TOL_Y);
    const spotX = this.lensX;
    const spotY = targetY - 6;
    const spotR = 22 - 15 * qy;
    ctx.save();
    ctx.strokeStyle = `rgba(228,185,74,${0.25 + 0.5 * this.quality})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.lensX - 20, this.lensY + 6);
    ctx.lineTo(spotX - spotR, spotY);
    ctx.moveTo(this.lensX + 20, this.lensY + 6);
    ctx.lineTo(spotX + spotR, spotY);
    ctx.stroke();
    ctx.restore();

    if (this.held) {
      const bright = 0.35 + 0.6 * this.quality;
      const grad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotR + 4);
      grad.addColorStop(0, `rgba(255,250,220,${bright})`);
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotR + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 放大镜
    drawLens(ctx, rough, this.lensX, this.lensY);
  }
}

// ============================================================
// 🪵 钻木取火（左右来回拉弓）
// ============================================================
export class DrillMethod implements FireMethod {
  readonly id = 'drill' as const;
  private held = false;
  private lastX = 0;
  private handX = 0;
  private moveAccum = 0;
  private recentSpeed = 0;
  private spin = 0;
  private quality = 0;

  onDown(p: PointerPos): void {
    this.held = true;
    this.lastX = p.x;
    this.handX = p.x;
  }
  onMove(p: PointerPos): void {
    if (!this.held) return;
    this.moveAccum += Math.abs(p.x - this.lastX);
    this.lastX = p.x;
    this.handX = p.x;
  }
  onUp(): void {
    this.held = false;
  }

  update(dt: number, layout: FireLayout): number {
    if (this.handX === 0) this.handX = layout.targetX;
    const pps = dt > 0 ? this.moveAccum / dt : 0;
    this.moveAccum = 0;
    this.recentSpeed = lerp(this.recentSpeed, this.held ? pps : 0, Math.min(1, dt * 8));
    this.quality = drillQuality(this.recentSpeed);
    this.spin += this.recentSpeed * 0.03 * dt + this.quality * dt * 20;
    return this.quality;
  }

  render(r: RenderContext, layout: FireLayout): void {
    const { ctx, rough } = r;
    const { targetX, targetY } = layout;

    // 钻木底板
    rough.rectangle(targetX - 60, targetY - 10, 120, 20, {
      fill: PALETTE.wood,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2,
      roughness: 1.2,
      seed: 21,
    });
    // 钻杆
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(targetX, targetY - 12);
    ctx.lineTo(targetX, targetY - 96);
    ctx.stroke();
    // 旋转标记（横纹随 spin 转）
    ctx.strokeStyle = 'rgba(43,43,43,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = targetY - 30 - i * 22;
      const ph = Math.sin(this.spin + i);
      ctx.beginPath();
      ctx.moveTo(targetX - 4 * ph, yy);
      ctx.lineTo(targetX + 4 * ph, yy);
      ctx.stroke();
    }
    ctx.restore();

    // 弓（横杆，随手左右移动）
    const bx = clamp(this.handX, targetX - 90, targetX + 90);
    ctx.save();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 70, targetY - 60);
    ctx.lineTo(bx + 70, targetY - 54);
    ctx.stroke();
    // 弓弦
    ctx.strokeStyle = 'rgba(43,43,43,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 70, targetY - 60);
    ctx.lineTo(targetX, targetY - 66);
    ctx.lineTo(bx + 70, targetY - 54);
    ctx.stroke();
    ctx.restore();

    // 摩擦火星（强度高时）
    if (this.quality > 0.4) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const a = layout.time * 12 + i;
        ctx.globalAlpha = this.quality * (0.4 + 0.4 * Math.sin(a));
        ctx.fillStyle = i % 2 ? '#E4772F' : '#F2E06B';
        ctx.beginPath();
        ctx.arc(targetX + Math.sin(a) * 10, targetY - 12 - Math.abs(Math.cos(a)) * 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ============================================================
// ⚡ 镁棒/打火棒（快速向下刮出火花）
// ============================================================
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class FerroMethod implements FireMethod {
  readonly id = 'ferro' as const;
  private held = false;
  private lastY = 0;
  private handX = 0;
  private handY = 0;
  private downAccum = 0;
  private heat = 0;
  private sparks: Spark[] = [];

  onDown(p: PointerPos): void {
    this.held = true;
    this.lastY = p.y;
    this.handX = p.x;
    this.handY = p.y;
  }
  onMove(p: PointerPos): void {
    if (!this.held) return;
    const dy = p.y - this.lastY;
    if (dy > 0) this.downAccum += dy;
    this.lastY = p.y;
    this.handX = p.x;
    this.handY = p.y;
  }
  onUp(): void {
    this.held = false;
  }

  update(dt: number, layout: FireLayout): number {
    // 一次够长的向下刮 → 迸火花
    if (this.downAccum > 55) {
      this.downAccum = 0;
      this.heat = Math.min(1, this.heat + 0.5);
      this.spawnSparks(layout);
    }
    this.heat = decayHeat(this.heat, dt);
    // 火花运动
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 260 * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    return this.heat;
  }

  private spawnSparks(layout: FireLayout): void {
    const ox = layout.targetX - 16;
    const oy = layout.targetY - 70;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (0.15 + (i / 10) * 0.7); // 向下扇形
      const sp = 120 + (i % 5) * 40;
      this.sparks.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp * (i % 2 ? 1 : 0.6),
        vy: Math.sin(a) * sp,
        life: 0.5 + (i % 3) * 0.15,
      });
    }
  }

  render(r: RenderContext, layout: FireLayout): void {
    const { ctx } = r;
    const { targetX, targetY } = layout;

    // 镁棒（斜放） + 刮片（随手）
    ctx.save();
    ctx.strokeStyle = '#8a8a82';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(targetX - 40, targetY - 40);
    ctx.lineTo(targetX + 4, targetY - 96);
    ctx.stroke();
    // 刮片
    const hx = clamp(this.handX, targetX - 30, targetX + 40);
    const hy = clamp(this.handY, targetY - 110, targetY - 20);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy - 8);
    ctx.lineTo(hx + 14, hy + 8);
    ctx.stroke();
    ctx.restore();

    // 火花
    ctx.save();
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2));
      ctx.fillStyle = Math.random() > 0.5 ? '#F2E06B' : '#E4772F';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 放大镜绘制（供 LensMethod 用） */
function drawLens(ctx: CanvasRenderingContext2D, rough: RenderContext['rough'], x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = PALETTE.woodDark;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 18);
  ctx.lineTo(x + 34, y + 40);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,244,196,0.4)';
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  rough.circle(x, y, 50, { stroke: PALETTE.ink, strokeWidth: 3, roughness: 1, seed: 13 });
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 16, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}
