import rough from 'roughjs';
import type { RoughCanvas } from 'roughjs/bin/canvas';

// ============================================================
// 手绘纸感渲染工具 —— 全游戏统一的画笔与配色
// ============================================================

/** 低饱和调色板 */
export const PALETTE = {
  paper: '#F4ECD8', // 纸底(米黄)
  paperDark: '#E8DCC0',
  ink: '#2B2B2B', // 墨线
  inkSoft: '#5A5A52',
  wood: '#C9A66B', // 木牌
  woodDark: '#9C7A45',
  moss: '#7A8B6F', // 苔绿
  ochre: '#B08968', // 赭石
  mist: '#8FA5AD', // 雾蓝
  brick: '#C1786A', // 砖红
  sky: '#DCE4E2',
  leaf: '#9AAE86',
  stone: '#B9AE97',
} as const;

/** 手写体字体栈（近似手绘中文） */
export const FONT = {
  hand: '"STKaiti","楷体","KaiTi","Kaiti SC","华文楷体",cursive',
} as const;

/** 由字符串生成稳定 seed，避免 Rough.js 每帧随机抖动 */
export function seedFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100000;
}

/** 颜色与白色混合提亮，amount 0..1 */
export function lighten(hex: string, amount = 0.35): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** 设置手写字体并返回，size 单位 px */
export function handFont(size: number, weight = ''): string {
  return `${weight} ${size}px ${FONT.hand}`.trim();
}

/**
 * 离屏图层缓存 —— 把静态手绘元素画一次，主循环里 drawImage 复用，
 * 避免 Rough.js 每帧重新生成路径造成卡顿。
 */
export function renderToLayer(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, rc: RoughCanvas) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const rc = rough.canvas(canvas);
  draw(ctx, rc);
  return canvas;
}

/** 纯色纸底 */
export function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 纸纹理（稀疏淡墨点 + 斑驳）—— 开销较大，建议画进缓存层。
 */
export function drawPaperTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  drawPaper(ctx, w, h);
  ctx.save();
  // 用确定性伪随机铺点，保证每次缓存结果一致
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  ctx.fillStyle = 'rgba(120,100,70,0.05)';
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

/**
 * 手绘木牌（木桩 + 牌板 + 文字）。
 * highlighted 时牌板提亮并加一圈主题色描边，提示"可交互"。
 */
export function drawSignpost(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  title: string,
  color: string,
  highlighted: boolean,
): void {
  const postW = 10;
  const postH = 64;
  const boardW = 138;
  const boardH = 48;
  const boardY = groundY - postH - boardH + 14;
  const seed = seedFor(title);

  // 木桩
  rc.rectangle(x - postW / 2, groundY - postH, postW, postH, {
    fill: PALETTE.woodDark,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.1,
    seed,
  });

  // 高亮外圈
  if (highlighted) {
    rc.rectangle(x - boardW / 2 - 5, boardY - 5, boardW + 10, boardH + 10, {
      stroke: color,
      strokeWidth: 2.5,
      roughness: 1.8,
      seed: seed + 7,
    });
  }

  // 牌板
  rc.rectangle(x - boardW / 2, boardY, boardW, boardH, {
    fill: highlighted ? lighten(color, 0.55) : PALETTE.wood,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1.3,
    seed,
  });

  // 文字
  ctx.save();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = handFont(19);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, x, boardY + boardH / 2 + 1);
  ctx.restore();
}

/** 像素小人可选配色 */
export interface HeroStyle {
  shirt?: string;
  pants?: string;
  skin?: string;
  pack?: string;
}

/**
 * 像素小人 —— 程序化方块绘制（手绘场景中的像素角色对比）。
 * centerX/footY 为脚底中心；facing 朝向；walk 为 0..1 走路相位。
 */
