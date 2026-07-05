import type { GameServices, PointerPos, RenderContext, Scene } from '../core/types';
import type { RoughCanvas } from 'roughjs/bin/canvas';
import { el } from '../ui/dom';
import { STICKERS } from '../state/stickers';
import { PALETTE, drawPaper, handFont, seedFor } from '../render/handdrawn';
import { showSleepOverlay, showCookingOverlay } from '../interact/RoomOverlays';
import {
  toggleFullscreen,
  isFullscreen,
  iosPwaHint,
  isIOSSafariNotStandalone,
} from '../ui/fullscreen';

/** 房间 — 露营装备互动空间 */
export class RoomScene implements Scene {
  readonly id = 'room' as const;
  private back: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private hud: HTMLElement | null = null;
  private hoverHint: HTMLElement | null = null;

  constructor(private services: GameServices) {}

  enter(): void {
    const s = this.services;
    const back = el('button', { class: 'hand-btn top-left-back', text: '← 返回营地' });
    back.addEventListener('click', () => s.nav.goCamp());
    s.uiLayer.append(back);
    this.back = back;
    this.unsub = s.input.onPress((k) => {
      if (k === 'action' || k === 'confirm') s.nav.goCamp();
    });
    this.buildHud();
  }

  exit(): void {
    this.back?.remove();
    this.hud?.remove();
    this.hoverHint?.remove();
    this.back = this.hud = this.hoverHint = null;
    this.unsub?.();
    this.unsub = null;
  }

  update(): void {
    this.refreshHud();
  }

  private buildHud(): void {
    const hud = el('div', { class: 'room-hud' });
    hud.innerHTML = `
      <div class="room-hud-row">
        <span class="room-hud-icon">❤️</span>
        <div class="room-hud-bar"><div class="room-hud-fill"></div></div>
        <span class="room-hud-num"></span>
      </div>
      <div class="room-hud-buff"></div>
      <div class="room-hud-actions">
        <button class="room-hud-music" title="背景音乐开关 / 长按切音量">♪</button>
        <button class="room-hud-fullscreen" title="全屏/隐藏浏览器地址栏">⛶</button>
      </div>
    `;
    const fsBtn = hud.querySelector('.room-hud-fullscreen') as HTMLButtonElement | null;
    fsBtn?.addEventListener('click', () => this.onFullscreenClick(fsBtn));
    const musicBtn = hud.querySelector('.room-hud-music') as HTMLButtonElement | null;
    musicBtn?.addEventListener('click', () => {
      this.services.audio.play('click');
      const on = this.services.audio.toggleMusic();
      // 字符不变（保持视觉简洁），用 .on class 切换颜色提示播放/停止状态
      musicBtn.classList.toggle('on', on);
    });
    // iOS Safari 未加桌面:按钮直接换成添加桌面提示(初次进入)
    if (fsBtn && isIOSSafariNotStandalone()) {
      fsBtn.title = 'iPhone 想全屏请添加到主屏幕';
    }
    this.services.uiLayer.append(hud);
    this.hud = hud;
    this.refreshHud();
  }

  private onFullscreenClick(_btn: HTMLButtonElement): void {
    this.services.audio.play('click');
    if (isIOSSafariNotStandalone()) {
      // iOS Safari 点按钮就直接告知桌面全屏法(比调 API 失败后再提示更直接)
      alert(iosPwaHint());
      return;
    }
    toggleFullscreen();
    setTimeout(() => {
      if (!isFullscreen()) {
        const hint = iosPwaHint();
        if (hint) alert(hint);
      }
    }, 200);
  }

  refreshHud(): void {
    if (!this.hud) return;
    const s = this.services.save.stamina;
    const fill = this.hud.querySelector('.room-hud-fill') as HTMLElement | null;
    const num = this.hud.querySelector('.room-hud-num') as HTMLElement | null;
    const buff = this.hud.querySelector('.room-hud-buff') as HTMLElement | null;
    if (fill) fill.style.width = `${s}%`;
    if (num) num.textContent = `${s}`;
    if (buff) buff.textContent = '';
    if (fill) {
      fill.style.background = s > 60 ? PALETTE.moss : s > 30 ? PALETTE.ochre : PALETTE.brick;
    }
  }

