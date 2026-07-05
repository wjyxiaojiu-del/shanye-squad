import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { clamp, lerp } from '../../core/collision';
import {
  PALETTE,
  drawClimberHero,
  drawPaper,
  handFont,
} from '../../render/handdrawn';
import {
  ClimbState,
  Hold,
  WALL_W,
  createClimb,
  currentPoint,
  highestReachableHold,
  moveTo,
  progress,
  reachable,
} from './logic';

const H = 540;
const ANCHOR_Y = H * 0.56; // 当前抓点锚定的屏幕 y

/**
 * 抱石体验（自由选点）—— 整面墙铺满多样岩点，点击够得着的任意岩点爬过去，
 * 小人带攀爬姿态平滑移动。逻辑全在 ./logic（纯函数、已单测）。
 */
export class BoulderingGame implements MiniGame {
  readonly title = '抱石体验';

  private state: ClimbState = createClimb();
  private camY = 0; // 设计坐标：当前抓点的 worldY 会被映射到 ANCHOR_Y
  private time = 0;
  private finishClock = 0;
  private winFired = false;
  private unsub: (() => void) | null = null;

  // 小人渲染位置（屏幕像素，平滑插值到目标抓点）
  private heroSx = 0;
  private heroSy = 0;
  private facing: 1 | -1 = 1;
  private inited = false;

  // 点了够不到的点时的反馈（伸手够一下够不着）
  private missTimer = 0;
  private missTarget: { x: number; y: number } | null = null;

  private viewW = 960;

  constructor(private ctx: MiniGameContext) {}

  enter(): void {
    this.state = createClimb();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.inited = false;
    const cur = currentPoint(this.state);
    this.camY = cur.worldY;

    // 桌面兜底：空格/回车自动爬向"最高的够得着点"
    this.unsub = this.ctx.input.onPress((k) => {
      if (this.state.finished) return;
      if (k === 'action' || k === 'confirm') this.autoStep();
    });
  }

  exit(): void {
    this.unsub?.();
    this.unsub = null;
  }

  private autoStep(): void {
    const cand = highestReachableHold(this.state);
    if (cand) this.state = moveTo(this.state, cand.id);
  }

  // ---- 坐标映射：设计坐标 → 屏幕 ----
  private get wallLeft(): number {
    return (this.viewW - this.wallW) / 2;
  }
  private get wallW(): number {
    return clamp(this.viewW * 0.72, 300, 560);
  }
  private sx(designX: number): number {
    return this.wallLeft + (designX / WALL_W) * this.wallW;
  }
  private sy(worldY: number): number {
    // worldY 越小(越高) → 屏幕 y 越小(越靠上)。camY 映射到 ANCHOR_Y。
    return ANCHOR_Y + (worldY - this.camY) * (this.wallW / WALL_W);
  }
  private get holdScreenR(): number {
    return this.wallW / WALL_W;
  }

