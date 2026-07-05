import type { RoughCanvas } from 'roughjs/bin/canvas';
import type { Section } from '../core/types';
import { drawSignpost } from '../render/handdrawn';

/**
 * 木牌 —— 营地里进入某板块小游戏的入口。
 * 只持有数据与绘制，邻近判定由 core/collision 的纯函数负责。
 */
export class Signpost {
  constructor(
    public readonly section: Section,
    public readonly x: number,
    public readonly groundY: number,
  ) {}

  /** 画到指定屏幕 x（世界坐标由调用方减去相机偏移后传入） */
  draw(rc: RoughCanvas, ctx: CanvasRenderingContext2D, screenX: number, highlighted: boolean): void {
    drawSignpost(rc, ctx, screenX, this.groundY, this.section.title, this.section.color, highlighted);
  }
}