  /** 点击/触摸画布 — 检测命中哪个装备 */
  onPointer(p: PointerPos): void {
    const hit = HITBOXES.find(
      (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
    );
    if (!hit) return;
    this.services.audio.play('click');
    if (hit.kind === 'sleep') {
      showSleepOverlay({
        uiLayer: this.services.uiLayer,
        audio: this.services.audio,
        fromStamina: this.services.save.stamina,
        onRest: () => this.services.save.rest(),
      });
    } else if (hit.kind === 'cook') {
      const before = this.services.save.stamina;
      showCookingOverlay({
        uiLayer: this.services.uiLayer,
        audio: this.services.audio,
        onCookFinish: (restored) => {
          const target = Math.min(100, before + restored);
          // 先 rest 满再 consume 回目标值（只调公开 API，不直接写 _stamina）
          this.services.save.rest();
          const over = 100 - target;
          if (over > 0) this.services.save.consumeStamina(over);
        },
      });
    }
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    drawPaper(ctx, width, height);

    // 标题
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('🏠 我的房间 · 互动露营装备间', width / 2, 8);
    ctx.restore();

    // 墙框
    const wallTop = 38;
    const wallPad = Math.max(20, width * 0.04);
    const wallBottom = height;
    rough.rectangle(wallPad, wallTop, width - wallPad * 2, wallBottom - wallTop, {
      fill: PALETTE.paperDark,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 3,
      roughness: 1.4,
      seed: 9,
    });

    // 装备们（绘制）
    drawBackpack(ctx, rough, width);
    drawTentCorner(ctx, rough, width);
    drawSleepBag(ctx, rough, width, height);
    drawShoes(ctx, rough, width, height);
    drawCookSet(ctx, rough, width, height);
    drawHeadLamp(ctx, rough, width, height);

    // 可交互装备的提示标签
    ctx.save();
    ctx.font = handFont(11);
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.textAlign = 'center';
    ctx.fillText('💤 点击睡袋 = 睡觉恢复体力', width * 0.28, height * 0.80);
    ctx.fillText('🍳 点击炉头 = 做饭回体力', width * 0.74, height * 0.80);
    ctx.restore();

    // 贴纸墙（挂在上半墙面的徽章收藏板）
    this.drawStickerWall(ctx, rough, width);
  }

  /** 徽章收藏墙 —— 上半墙面的挂绳 + 木相框展示 */
  private drawStickerWall(
    ctx: CanvasRenderingContext2D,
    rough: RoughCanvas,
    width: number,
  ): void {
    const earnedSet = new Set(
      STICKERS.filter((st) => this.services.save.isUnlocked(st.id)).map((st) => st.id),
    );
    const earnedCount = earnedSet.size;

    // 展示band：避开左侧背包(≈0.06w+90)与右侧帐篷角(0.78w)
    const bandLeft = Math.max(width * 0.19, width * 0.06 + 96);
    const bandRight = width * 0.74;
    const bandW = bandRight - bandLeft;

    // 标题 + 计数
    const titleY = 46;
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = handFont(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('🏅 我的徽章墙', (bandLeft + bandRight) / 2, titleY);
    ctx.font = handFont(11);
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(`已收集 ${earnedCount} / ${STICKERS.length} 枚`, (bandLeft + bandRight) / 2, titleY + 20);
    ctx.restore();

    const cols = 6;
    const rows = Math.ceil(STICKERS.length / cols);
    const cellW = bandW / cols;
    const frameSize = Math.min(cellW - 10, 62);
    const rowGap = 82;
    const topY = titleY + 44;

    for (let row = 0; row < rows; row++) {
      const stringY = topY + row * rowGap;
      const x0 = bandLeft + 6;
      const x1 = bandRight - 6;
      const sag = 12;
      const cxMid = (x0 + x1) / 2;
      const ctrlY = stringY + sag;

      // 两端挂钉
      rough.circle(x0, stringY, 6, {
        fill: PALETTE.ink, fillStyle: 'solid', stroke: PALETTE.ink, strokeWidth: 1, roughness: 0.6, seed: 300 + row,
      });
      rough.circle(x1, stringY, 6, {
        fill: PALETTE.ink, fillStyle: 'solid', stroke: PALETTE.ink, strokeWidth: 1, roughness: 0.6, seed: 320 + row,
      });
      // 挂绳（下垂弧线）
      rough.path(`M ${x0} ${stringY} Q ${cxMid} ${ctrlY} ${x1} ${stringY}`, {
        stroke: PALETTE.woodDark, strokeWidth: 2, roughness: 1.2, seed: 340 + row,
      });

      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (idx >= STICKERS.length) break;
        const st = STICKERS[idx];
        const earned = earnedSet.has(st.id);

        // 相框中心 x + 绳上对应点 y（二次贝塞尔）
        const fx = bandLeft + cellW * (col + 0.5);
        const t = (fx - x0) / (x1 - x0);
        const stringPtY = (1 - t) * (1 - t) * stringY + 2 * (1 - t) * t * ctrlY + t * t * stringY;

        // 每帧稳定的小倾角
        const tilt = (((seedFor(st.id) % 11) - 5) / 5) * 0.10;
        const wire = 12;
        const frameTop = stringPtY + wire;
        const frameCx = fx;
        const frameCy = frameTop + frameSize / 2;

        // 挂绳到相框的小吊线
        rough.line(fx, stringPtY, frameCx, frameTop, {
          stroke: PALETTE.woodDark, strokeWidth: 1.5, roughness: 0.8, seed: seedFor(st.id) + 1,
        });

        ctx.save();
        ctx.translate(frameCx, frameCy);
        ctx.rotate(tilt);

        const half = frameSize / 2;
        // 外木框
        rough.rectangle(-half, -half, frameSize, frameSize, {
          fill: earned ? PALETTE.wood : PALETTE.paperDark,
          fillStyle: 'solid',
          stroke: PALETTE.ink,
          strokeWidth: earned ? 2.4 : 1.6,
          roughness: 1.1,
          seed: seedFor(st.id),
        });
        // 内衬（相片纸）
        const inset = frameSize * 0.16;
        rough.rectangle(-half + inset, -half + inset, frameSize - inset * 2, frameSize - inset * 2, {
          fill: earned ? PALETTE.paper : 'rgba(0,0,0,0.04)',
          fillStyle: 'solid',
          stroke: earned ? PALETTE.ink : PALETTE.inkSoft,
          strokeWidth: 1.2,
          roughness: earned ? 0.9 : 1.4,
          seed: seedFor(st.id) + 2,
        });

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (earned) {
          ctx.font = handFont(frameSize * 0.42);
          ctx.fillText(st.emoji, 0, -frameSize * 0.02);
          ctx.font = handFont(8);
          ctx.fillStyle = PALETTE.ink;
          ctx.fillText(st.name.slice(0, 5), 0, half - inset - 4);
        } else {
          ctx.font = handFont(frameSize * 0.34);
          ctx.fillStyle = PALETTE.inkSoft;
          ctx.globalAlpha = 0.5;
          ctx.fillText('❔', 0, 0);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }

    if (earnedCount === 0) {
      ctx.save();
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.font = handFont(12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('还没有徽章，去营地闯关收集，挂满这面墙吧！', (bandLeft + bandRight) / 2, topY + rows * rowGap - 8);
      ctx.restore();
    }
  }
}

// ============================================================
// 可交互装备 hitboxes
// ============================================================
interface HitBox {
  kind: 'sleep' | 'cook' | 'none';
  x: number;
  y: number;
  w: number;
  h: number;
}

const HITBOXES: HitBox[] = [
  { kind: 'sleep', x: 80, y: 320, w: 200, h: 110 },
  { kind: 'cook', x: 580, y: 280, w: 180, h: 130 },
];

// ============================================================
// 各装备的 rough.js 绘制函数
// ============================================================

function drawBackpack(ctx: CanvasRenderingContext2D, rough: RoughCanvas, width: number) {
  const bx = width * 0.06;
  const by = 80;
  rough.rectangle(bx, by, 90, 110, {
    fill: PALETTE.ochre,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1.3,
    seed: 11,
  });
  // 盖子
  rough.rectangle(bx + 10, by - 8, 70, 26, {
    fill: PALETTE.wood,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.2,
    seed: 12,
  });
  // 口袋
  rough.rectangle(bx + 14, by + 60, 60, 30, {
    fill: PALETTE.paper,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.1,
    seed: 13,
  });
  // 标签
  ctx.save();
  ctx.font = handFont(10);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('60L 背包', bx + 45, by + 40);
  ctx.restore();
}

function drawTentCorner(ctx: CanvasRenderingContext2D, rough: RoughCanvas, width: number) {
  const tx = width * 0.78;
  const ty = 50;
  rough.polygon(
    [
      [tx, ty],
      [tx + 110, ty + 30],
      [tx + 20, ty + 90],
    ],
    {
      fill: PALETTE.brick,
      fillStyle: 'solid',
      stroke: PALETTE.ink,
      strokeWidth: 2.5,
      roughness: 1.4,
      seed: 14,
    },
  );
  ctx.save();
  ctx.font = handFont(10);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('帐篷角', tx + 60, ty + 50);
  ctx.restore();
}

function drawSleepBag(ctx: CanvasRenderingContext2D, rough: RoughCanvas, _width: number, height: number) {
  // 睡垫（底层）
  const mx = 80;
  const my = height - 180;
  rough.ellipse(mx + 95, my + 90, 200, 50, {
    fill: PALETTE.mist,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.3,
    seed: 15,
  });
  // 睡袋
  rough.rectangle(mx + 10, my + 30, 180, 80, {
    fill: PALETTE.brick,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.8,
    roughness: 1.2,
    seed: 16,
  });
  // 睡袋盖子
  rough.rectangle(mx + 10, my + 30, 70, 80, {
    fill: PALETTE.brick,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.1,
    seed: 17,
    bowing: 2,
  });
  // 标签
  ctx.save();
  ctx.font = handFont(13);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('💤 点我睡觉', mx + 95, my + 75);
  ctx.restore();
}

function drawShoes(ctx: CanvasRenderingContext2D, rough: RoughCanvas, _width: number, height: number) {
  const sx = 100;
  const sy = height - 100;
  // 两只登山鞋
  rough.ellipse(sx + 20, sy + 14, 36, 16, {
    fill: PALETTE.ochre,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.2,
    seed: 18,
  });
  rough.ellipse(sx + 60, sy + 14, 36, 16, {
    fill: PALETTE.ochre,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.2,
    seed: 19,
  });
  ctx.save();
  ctx.font = handFont(9);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('登山鞋', sx + 40, sy + 36);
  ctx.restore();
}

function drawCookSet(ctx: CanvasRenderingContext2D, rough: RoughCanvas, width: number, height: number) {
  const cx = width * 0.62;
  const cy = height - 190;
  // 气罐
  rough.ellipse(cx + 22, cy + 70, 22, 36, {
    fill: PALETTE.stone,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1.3,
    seed: 21,
  });
  // 炉头
  rough.rectangle(cx + 48, cy + 36, 36, 18, {
    fill: PALETTE.ink,
    fillStyle: 'solid',
    stroke: PALETTE.wood,
    strokeWidth: 1.5,
    roughness: 1,
    seed: 22,
  });
  // 锅
  rough.ellipse(cx + 80, cy + 14, 40, 14, {
    fill: PALETTE.paperDark,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1.3,
    seed: 23,
  });
  // 锅把
  rough.line(cx + 118, cy + 10, cx + 138, cy + 6, {
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1,
    seed: 24,
  });
  // 铲子
  rough.line(cx + 10, cy - 14, cx + 44, cy + 2, {
    stroke: PALETTE.wood,
    strokeWidth: 3,
    roughness: 1,
    seed: 25,
  });
  rough.line(cx + 8, cy - 18, cx + 16, cy - 12, {
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1,
    seed: 26,
  });
  // 标签
  ctx.save();
  ctx.font = handFont(13);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('🍳 点我做饭', cx + 80, cy + 60);
  ctx.restore();
}

function drawHeadLamp(ctx: CanvasRenderingContext2D, rough: RoughCanvas, width: number, height: number) {
  const hx = width * 0.42;
  const hy = height - 90;
  rough.ellipse(hx, hy, 14, 14, {
    fill: PALETTE.wood,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1,
    seed: 27,
  });
  ctx.save();
  ctx.fillStyle = 'rgba(255,244,150,0.5)';
  ctx.beginPath();
  ctx.arc(hx, hy, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = handFont(9);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.fillText('露营灯', hx, hy + 32);
  ctx.restore();
}
