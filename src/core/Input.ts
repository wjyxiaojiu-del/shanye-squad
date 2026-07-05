import type { InputApi, LogicalKey } from './types';

// 物理键(小写) → 逻辑键 的映射。方向键与 WASD 同时支持。
const PHYSICAL_TO_LOGICAL: Record<string, LogicalKey> = {
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  e: 'action',
  enter: 'confirm',
  ' ': 'confirm',
};

/**
 * 键盘输入管理。
 * - isDown(logical)：持续按住（用于左右移动）
 * - onPress(handler)：某键"首次按下"触发一次（用于 E 交互 / 回车确认 / 抓岩点）
 */
export class Input implements InputApi {
  private down = new Set<string>();
  private pressHandlers = new Set<(key: LogicalKey) => void>();

  constructor(private target: Window | HTMLElement = window) {
    target.addEventListener('keydown', this.handleDown as EventListener);
    target.addEventListener('keyup', this.handleUp as EventListener);
  }

  private handleDown = (e: KeyboardEvent) => {
    const phys = e.key.toLowerCase();
    const logical = PHYSICAL_TO_LOGICAL[phys];
    if (!logical) return;
    e.preventDefault();
    // 只有从"未按下"变为"按下"时才算一次 press，避免长按连发。
    if (!this.down.has(phys)) {
      this.down.add(phys);
      this.pressHandlers.forEach((h) => h(logical));
    }
  };

  private handleUp = (e: KeyboardEvent) => {
    this.down.delete(e.key.toLowerCase());
  };

  isDown(key: LogicalKey): boolean {
    for (const [phys, logical] of Object.entries(PHYSICAL_TO_LOGICAL)) {
      if (logical === key && this.down.has(phys)) return true;
    }
    return false;
  }

  /** 注册按下回调，返回取消函数 */
  onPress(handler: (key: LogicalKey) => void): () => void {
    this.pressHandlers.add(handler);
    return () => this.pressHandlers.delete(handler);
  }

  /** 清空当前按下状态（切场景时调用，避免残留） */
  clear() {
    this.down.clear();
  }

  destroy() {
    this.target.removeEventListener('keydown', this.handleDown as EventListener);
    this.target.removeEventListener('keyup', this.handleUp as EventListener);
    this.pressHandlers.clear();
    this.down.clear();
  }
}
