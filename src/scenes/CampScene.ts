import type { GameServices, PointerPos, RenderContext, Scene, SectionId } from '../core/types';
import { clamp, nearestInteractable } from '../core/collision';
import { Player } from '../entities/Player';
import { Signpost } from '../entities/Signpost';
import { SECTIONS } from '../state/stickers';
import { el } from '../ui/dom';
import { MusicHud } from '../ui/MusicHud';
import {
  PALETTE,
  drawBoard,
  drawCloud,
  drawGround,
  drawHill,
  drawPaper,
  drawTent,
  drawTree,
  handFont,
} from '../render/handdrawn';

const WORLD_WIDTH = 2360;
const RANGE = 82; // 交互半径

type Kind = 'section' | 'room' | 'gallery';

interface Interactable {
  x: number;
  label: string;
  kind: Kind;
  sectionId?: SectionId;
}

/**
 * 主世界营地地图 —— 横版、相机跟随、6 木牌 + 帐篷(房间) + 公告板(图鉴)。
 * 玩家靠近可交互物按 E 进入。
 */
export class CampScene implements Scene {
  readonly id = 'camp' as const;

  private player: Player;
  private signposts: Signpost[] = [];
  private interactables: Interactable[] = [];
  private camX = 0;
  private currentIndex = -1;
  private groundY: number;
  /** 点击某入口后：走到后自动进入的目标索引 */
  private pendingEnter = -1;

  private hint: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private musicHud: MusicHud | null = null;

  constructor(
    private services: GameServices,
    opts: { focusSection?: SectionId } = {},
  ) {
    this.groundY = services.height * 0.8;

    // 6 个板块木牌，均匀分布
    const firstX = 300;
    const gap = 336;
    SECTIONS.forEach((section, i) => {
      const x = firstX + i * gap;
      this.signposts.push(new Signpost(section, x, this.groundY));
      this.interactables.push({ x, label: section.title, kind: 'section', sectionId: section.id });
    });

    // 帐篷=房间(最左)，公告板=图鉴(最右)
    this.interactables.push({ x: 130, label: '我的房间', kind: 'room' });
    this.interactables.push({ x: WORLD_WIDTH - 120, label: '活动图鉴', kind: 'gallery' });

    // 玩家初始位置：从小游戏返回则站在对应木牌旁，否则在起点
    let startX = firstX;
    if (opts.focusSection) {
      const sp = this.signposts.find((s) => s.section.id === opts.focusSection);
      if (sp) startX = sp.x;
    }
    this.player = new Player(startX, this.groundY);
  }

  enter(): void {
    const s = this.services;
    this.camX = this.computeCam();

    // 交互提示气泡
    const hint = el('div', { class: 'interact-hint' });
    hint.style.display = 'none';
    s.uiLayer.append(hint);
    this.hint = hint;

    this.unsub = s.input.onPress((k) => {
      if (k !== 'action') return;
      if (this.currentIndex >= 0) this.trigger(this.interactables[this.currentIndex]);
    });

    // 背景音乐 HUD:进营地就挂,首次用户解锁后自动起
    this.musicHud = new MusicHud(this.services.audio);
    this.musicHud.attach(s.uiLayer);
    // 进营地时已经历过多次用户手势(开始页点进入),audio 已是 unlocked
    queueMicrotask(() => this.musicHud!.startIfAllowed());
  }

  private trigger(it: Interactable): void {
    const nav = this.services.nav;
    if (it.kind === 'room') nav.goRoom();
    else if (it.kind === 'gallery') nav.goGallery();
    else if (it.kind === 'section' && it.sectionId) {
      if (it.sectionId === 'safety') nav.openSafetyCourse();
      else nav.openSection(it.sectionId);
    }
  }

  private computeCam(): number {
    return clamp(this.player.x - this.services.width / 2, 0, WORLD_WIDTH - this.services.width);
  }