export function drawPixelHero(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  footY: number,
  opts: { facing?: 1 | -1; walk?: number; scale?: number } & HeroStyle = {},
): void {
  const s = opts.scale ?? 4;
  const facing = opts.facing ?? 1;
  const walk = opts.walk ?? 0;
  const skin = opts.skin ?? '#F0C9A0';
  const shirt = opts.shirt ?? PALETTE.moss;
  const pants = opts.pants ?? '#5B4636';
  const pack = opts.pack ?? PALETTE.brick;
  const hair = PALETTE.ink;

  const swing = Math.round(Math.sin(walk * Math.PI * 2)); // -1/0/1 摆腿
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) > 0.5 ? -1 : 0; // 身体上下

  ctx.save();
  ctx.translate(centerX, footY);
  ctx.scale(facing, 1);

  // (0,0)=脚底中心，向上为负 y；单位为"像素格"
  const r = (gx: number, gy: number, gw: number, gh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(gx * s), Math.round(gy * s), Math.round(gw * s), Math.round(gh * s));
  };

  // 腿 + 鞋
  r(-2, -4 + bob, 2, 3, pants);
  r(0, -4 + bob, 2, 3, pants);
  r(-2 - swing, -1, 2, 1, PALETTE.ink);
  r(swing, -1, 2, 1, PALETTE.ink);

  // 身体 + 背包 + 手
  const bodyTop = -9 + bob;
  r(2, bodyTop, 2, 4, pack);
  r(-3, bodyTop, 6, 5, shirt);
  r(-4, bodyTop + 1, 1, 3, skin);
  r(3, bodyTop + 1, 1, 3, skin);

  // 头 + 探险帽 + 眼
  const headTop = -14 + bob;
  r(-3, headTop + 2, 6, 3, skin);
  r(-3, headTop, 6, 2, hair);
  r(-4, headTop + 2, 8, 1, PALETTE.woodDark);
  r(1, headTop + 3, 1, 1, PALETTE.ink);

  ctx.restore();
}

/** 手绘圆点云/铃铛等小图元的通用抖动圆 */
export function roughCircle(
  rc: RoughCanvas,
  x: number,
  y: number,
  d: number,
  fill: string,
  seed = 1,
): void {
  rc.circle(x, y, d, {
    fill,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.2,
    seed,
  });
}

/**
 * 攀爬姿态的像素小人 —— 四肢分别伸向两个手点、两个脚点，身体随之倾斜。
 * 所有坐标为屏幕像素；handX/footX 等为该四肢要抓/蹬的目标点（可为 null 用默认贴身位置）。
 */
export function drawClimberHero(
  ctx: CanvasRenderingContext2D,
  opts: {
    cx: number; // 躯干中心 x
    cy: number; // 躯干中心 y
    facing?: 1 | -1;
    reachHand?: { x: number; y: number } | null; // 正在伸出去抓的手
    scale?: number;
    shirt?: string;
    harness?: boolean;
  },
): void {
  const s = opts.scale ?? 3.4;
  const facing = opts.facing ?? 1;
  const skin = '#F0C9A0';
  const shirt = opts.shirt ?? PALETTE.mist;
  const pants = '#5B4636';

  const cx = opts.cx;
  const cy = opts.cy;

  // 躯干（略微倾向前进方向）
  const lean = facing * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(lean);

  const px = (v: number) => Math.round(v * s);
  const limb = (x1: number, y1: number, x2: number, y2: number, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px(x1), px(y1));
    ctx.lineTo(px(x2), px(y2));
    ctx.stroke();
  };

  // 相对躯干中心的局部坐标（单位=格）
  const shoulderY = -3;
  const hipY = 2.5;

  // 腿：蹬向下方两侧
  limb(-1.4, hipY, -2.4, hipY + 3.4, pants, 1.5);
  limb(1.4, hipY, 2.4, hipY + 3.4, pants, 1.5);
  // 鞋
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(px(-3.1), px(hipY + 3.2), px(1.4), px(1.1));
  ctx.fillRect(px(1.7), px(hipY + 3.2), px(1.4), px(1.1));

  // 一只手抓当前岩点（贴身），另一只伸向 reachHand
  const anchorHand = { x: -2 * facing, y: shoulderY - 1.5 };
  limb(-0.8 * facing, shoulderY, anchorHand.x, anchorHand.y, skin, 1.3);

  ctx.restore();

  // 伸出的手：用世界坐标直接连到目标点（在 rotate 之外，指向更准）
  if (opts.reachHand) {
    ctx.save();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 1.3 * s;
    ctx.lineCap = 'round';
    const sx = cx + facing * 1.2 * s;
    const sy = cy - 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(opts.reachHand.x, opts.reachHand.y);
    ctx.stroke();
    ctx.restore();
  }

  // 躯干 + 背包 + 头（画在最上层）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(lean);
  // 背包
  ctx.fillStyle = PALETTE.brick;
  ctx.fillRect(px(-0.5), px(shoulderY), px(2.6 * facing), px(4.5));
  // 躯干
  ctx.fillStyle = shirt;
  ctx.fillRect(px(-2), px(shoulderY), px(4), px(5.5));
  if (opts.harness) {
    // 安全带：腰带、腿环、连接环，让抱石/攀爬场景更有安全装备感。
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(px(-2.3), px(hipY - 0.3), px(4.6), px(0.75));
    ctx.fillRect(px(-1.9), px(hipY + 0.9), px(1.45), px(0.55));
    ctx.fillRect(px(0.45), px(hipY + 0.9), px(1.45), px(0.55));
    ctx.fillStyle = '#F2D06B';
    ctx.fillRect(px(-0.45), px(hipY + 0.35), px(0.9), px(1.2));
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1, 0.45 * s);
    ctx.beginPath();
    ctx.moveTo(px(-1.8), px(shoulderY + 0.6));
    ctx.lineTo(px(0), px(hipY - 0.1));
    ctx.lineTo(px(1.8), px(shoulderY + 0.6));
    ctx.stroke();
  }
  // 头
  ctx.fillStyle = skin;
  ctx.fillRect(px(-1.8), px(shoulderY - 3.5), px(3.6), px(3.2));
  // 帽
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(px(-1.8), px(shoulderY - 4), px(3.6), px(1.2));
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(px(-2.4 + (facing < 0 ? 1.4 : 0)), px(shoulderY - 3), px(1.6), px(0.9));
  ctx.restore();
}

