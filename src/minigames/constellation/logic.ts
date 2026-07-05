// ============================================================
// 星空连线 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法：夜空里按正确顺序连出北斗七星，再顺着"勺口"两颗指极星找到北极星。
// 连错顺序会被拒绝并计失误；完成后按失误数评表现分。
// 教学点：星象导航——北斗七星的勺口两星连线延长约 5 倍即指向北极星（正北）。
//
// 坐标为归一化 0..1（x 向右、y 向下），游戏层按画布尺寸缩放。

export interface SkyStar {
  id: number;
  x: number;
  y: number;
}

/** 北斗七星（勺柄在左、勺身在右），按连线顺序排列 */
export const DIPPER_STARS: SkyStar[] = [
  { id: 0, x: 0.16, y: 0.30 }, // 摇光(勺柄尖)
  { id: 1, x: 0.27, y: 0.34 }, // 开阳
  { id: 2, x: 0.38, y: 0.37 }, // 玉衡
  { id: 3, x: 0.49, y: 0.41 }, // 天权(勺口后上)
  { id: 4, x: 0.52, y: 0.56 }, // 天玑(勺口后下)
  { id: 5, x: 0.66, y: 0.55 }, // 天璇(勺口前下·指极星)
  { id: 6, x: 0.63, y: 0.39 }, // 天枢(勺口前上·指极星)
];

/** 连线顺序（星 id） */
export const DIPPER_ORDER: number[] = [0, 1, 2, 3, 4, 5, 6];

/** 勺口两颗指极星（天璇→天枢 连线延长指向北极星） */
export const POINTER_STAR_IDS: [number, number] = [5, 6];

/** 北极星（勺口两星连线延长约 5 倍处） */
export const POLARIS: SkyStar = { id: 100, x: 0.575, y: 0.10 };

/** 干扰星（不参与连线，仅装饰/迷惑） */
export const DISTRACTORS: SkyStar[] = [
  { id: 200, x: 0.82, y: 0.22 },
  { id: 201, x: 0.10, y: 0.66 },
  { id: 202, x: 0.86, y: 0.70 },
  { id: 203, x: 0.74, y: 0.16 },
  { id: 204, x: 0.30, y: 0.72 },
];

/** 已连 progress 颗时，下一颗该连的星 id；连完返回 null */
export function nextDipperId(progress: number): number | null {
  return DIPPER_ORDER[progress] ?? null;
}

/** 已连 progress 颗时，点 id 是否为正确的下一颗 */
export function isCorrectDipper(progress: number, id: number): boolean {
  return DIPPER_ORDER[progress] === id;
}

/** 北斗七星是否已连完 */
export function dipperComplete(progress: number): boolean {
  return progress >= DIPPER_ORDER.length;
}

export interface StarResult {
  success: boolean;
  /** 表现分 0..1（喂给 onWin → 评星） */
  perf: number;
}

/** 依据失误次数评定结果（找到北极星后调用；完成即成功，失误扣分） */
export function constellationResult(mistakes: number): StarResult {
  const perf = Math.max(0.2, 1 - Math.max(0, mistakes) * 0.12);
  return { success: true, perf };
}

/** 工具：两归一化点距离（游戏层命中判定复用） */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