  update(dt: number): void {
    this.player.update(dt, this.services.input, 80, WORLD_WIDTH - 80);
    this.camX = this.computeCam();
    this.currentIndex = nearestInteractable(this.player.x, this.interactables, RANGE);
    this.updateHint();

    // 点击入口后自动寻路：走到范围内即进入
    if (this.pendingEnter >= 0 && this.player.targetX === null) {
      const it = this.interactables[this.pendingEnter];
      this.pendingEnter = -1;
      if (Math.abs(this.player.x - it.x) <= RANGE) this.trigger(it);
    }
  }

  /** 点击：走向最近入口；点空地就走过去 */
  onPointer(p: PointerPos): void {
    const worldX = p.x + this.camX;
    // 找点击处最近的入口（放宽命中范围，方便手指点木牌）
    let hit = -1;
    let best = 120;
    this.interactables.forEach((it, i) => {
      const d = Math.abs(worldX - it.x);
      if (d < best) {
        best = d;
        hit = i;
      }
    });
    if (hit >= 0) {
      const it = this.interactables[hit];
      this.player.moveTo(it.x);
      this.pendingEnter = hit;
      // 若已经站在范围内，直接进入
      if (Math.abs(this.player.x - it.x) <= RANGE) {
        this.pendingEnter = -1;
        this.trigger(it);
      }
    } else {
      this.player.moveTo(clamp(worldX, 80, WORLD_WIDTH - 80));
      this.pendingEnter = -1;
    }
  }

  private updateHint(): void {
    if (!this.hint) return;
    if (this.currentIndex < 0) {
      this.hint.style.display = 'none';
      return;
    }
    const it = this.interactables[this.currentIndex];
    const screenX = it.x - this.camX;
    const topY = this.groundY - 150;
    this.hint.style.display = '';
    this.hint.style.left = `${(screenX / this.services.width) * 100}%`;
    this.hint.style.top = `${(topY / this.services.height) * 100}%`;
    this.hint.innerHTML = `<span class="key">E</span>进入 ${it.label}`;
  }

  render(r: RenderContext): void {
    const { ctx, rough, width, height } = r;
    const gy = this.groundY;
    drawPaper(ctx, width, height);

    // 视差背景
    const cloudOff = this.camX * 0.2;
    drawCloud(rough, 300 - cloudOff, 90, 1.1, 11);
    drawCloud(rough, 900 - cloudOff, 70, 0.9, 21);
    drawCloud(rough, 1500 - cloudOff, 100, 1.0, 23);

    const hillOff = this.camX * 0.4;
    drawHill(rough, 400 - hillOff, gy, 620, 220, PALETTE.mist, 5);
    drawHill(rough, 900 - hillOff, gy, 720, 300, PALETTE.moss, 8);
    drawHill(rough, 1500 - hillOff, gy, 680, 250, PALETTE.mist, 12);

    const midOff = this.camX * 0.7;
    for (let i = 0; i < 6; i++) {
      drawTree(rough, 250 + i * 380 - midOff, gy, 1.2, 50 + i);
    }

    drawGround(ctx, width, gy, height);

    // 世界物（视差 1.0）
    const wx = (worldX: number) => worldX - this.camX;

    // 帐篷(房间)
    drawTent(rough, wx(130), gy, 61);
    // 公告板(图鉴)
    drawBoard(rough, ctx, wx(WORLD_WIDTH - 120), gy, '图鉴', 71);
    // 装饰树
    drawTree(rough, wx(210), gy, 1.5, 81);
    drawTree(rough, wx(2180), gy, 1.4, 83);

    // 木牌
    for (const sp of this.signposts) {
      const highlight =
        this.currentIndex >= 0 &&
        this.interactables[this.currentIndex].kind === 'section' &&
        this.interactables[this.currentIndex].sectionId === sp.section.id;
      const sx = wx(sp.x);
      if (sx < -120 || sx > width + 120) continue;
      sp.draw(rough, ctx, sx, highlight);
    }

    // 玩家
    this.player.drawAt(ctx, this.player.x - this.camX, gy);

    // 顶部操作提示
    ctx.save();
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.font = handFont(15);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('← → 走动　·　点木牌即可前往并进入', 18, 14);
    ctx.restore();
  }

  exit(): void {
    this.musicHud?.destroy();
    this.musicHud = null;
    this.hint?.remove();
    this.hint = null;
    this.unsub?.();
    this.unsub = null;
  }
}
