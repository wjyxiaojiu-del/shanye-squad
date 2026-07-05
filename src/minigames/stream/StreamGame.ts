import type { RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { PALETTE, drawPaper, drawPixelHero, handFont } from '../../render/handdrawn';
import {
  N_STONES,
  STONES_TOL,
  StreamState,
  createStream,
  currentTolerance,
  nextTolerance,
  streamAdvice,
  streamPerformance,
  streamProgress,
  tickStream,
} from './logic';

const H = 540;
const GROUND_Y = H * 0.74;
const FLOW_BASE_Y = H * 0.62;

/**
 * 溯溪探险 —— 踩着石头跳过溪流，站太久涨潮会冲走，到达对岸通关。
 */
export class StreamGame implements MiniGame {
  readonly title = '溯溪探险';

  private state: StreamState = createStream();
  private time = 0;
  private sweepClock = 0;
  private winClock = 0;
  private winFired = false;
  private jumpAnim = 0; // 0..1 跳跃弧线动画（1→0）
  private _lastX = 0; // 上一帧 hero 的 x，用于跳跃插值

  constructor(private ctx: MiniGameContext) {}

  enter(): void {
    this.reset();
  }

  exit(): void {
    /* 无需清理 */
  }

  private reset(): void {
    this.state = createStream();
    this.time = 0;
    this.sweepClock = 0;
    this.winClock = 0;
    this.winFired = false;
    this.jumpAnim = 0;
    this._lastX = 0;
  }

  onPointer(): void {
    this.tryLeap();
  }

  private tryLeap(): void {
    if (this.state.swept || this.state.finished || this.jumpAnim > 0) return;
    this.state = tickStream(this.state, true, 0); // 只跳不推进时间
    if (!this.state.swept && !this.state.finished && this.state.jumps > 0) {
      this._lastX = this._lastX || 0; // 确保 _lastX 是上一帧的 hero 位置
      this.jumpAnim = 1;
      this.ctx.audio.play('step');
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.jumpAnim > 0) this.jumpAnim = Math.max(0, this.jumpAnim - dt * 4);

    // 键盘 ACTION / 确认 = 前跳
    // 注意：跳跃在每帧 onPress/onPointer 已经调用 tickStream，这里只推进时间不做 leap
    this.state = tickStream(this.state, false, dt);

    if (this.state.swept) {
      if (this.sweepClock === 0) this.ctx.audio.play('splash');
      this.sweepClock += dt;
      if (this.sweepClock > 1.0) this.reset();
      return;
    }

    if (this.state.finished) {
      if (this.winClock === 0) this.ctx.audio.play('success');
      this.winClock += dt;
      if (this.winClock > 0.8 && !this.winFired) {
        this.winFired = true;
        this.ctx.onWin({ perf: streamPerformance(this.state), timeSec: this.time });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width } = r;
    const height = H;

    drawPaper(ctx, width, height);

    // 天空
    ctx.save();
    ctx.fillStyle = 'rgba(143,165,173,0.16)';
    ctx.fillRect(0, 0, width, FLOW_BASE_Y);
    ctx.restore();

    const bankH = 56;
    const bankTop = GROUND_Y - bankH;
    // 河面宽度随石头数自适应：每块石头约 56px + 两岸留白
    const riverSpan = Math.min(width - 80, Math.max(220, N_STONES * 56));
    const riverL = width / 2 - riverSpan / 2;
    const riverR = width / 2 + riverSpan / 2;

    // 左右岸
    ctx.save();
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(0, bankTop, riverL, bankH);
    ctx.fillRect(riverR, bankTop, width - riverL - riverSpan + (width - riverR), bankH);
    // 岸顶墨线
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, bankTop);
    ctx.lineTo(riverL, bankTop);
    ctx.moveTo(riverR, bankTop);
    ctx.lineTo(width, bankTop);
    ctx.stroke();
    ctx.restore();

    // 溪水（涨落水位 = flow）
    const flow = this.state.flow;
    const topY = FLOW_BASE_Y - flow * 28;
    ctx.save();
    const grad = ctx.createLinearGradient(0, topY, 0, GROUND_Y);
    grad.addColorStop(0, flow > 0.6 ? '#5A8FB5' : '#8FBAD6');
    grad.addColorStop(1, '#6A9DC0');
    ctx.fillStyle = grad;
    ctx.fillRect(riverL, topY, riverSpan, GROUND_Y - topY);
    // 流速线
    ctx.strokeStyle = `rgba(255,255,255,${0.2 + flow * 0.4})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const yy = topY + 8 + i * 16 + Math.sin(this.time * 3 + i) * 2;
      if (yy > GROUND_Y - 8) continue;
      ctx.beginPath();
      ctx.moveTo(riverL + 10, yy);
      for (let x = riverL + 10; x <= riverR - 10; x += 8) {
        const moveY = yy + Math.sin((x + this.time * 120) * 0.08) * 3;
        ctx.lineTo(x, moveY);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 石头（数量由逻辑层 N_STONES 决定，河面自适应展开）
    const stoneXs = this.stonePositions(riverL, riverSpan);
    const advice = streamAdvice(this.state);
    const nextIndex = this.state.pos + 1;
    for (let i = 0; i < N_STONES; i++) {
      const x = stoneXs[i];
      const submerge = flow > STONES_TOL[i] ? (flow - STONES_TOL[i]) * 0.7 : 0;
      const stoneTopY = GROUND_Y - 26 + submerge * 30;
      rough.rectangle(x - 30, stoneTopY, 60, 26 - submerge * 20, {
        fill: PALETTE.stone,
        fillStyle: 'solid',
        stroke: PALETTE.ink,
        strokeWidth: 2.5,
        roughness: 1.2,
        seed: 30 + i,
      });
      // 石头耐受力 tint：危险时泛红
      if (flow > STONES_TOL[i] - 0.12) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(0.6, (flow - (STONES_TOL[i] - 0.12)) * 4));
        ctx.fillStyle = PALETTE.brick;
        ctx.beginPath();
        ctx.arc(x, stoneTopY + 10, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (i === nextIndex) {
        this.drawNextStoneCue(ctx, x, GROUND_Y - 14, advice);
      }
    }

    // 右岸终点旗
    ctx.save();
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(riverR - 6, bankTop - 40, 6, 40);
    ctx.fillStyle = PALETTE.brick;
    ctx.beginPath();
    ctx.moveTo(riverR, bankTop - 40);
    ctx.lineTo(riverR + 30, bankTop - 30);
    ctx.lineTo(riverR, bankTop - 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 小人
    this.drawHero(ctx, stoneXs, flow, riverL, riverR);

    // BAR：当前石头耐受力 vs 实时流量
    this.drawFlowBar(ctx, width, flow);
    this.drawHud(ctx, width);

    // 冲走遮罩
    if (this.state.swept) {
      ctx.save();
      ctx.fillStyle = 'rgba(43,43,43,0.5)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = PALETTE.paper;
      ctx.font = handFont(28);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💦 被冲走了！等低潮再跳', width / 2, height * 0.42);
      ctx.restore();
    }
  }

  private stonePositions(riverL: number, riverSpan: number): number[] {
    const pad = 24;
    const usable = riverSpan - pad * 2;
    const gap = usable / (N_STONES - 1);
    return Array.from({ length: N_STONES }, (_, i) => riverL + pad + i * gap);
  }

  private drawHero(
    ctx: CanvasRenderingContext2D,
    stoneXs: number[],
    flow: number,
    riverL: number,
    riverR: number,
  ): void {
    let hx: number;
    let hy: number;
    const toX =
      this.state.pos < 0
        ? riverL - 30
        : this.state.pos >= N_STONES
          ? riverR + 30
          : stoneXs[this.state.pos];
    if (this.jumpAnim > 0 && this._lastX !== toX) {
      const t = 1 - this.jumpAnim;
      const ease = t * t * (3 - 2 * t); // smoothstep
      hx = this._lastX + (toX - this._lastX) * ease;
      hy = GROUND_Y - 30 - Math.sin(t * Math.PI) * 50;
    } else {
      hx = toX;
      hy = GROUND_Y - 30;
      this._lastX = toX;
    }
    drawPixelHero(ctx, hx, hy, { facing: 1, walk: 0, scale: 3.4, shirt: PALETTE.mist });

    // 当前所在石头的高亮圈
    if (this.state.pos >= 0 && this.state.pos < N_STONES) {
      const x = stoneXs[this.state.pos];
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.globalAlpha = 0.3 + 0.3 * pulse;
      ctx.strokeStyle = flow > STONES_TOL[this.state.pos] - 0.12 ? PALETTE.brick : PALETTE.moss;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, GROUND_Y - 14, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawNextStoneCue(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    advice: ReturnType<typeof streamAdvice>,
  ): void {
    if (advice === 'finished' || advice === 'swept') return;
    const safe = advice === 'leap' || advice === 'escape';
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    ctx.save();
    ctx.globalAlpha = safe ? 0.55 + pulse * 0.25 : 0.35 + pulse * 0.2;
    ctx.strokeStyle = safe ? PALETTE.moss : PALETTE.brick;
    ctx.lineWidth = safe ? 4 : 3;
    ctx.beginPath();
    ctx.arc(x, y, 34 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFlowBar(ctx: CanvasRenderingContext2D, _width: number, flow: number): void {
    const tol = currentTolerance(this.state);
    const safe = tol === Number.POSITIVE_INFINITY ? 1 : tol;
    const nextSafe = nextTolerance(this.state);
    const x = 18;
    const y = 56;
    const w = 22;
    const h = 160;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    // 耐受力标记线
    const ty = y + h * (1 - safe);
    ctx.strokeStyle = PALETTE.moss;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ty);
    ctx.lineTo(x + w, ty);
    ctx.stroke();
    if (nextSafe !== Number.POSITIVE_INFINITY) {
      const ny = y + h * (1 - nextSafe);
      ctx.strokeStyle = 'rgba(43,43,43,0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x - 4, ny);
      ctx.lineTo(x + w + 4, ny);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 当前流量
    const fy = y + h * (1 - flow);
    ctx.fillStyle = flow > safe ? PALETTE.brick : PALETTE.moss;
    ctx.fillRect(x + 3, fy - 4, w - 6, 6);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('水', x + w / 2, y - 6);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(17);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let tip: string;
    const advice = streamAdvice(this.state);
    if (this.state.finished) tip = '💦 成功到达对岸！';
    else if (this.state.swept) tip = '';
    else if (advice === 'escape') tip = '脚下水涨了，马上跳到下一块！';
    else if (advice === 'leap') tip = '水位够低，跳下一块！';
    else tip = '下一块水太深，先等水退';
    ctx.fillText(tip, width / 2, 14);
    ctx.restore();

    // 进度
    const barW = 200;
    const barH = 12;
    const bx = width / 2 - barW / 2;
    const by = 42;
    ctx.save();
    ctx.fillStyle = PALETTE.paperDark;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(bx + 2, by + 2, (barW - 4) * streamProgress(this.state), barH - 4);
    ctx.restore();
  }
}
