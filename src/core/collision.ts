// ============================================================
// 纯几何/工具函数 —— 无 DOM 依赖，便于单元测试
// ============================================================

/** 把值限制在 [min, max] 区间 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 一维邻近判定：玩家 x 与目标 x 的距离是否在交互范围内。
 * 营地是横版，交互只看水平距离即可。
 */
export function isWithinRange(playerX: number, targetX: number, range: number): boolean {
  return Math.abs(playerX - targetX) <= range;
}

/**
 * 在一组带 x 坐标的目标中，找出玩家可交互的"最近"目标索引。
 * 无任何目标在范围内时返回 -1。
 */
export function nearestInteractable(
  playerX: number,
  targets: ReadonlyArray<{ x: number }>,
  range: number,
): number {
  let bestIndex = -1;
  let bestDist = Infinity;
  targets.forEach((t, i) => {
    const d = Math.abs(playerX - t.x);
    if (d <= range && d < bestDist) {
      bestIndex = i;
      bestDist = d;
    }
  });
  return bestIndex;
}
