import type { RenderContext, Scene } from './types';

/**
 * 场景管理器 —— 同一时刻只有一个活动场景。
 * 切换时先 exit 旧场景（清理 DOM/事件），再 enter 新场景。
 */
export class SceneManager {
  private current: Scene | null = null;

  get active(): Scene | null {
    return this.current;
  }

  /** 切换到新场景实例 */
  change(next: Scene): void {
    this.current?.exit();
    this.current = next;
    next.enter();
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(rc: RenderContext): void {
    this.current?.render(rc);
  }
}
