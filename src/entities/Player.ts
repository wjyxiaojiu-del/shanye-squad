import type { InputApi } from '../core/types';
import { clamp } from '../core/collision';
import { drawPixelHero } from '../render/handdrawn';

const SPEED = 230; // 水平移动速度 px/s

/**
 * 玩家像素小人 —— 营地里的左右移动角色。
 */
export class Player {
  x: number;
  facing: 1 | -1 = 1;
  /** 走路相位 0..1，驱动摆腿动画 */
  walk = 0;
  /** 自动寻路目标 x（点击木牌后设置）；null 表示无 */
  targetX: number | null = null;

  constructor(x: number, public footY: number) {
    this.x = x;
  }

  /** 设置自动走向的目标（触屏/点击用） */
  moveTo(x: number): void {
    this.targetX = x;
  }

  update(dt: number, input: InputApi, minX: number, maxX: number): void {
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;

    if (dir !== 0) {
      // 键盘操作优先，取消自动寻路
      this.targetX = null;
    } else if (this.targetX !== null) {
      const d = this.targetX - this.x;
      if (Math.abs(d) <= 4) {
        this.targetX = null;
      } else {
        dir = d > 0 ? 1 : -1;
      }
    }

    if (dir !== 0) {
      this.facing = dir > 0 ? 1 : -1;
      this.x = clamp(this.x + dir * SPEED * dt, minX, maxX);
      this.walk = (this.walk + dt * 2.4) % 1;
    } else {
      this.walk = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawAt(ctx, this.x, this.footY);
  }

  /** 画到指定屏幕坐标（营地里传入 x - camX） */
  drawAt(ctx: CanvasRenderingContext2D, screenX: number, footY: number): void {
    drawPixelHero(ctx, screenX, footY, {
      facing: this.facing,
      walk: this.walk,
      scale: 4,
    });
  }
}
