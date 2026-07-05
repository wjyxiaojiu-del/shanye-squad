import type { PointerPos, RenderContext } from '../../core/types';
import type { MiniGame, MiniGameContext } from '../MiniGame';
import { handFont } from '../../render/handdrawn';
import {
  DIPPER_STARS,
  DIPPER_ORDER,
  POINTER_STAR_IDS,
  POLARIS,
  DISTRACTORS,
  nextDipperId,
  isCorrectDipper,
  dipperComplete,
  constellationResult,
  type SkyStar,
  type StarResult,
} from './logic';

const H = 540;

/**
 * 星空连线 —— 按顺序连出北斗七星，再顺着勺口指极星找到北极星。
 * 逻辑在 ./logic（纯函数、已单测）。
 */
export class ConstellationGame implements MiniGame {
  readonly title = '星空连线';

  private progress = 0; // 已连北斗星数
  private mistakes = 0;
  private phase: 'dipper' | 'findpolaris' | 'done' = 'dipper';
  private feedback = '';
  private feedbackT = 0;
  private flashStar: number | null = null;
  private flashT = 0;
  private result: StarResult | null = null;
  private finishClock = 0;
  private winFired = false;
  private time = 0;
  private bgStars: { x: number; y: number; r: number; ph: number }[] = [];
  private viewW: number;

  constructor(private ctx: MiniGameContext) {
    this.viewW = ctx.width;
  }