  onPointer(p: PointerPos): void {
    if (this.state.finished) return;
    // 找点击命中的岩点（屏幕距离）—— 不再限制只能点够得着的，
    // 够不着的也响应，但只给"够不到"反馈，不移动。
    let best: Hold | null = null;
    let bestD = Infinity;
    for (const h of this.state.holds) {
      const hx = this.sx(h.x);
      const hy = this.sy(h.worldY);
      const rr = Math.max(20, h.size * this.holdScreenR + 12); // 手指友好命中
      const d = Math.hypot(p.x - hx, p.y - hy);
      if (d <= rr && d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) return;

    if (reachable(this.state, best.id)) {
      const prev = currentPoint(this.state);
      this.state = moveTo(this.state, best.id);
      const now = currentPoint(this.state);
      this.facing = now.x >= prev.x ? 1 : -1;
      this.missTimer = 0;
      this.missTarget = null;
      this.ctx.audio.play('step');
    } else if (best.id !== this.state.currentId) {
      // 够不到：伸手够一下的反馈
      this.missTimer = 0.5;
      this.missTarget = { x: this.sx(best.x), y: this.sy(best.worldY) };
      this.facing = best.x >= currentPoint(this.state).x ? 1 : -1;
      this.ctx.audio.play('fail');
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.missTimer > 0) this.missTimer = Math.max(0, this.missTimer - dt);

    if (this.state.finished) {
      this.finishClock += dt;
      if (this.finishClock > 0.7 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin();
      }
    }

    // 相机平滑跟随当前抓点高度
    const cur = currentPoint(this.state);
    this.camY = lerp(this.camY, cur.worldY, Math.min(1, dt * 6));

    // 小人平滑移动到当前抓点屏幕位置
    const tx = this.sx(cur.x);
    const ty = this.sy(cur.worldY);
    if (!this.inited) {
      this.heroSx = tx;
      this.heroSy = ty;
      this.inited = true;
    } else {
      this.heroSx = lerp(this.heroSx, tx, Math.min(1, dt * 9));
      this.heroSy = lerp(this.heroSy, ty, Math.min(1, dt * 9));
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    this.viewW = width;
    drawPaper(ctx, width, height);

    const left = this.wallLeft;
    const w = this.wallW;

    // 岩壁面
    rough.rectangle(left - 14, -30, w + 28, height + 60, {
      fill: PALETTE.stone,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 3,
      roughness: 1.3,
      seed: 42,
    });
    // 纹理线（随相机滚动）
    ctx.save();
    ctx.strokeStyle = 'rgba(43,43,43,0.08)';
    ctx.lineWidth = 1;
    const step = 40;
    const off = ((this.sy(this.camY) % step) + step) % step;
    for (let y = off - step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
    }
    ctx.restore();

    // 顶部"完攀线"
    const topHold = this.state.holds.find((h) => h.row === this.state.topRow);
    if (topHold) {
      const ty = this.sy(topHold.worldY) - 30;
      if (ty > -40 && ty < height) {
        ctx.save();
        ctx.strokeStyle = PALETTE.brick;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(left, ty);
        ctx.lineTo(left + w, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PALETTE.brick;
        ctx.font = handFont(16);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🏁 顶点', (left + w) / 2 + left / 2, ty - 4);
        ctx.restore();
      }
    }

    // 岩点
    for (const h of this.state.holds) {
      this.drawHold(r, h);
    }

    // 小人空闲手的姿态：
    // - 登顶：举手庆祝
    // - 刚点了够不到的点：伸手去够，只伸到 82% 距离，表现"够不着"
    // - 平时：自然向上探（不指向任何具体岩点，不剧透哪个够得着）
    const heroCy = this.heroSy - 6 * this.holdScreenR;
    let reachHand: { x: number; y: number };
    if (this.state.finished) {
      reachHand = { x: this.heroSx, y: this.heroSy - 60 };
    } else if (this.missTimer > 0 && this.missTarget) {
      reachHand = {
        x: this.heroSx + (this.missTarget.x - this.heroSx) * 0.82,
        y: heroCy + (this.missTarget.y - heroCy) * 0.82,
      };
    } else {
      reachHand = { x: this.heroSx + this.facing * 24, y: heroCy - 40 };
    }
    drawClimberHero(ctx, {
      cx: this.heroSx,
      cy: heroCy,
      facing: this.facing,
      reachHand,
      scale: 3.2 * clamp(this.holdScreenR, 0.7, 1.15),
      shirt: PALETTE.mist,
      harness: true,
    });

    // 够不到的即时反馈文字
    if (this.missTimer > 0 && this.missTarget) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.missTimer * 2.2);
      ctx.fillStyle = PALETTE.brick;
      ctx.font = handFont(15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('够不到…', this.missTarget.x, this.missTarget.y - 14);
      ctx.restore();
    }

    this.drawHud(ctx, width);
  }

  private drawHold(r: RenderContext, h: Hold): void {
    const { ctx, rough, height } = r;
    const x = this.sx(h.x);
    const y = this.sy(h.worldY);
    if (y < -40 || y > height + 40) return;
    const R = h.size * this.holdScreenR;

    const isCurrent = h.id === this.state.currentId;
    const canReach = reachable(this.state, h.id);

    ctx.save();

    // 不同岩点类型 → 不同形状/颜色
    const color =
      h.kind === 'jug'
        ? PALETTE.ochre
        : h.kind === 'crimp'
          ? '#8C9B7A'
          : h.kind === 'edge'
            ? PALETTE.mist
            : h.kind === 'sloper'
              ? '#D0A85B'
              : h.kind === 'pinch'
                ? '#A86E5E'
                : h.kind === 'pocket'
                  ? '#7D8E9A'
                  : h.kind === 'volume'
                    ? '#BFA06A'
                    : '#B9A98A';

    if (h.kind === 'jug') {
      rough.circle(x, y, R * 2, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.3,
        seed: h.id + 1,
      });
      ctx.strokeStyle = 'rgba(43,43,43,0.28)';
      ctx.lineWidth = Math.max(1.2, R * 0.18);
      ctx.beginPath();
      ctx.arc(x, y + R * 0.12, R * 0.48, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (h.kind === 'crimp') {
      rough.rectangle(x - R * 1.35, y - R * 0.42, R * 2.7, R * 0.84, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.4,
        seed: h.id + 2,
      });
      rough.line(x - R * 1.15, y + R * 0.12, x + R * 1.15, y + R * 0.12, {
        stroke: 'rgba(43,43,43,0.38)',
        strokeWidth: 1.5,
        roughness: 0.8,
        seed: h.id + 20,
      });
    } else if (h.kind === 'edge') {
      rough.polygon(
        [
          [x - R, y + R * 0.7],
          [x, y - R],
          [x + R, y + R * 0.7],
        ],
        { fill: color, fillStyle: 'solid', stroke: PALETTE.ink, strokeWidth: 2, roughness: 1.3, seed: h.id + 3 },
      );
    } else if (h.kind === 'sloper') {
      rough.ellipse(x, y, R * 2.8, R * 1.75, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.7,
        seed: h.id + 5,
      });
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(x - R * 0.3, y - R * 0.2, R * 0.55, R * 0.22, -0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (h.kind === 'pinch') {
      rough.rectangle(x - R * 0.52, y - R * 1.35, R * 1.04, R * 2.7, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.35,
        seed: h.id + 6,
      });
      rough.line(x, y - R * 1.1, x, y + R * 1.1, {
        stroke: 'rgba(43,43,43,0.3)',
        strokeWidth: 1.4,
        roughness: 0.8,
        seed: h.id + 60,
      });
    } else if (h.kind === 'pocket') {
      rough.circle(x, y, R * 2.05, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2,
        roughness: 1.2,
        seed: h.id + 7,
      });
      ctx.fillStyle = 'rgba(43,43,43,0.54)';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x + (i === 0 ? -R * 0.32 : R * 0.32), y + R * 0.05, R * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (h.kind === 'volume') {
      const tilt = (h.id % 2 ? 1 : -1) * R * 0.25;
      rough.polygon(
        [
          [x - R * 1.45, y + R * 1.15],
          [x + R * 1.25, y + R * 0.85],
          [x + tilt, y - R * 1.45],
        ],
        {
          fill: color,
          fillStyle: 'solid',
          stroke: PALETTE.ink,
          strokeWidth: 2.2,
          roughness: 1.1,
          seed: h.id + 8,
        },
      );
      ctx.fillStyle = 'rgba(43,43,43,0.34)';
      for (const [sx, sy] of [
        [-0.75, 0.55],
        [0.62, 0.42],
        [0, -0.62],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + sx * R, y + sy * R, Math.max(1.8, R * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // foot：小椭圆
      rough.ellipse(x, y, R * 1.8, R * 1.2, {
        fill: color,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 1.8,
        roughness: 1.2,
        seed: h.id + 4,
      });
    }

    // 够得着的岩点：绿色虚线圈，降低盲点成本但保留自由选路。
    if (canReach) {
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 4 + h.id);
      ctx.globalAlpha = 0.5 + pulse * 0.35;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = PALETTE.moss;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, R + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 当前抓点：实心描边（标记"你现在在这"，不是提示能点哪）
    if (isCurrent) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.brick;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, R + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('绿色圈=够得着，红圈=当前抓点；自己选路往上爬！', width / 2, 14);

    ctx.font = handFont(15);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(progress(this.state) * 100)}%`, width - 16, 16);
    ctx.restore();

    // 起步提示
    if (this.state.currentId < 0) {
      ctx.save();
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.font = handFont(15);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↑ 从墙底附近的岩点起步', width / 2, ANCHOR_Y + 70);
      ctx.restore();
    }
  }
}