// ============================================================
// 可复用布景元素（开始/营地/房间共用，风格统一）
// ============================================================

/** 远山（半弧） */
export function drawHill(
  rc: RoughCanvas,
  x: number,
  baseY: number,
  w: number,
  h: number,
  color: string,
  seed: number,
): void {
  rc.path(`M ${x - w / 2} ${baseY} Q ${x} ${baseY - h} ${x + w / 2} ${baseY} Z`, {
    fill: color,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.8,
    seed,
  });
}

/** 云朵（三团椭圆） */
export function drawCloud(rc: RoughCanvas, x: number, y: number, s: number, seed: number): void {
  const opt = {
    fill: '#FBF6EA',
    fillStyle: 'solid' as const,
    stroke: PALETTE.ink,
    strokeWidth: 1.5,
    roughness: 1.4,
    seed,
  };
  rc.ellipse(x, y, 60 * s, 34 * s, opt);
  rc.ellipse(x - 22 * s, y + 6 * s, 40 * s, 26 * s, opt);
  rc.ellipse(x + 22 * s, y + 8 * s, 46 * s, 26 * s, opt);
}

/** 树（树干 + 树冠） */
export function drawTree(rc: RoughCanvas, x: number, groundY: number, s: number, seed: number): void {
  rc.rectangle(x - 4, groundY - 30 * s, 8, 30 * s, {
    fill: PALETTE.woodDark,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.2,
    seed,
  });
  rc.circle(x, groundY - 42 * s, 48 * s, {
    fill: PALETTE.leaf,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1.7,
    seed: seed + 3,
  });
}

/** 帐篷（房间入口标志） */
export function drawTent(rc: RoughCanvas, x: number, groundY: number, seed: number): void {
  const w = 96;
  const h = 66;
  rc.polygon(
    [
      [x, groundY - h],
      [x - w / 2, groundY],
      [x + w / 2, groundY],
    ],
    { fill: PALETTE.brick, fillStyle: 'solid', stroke: PALETTE.ink, strokeWidth: 2.5, roughness: 1.3, seed },
  );
  rc.polygon(
    [
      [x, groundY - h + 8],
      [x - 15, groundY],
      [x + 15, groundY],
    ],
    { fill: PALETTE.paperDark, fillStyle: 'solid', stroke: PALETTE.ink, strokeWidth: 2, roughness: 1.3, seed: seed + 1 },
  );
}

/** 公告板（图鉴入口标志） */
export function drawBoard(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  label: string,
  seed: number,
): void {
  const bw = 116;
  const bh = 76;
  const top = groundY - 118;
  rc.rectangle(x - 5, top, 10, 118, {
    fill: PALETTE.woodDark,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2,
    roughness: 1,
    seed,
  });
  rc.rectangle(x - bw / 2, top - 12, bw, bh, {
    fill: PALETTE.paperDark,
    fillStyle: 'solid',
    stroke: PALETTE.ink,
    strokeWidth: 2.5,
    roughness: 1.2,
    seed: seed + 2,
  });
  ctx.save();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = handFont(16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, top - 12 + bh / 2);
  ctx.restore();
}

/** 地面（土色填充 + 墨线地平线） */
export function drawGround(ctx: CanvasRenderingContext2D, w: number, groundY: number, h: number): void {
  ctx.save();
  ctx.fillStyle = '#DCCDA6';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
  ctx.restore();
}