  enter(): void {
    this.progress = 0;
    this.mistakes = 0;
    this.phase = 'dipper';
    this.feedback = '';
    this.feedbackT = 0;
    this.flashStar = null;
    this.flashT = 0;
    this.result = null;
    this.finishClock = 0;
    this.winFired = false;
    this.time = 0;
    this.bgStars = [];
    for (let i = 0; i < 70; i++) {
      this.bgStars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.4,
        ph: Math.random() * Math.PI * 2,
      });
    }
  }

  exit(): void {
    /* 无需清理 */
  }

  // 归一化 → 屏幕坐标（星场居中，避免过宽拉伸）
  private fieldX0(): number {
    const fieldW = Math.min(this.viewW, 720);
    return (this.viewW - fieldW) / 2;
  }
  private sx(nx: number): number {
    const fieldW = Math.min(this.viewW, 720);
    return this.fieldX0() + nx * fieldW;
  }
  private sy(ny: number): number {
    return ny * H;
  }

  private starAt(p: PointerPos): SkyStar | null {
    const all: SkyStar[] = [...DIPPER_STARS, ...DISTRACTORS, POLARIS];
    let best: SkyStar | null = null;
    let bestD = 30; // 命中半径(px)
    for (const s of all) {
      const d = Math.hypot(p.x - this.sx(s.x), p.y - this.sy(s.y));
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  onPointer(p: PointerPos): void {
    if (this.phase === 'done') return;
    const star = this.starAt(p);
    if (!star) return;

    if (this.phase === 'dipper') {
      if (isCorrectDipper(this.progress, star.id)) {
        this.progress += 1;
        this.ctx.audio.play('success');
        this.feedback = this.progress >= 7 ? '北斗七星连好啦！' : `连上第 ${this.progress} 颗`;
        this.feedbackT = 1.0;
        if (dipperComplete(this.progress)) {
          this.phase = 'findpolaris';
          this.feedback = '顺着勺口两颗星连线，找到北极星！';
          this.feedbackT = 2.5;
        }
      } else {
        this.registerMistake(star.id, '顺着勺柄→勺口依次连');
      }
    } else if (this.phase === 'findpolaris') {
      if (star.id === POLARIS.id) {
        this.ctx.audio.play('success');
        this.phase = 'done';
        this.result = constellationResult(this.mistakes);
        this.feedback = '⭐ 找到北极星！那就是正北方';
        this.feedbackT = 2;
      } else {
        this.registerMistake(star.id, '不是这颗，看勺口两星的延长线');
      }
    }
  }

  private registerMistake(starId: number, hint: string): void {
    this.mistakes += 1;
    this.flashStar = starId;
    this.flashT = 0.4;
    this.feedback = `✗ ${hint}`;
    this.feedbackT = 1.2;
    this.ctx.audio.play('fail');
  }

  update(dt: number): void {
    this.time += dt;
    if (this.feedbackT > 0) this.feedbackT = Math.max(0, this.feedbackT - dt);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.phase === 'done' && this.result && !this.winFired) {
      this.finishClock += dt;
      if (this.finishClock > 1.3) {
        this.winFired = true;
        this.ctx.onWin({ perf: this.result.perf });
      }
    }
  }

  render(r: RenderContext): void {
    const { ctx, width } = r;
    this.viewW = width;

    // 夜空渐变
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0E1430');
    sky.addColorStop(0.6, '#1C2347');
    sky.addColorStop(1, '#2A2350');
    ctx.save();
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, H);
    ctx.restore();

    // 背景碎星
    ctx.save();
    for (const s of this.bgStars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 2 + s.ph));
      ctx.globalAlpha = tw * 0.7;
      ctx.fillStyle = '#FBF3D0';
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    this.drawConnections(ctx);
    this.drawPointerGuide(ctx);
    this.drawStars(ctx);
    this.drawHud(ctx, width);
    if (this.feedbackT > 0) this.drawFeedback(ctx, width);
  }

  private drawConnections(ctx: CanvasRenderingContext2D): void {
    if (this.progress < 2 && !(this.progress >= 1)) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(251,243,208,0.85)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(251,243,208,0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < this.progress; i++) {
      const s = DIPPER_STARS.find((x) => x.id === DIPPER_ORDER[i])!;
      const px = this.sx(s.x);
      const py = this.sy(s.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // 完成后连到北极星
    if (this.phase === 'done') {
      const b = DIPPER_STARS.find((s) => s.id === POINTER_STAR_IDS[1])!;
      ctx.save();
      ctx.strokeStyle = 'rgba(120,200,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(this.sx(b.x), this.sy(b.y));
      ctx.lineTo(this.sx(POLARIS.x), this.sy(POLARIS.y));
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPointerGuide(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'findpolaris') return;
    const a = DIPPER_STARS.find((s) => s.id === POINTER_STAR_IDS[0])!;
    const b = DIPPER_STARS.find((s) => s.id === POINTER_STAR_IDS[1])!;
    // 勺口两星延长的引导虚线（脉动）
    ctx.save();
    ctx.strokeStyle = `rgba(120,200,255,${0.35 + 0.3 * Math.sin(this.time * 4)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    ctx.beginPath();
    ctx.moveTo(this.sx(b.x), this.sy(b.y));
    ctx.lineTo(this.sx(b.x + dx * 4), this.sy(b.y + dy * 4));
    ctx.stroke();
    ctx.restore();
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    // 干扰星（暗一点）
    for (const s of DISTRACTORS) this.drawStar(ctx, s, 3, 'rgba(230,230,210,0.55)', false);
    // 北斗七星
    DIPPER_STARS.forEach((s) => {
      const connected = DIPPER_ORDER.indexOf(s.id) < this.progress;
      const isNext = this.phase === 'dipper' && nextDipperId(this.progress) === s.id;
      const isPointer = this.phase !== 'dipper' && POINTER_STAR_IDS.includes(s.id);
      const flash = this.flashStar === s.id && this.flashT > 0;
      const col = flash ? '#C1786A' : connected ? '#FBF3D0' : '#EBD98F';
      const rr = isNext || isPointer ? 7 + Math.sin(this.time * 5) * 1.5 : 5.5;
      this.drawStar(ctx, s, rr, col, isNext || isPointer);
      if (isNext) {
        ctx.save();
        ctx.fillStyle = '#FBF3D0';
        ctx.font = handFont(13);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('👆', this.sx(s.x), this.sy(s.y) - 12);
        ctx.restore();
      }
    });
    // 北极星（找星阶段/完成时高亮）
    const polarisActive = this.phase === 'findpolaris' || this.phase === 'done';
    this.drawStar(
      ctx,
      POLARIS,
      polarisActive ? 7 + Math.sin(this.time * 5) * 1.5 : 4,
      polarisActive ? '#8CD0FF' : 'rgba(200,220,255,0.5)',
      polarisActive,
    );
    if (this.phase === 'done') {
      ctx.save();
      ctx.fillStyle = '#8CD0FF';
      ctx.font = handFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('北极星 ⭐', this.sx(POLARIS.x), this.sy(POLARIS.y) - 12);
      ctx.restore();
    }
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    s: SkyStar,
    radius: number,
    color: string,
    glow: boolean,
  ): void {
    const x = this.sx(s.x);
    const y = this.sy(s.y);
    ctx.save();
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    // 四角星
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? radius : radius * 0.4;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.fillStyle = '#FBF3D0';
    ctx.font = handFont(16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const tip =
      this.phase === 'dipper'
        ? '按顺序点亮北斗七星（从勺柄到勺口）'
        : this.phase === 'findpolaris'
          ? '顺着勺口两颗星的连线，点亮北极星'
          : '';
    ctx.fillText(tip, 18, 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.mistakes > 0 ? '#E0A0A0' : 'rgba(251,243,208,0.7)';
    ctx.fillText(`失误 ${this.mistakes}`, width - 18, 14);
    ctx.restore();
  }

  private drawFeedback(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.feedbackT * 1.4);
    ctx.fillStyle = this.feedback.startsWith('✗') ? '#E8A0A0' : '#FBF3D0';
    ctx.font = handFont(20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedback, width / 2, H - 40);
    ctx.restore();
  }
}
