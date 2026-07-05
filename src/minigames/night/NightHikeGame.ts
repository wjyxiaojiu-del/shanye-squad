import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawPixelHero, handFont, roughCircle } from '../../render/handdrawn';
import {
  GOAL_R,
  NightState,
  Vec,
  WORLD_H,
  WORLD_W,
  createNight,
  nightProgress,
  tickNight,
} from './logic';

const LIGHT_R = 96; // 头灯照亮半径

/**
 * 暗夜盲行 —— 黑暗中头灯只照一小圈，循营火微光与脚印走到营火。
 * 逻辑在 ./logic（纯函数、已单测）。触控：按住/拖动，朝触点方向走。
 */
export class NightHikeGame implements MiniGame {
  readonly title = '暗夜盲行';

  private state: NightState = createNight();
  private time = 0;
  private finishClock = 0;
  private winFired = false;

  // 触点（世界坐标）；holding 时朝它移动
  private holding = false;
  private aim: Vec = { x: 0, y: 0 };
  private viewW: number;
  private viewH = WORLD_H;

  // 键盘方向
  private keyUnsub: (() => void) | null = null;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.state = createNight();
    this.time = 0;
    this.finishClock = 0;
    this.winFired = false;
    this.holding = false;
  }

  exit(): void {
    this.keyUnsub?.();
    this.keyUnsub = null;
  }

  // 屏幕 ↔ 世界坐标（等比缩放铺满）
  private sx(x: number): number {
    return (x / WORLD_W) * this.viewW;
  }
  private sy(y: number): number {
    return (y / WORLD_H) * this.viewH;
  }
  private toWorld(p: PointerPos): Vec {
    return { x: (p.x / this.viewW) * WORLD_W, y: (p.y / this.viewH) * WORLD_H };
  }

  onPointer(p: PointerPos): void {
    this.holding = true;
    this.aim = this.toWorld(p);
  }
  onPointerMove(p: PointerPos): void {
    if (this.holding) this.aim = this.toWorld(p);
  }
  onPointerUp(): void {
    this.holding = false;
  }

  update(dt: number): void {
    this.time += dt;

    // 方向：优先键盘，其次触点
    let dir: Vec = { x: 0, y: 0 };
    const input = this.ctx.input;
    if (input.isDown('left')) dir.x -= 1;
    if (input.isDown('right')) dir.x += 1;
    // 键盘只有左右，加上"朝触点"补足上下
    if (this.holding) {
      dir = { x: this.aim.x - this.state.player.x, y: this.aim.y - this.state.player.y };
      // 触点离得很近就停下，避免抖动
      if (Math.hypot(dir.x, dir.y) < 6) dir = { x: 0, y: 0 };
    }

    this.state = tickNight(this.state, dir, dt);

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
    this.viewH = height;

    const px = this.sx(this.state.player.x);
    const py = this.sy(this.state.player.y);
    const gx = this.sx(this.state.goal.x);
    const gy = this.sy(this.state.goal.y);

    // 1) 底层：暗蓝夜色地面
    ctx.save();
    ctx.fillStyle = '#20242E';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 2) 场景元素（会被黑幕盖住，只有光圈内可见）
    this.drawScene(ctx, rough, px, py);

    // 3) 黑幕 + 头灯挖洞（destination-out）
    this.drawDarkness(ctx, width, height, px, py, gx, gy);

    // 4) 常亮层：营火微光、玩家、HUD（不受黑幕影响）
    this.drawGoalGlow(ctx, gx, gy);
    this.drawPlayer(ctx, px, py);
    this.drawHud(ctx, width);
  }

  /** 场景层：脚印提示 + 障碍（在光圈内才看得清） */
  private drawScene(
    ctx: CanvasRenderingContext2D,
    rough: RenderContext['rough'],
    px: number,
    py: number,
  ): void {
    // 向导脚印（淡，指引方向）
    ctx.save();
    for (let i = 0; i < this.state.waypoints.length; i++) {
      const w = this.state.waypoints[i];
      const wx = this.sx(w.x);
      const wy = this.sy(w.y);
      const d = Math.hypot(wx - px, wy - py);
      // 只在头灯附近显现，营造"脚下才看得见脚印"
      const vis = Math.max(0, 1 - d / (LIGHT_R * 1.6));
      if (vis <= 0) continue;
      ctx.globalAlpha = vis * 0.55;
      ctx.fillStyle = '#C9B78C';
      ctx.font = handFont(16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👣', wx, wy);
    }
    ctx.restore();

    // 障碍
    for (const o of this.state.obstacles) {
      const ox = this.sx(o.x);
      const oy = this.sy(o.y);
      const d = Math.hypot(ox - px, oy - py);
      const vis = Math.max(0, 1 - d / (LIGHT_R * 1.3));
      if (vis <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, vis + 0.15);
      roughCircle(rough, ox, oy, o.r * 2 * (this.viewW / WORLD_W), PALETTE.stone, o.x + o.y);
      ctx.restore();
    }
  }

  /** 黑幕 + 头灯光圈（径向渐变挖洞） */
  private drawDarkness(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    px: number,
    py: number,
    gx: number,
    gy: number,
  ): void {
    ctx.save();
    // 黑幕
    ctx.fillStyle = 'rgba(10,12,18,0.93)';
    ctx.fillRect(0, 0, width, height);

    // 用 destination-out 擦出光圈
    ctx.globalCompositeOperation = 'destination-out';
    // 头灯（柔边）
    const flick = 1 + Math.sin(this.time * 10) * 0.03;
    const lg = ctx.createRadialGradient(px, py, 0, px, py, LIGHT_R * flick);
    lg.addColorStop(0, 'rgba(0,0,0,1)');
    lg.addColorStop(0.7, 'rgba(0,0,0,0.9)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(px, py, LIGHT_R * flick, 0, Math.PI * 2);
    ctx.fill();

    // 营火处也透一点微光（远远能看见，指引方向）
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 46);
    gg.addColorStop(0, 'rgba(0,0,0,0.85)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx, gy, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 营火发光（画在黑幕之上，始终可见的暖光点） */
  private drawGoalGlow(ctx: CanvasRenderingContext2D, gx: number, gy: number): void {
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
    ctx.save();
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, GOAL_R * 1.6);
    g.addColorStop(0, `rgba(240,150,60,${0.5 * pulse})`);
    g.addColorStop(1, 'rgba(240,150,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, GOAL_R * 1.6, 0, Math.PI * 2);
    ctx.fill();
    // 火苗
    const flick = Math.sin(this.time * 16) * 3;
    for (const l of [
      { c: '#E4772F', w: 12, h: 30 },
      { c: '#F2C04B', w: 6, h: 18 },
    ]) {
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(gx - l.w, gy + 6);
      ctx.quadraticCurveTo(gx - 2, gy - l.h * 0.5, gx + flick, gy - l.h);
      ctx.quadraticCurveTo(gx + 2, gy - l.h * 0.5, gx + l.w, gy + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    // 头灯光锥（朝营火方向淡淡投射感，用玩家处小暖圈表示）
    ctx.save();
    const g = ctx.createRadialGradient(px, py, 0, px, py, LIGHT_R);
    g.addColorStop(0, 'rgba(255,244,200,0.18)');
    g.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, LIGHT_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 像素小人 + 头灯亮点
    const facing: 1 | -1 = this.aim.x >= this.state.player.x ? 1 : -1;
    drawPixelHero(ctx, px, py + 16, { facing, walk: this.holding ? (this.time * 2) % 1 : 0, scale: 3.4, shirt: PALETTE.mist });
    ctx.save();
    ctx.fillStyle = '#FFF4C8';
    ctx.beginPath();
    ctx.arc(px + facing * 6, py - 22, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = '#EDE6D2';
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tip = this.state.finished
      ? '🌙 摸黑到营火，你做到了！'
      : '按住屏幕朝营火方向走，跟着脚印、别慌';
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();

    // 进度条
    const barW = 200;
    const barH = 12;
    const bx = width / 2 - barW / 2;
    const by = 40;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = '#EDE6D2';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#F0963C';
    ctx.fillRect(bx + 1, by + 1, (barW - 2) * nightProgress(this.state), barH - 2);
    ctx.restore();
  }
}
