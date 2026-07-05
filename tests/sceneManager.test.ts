import { describe, it, expect, vi } from 'vitest';
import { SceneManager } from '../src/core/SceneManager';
import type { RenderContext, Scene, SceneId } from '../src/core/types';

function fakeScene(id: SceneId): Scene {
  return {
    id,
    enter: vi.fn(),
    exit: vi.fn(),
    update: vi.fn(),
    render: vi.fn(),
  };
}

const rc = {} as RenderContext;

describe('场景管理 SceneManager', () => {
  it('首次切换会 enter 新场景', () => {
    const sm = new SceneManager();
    const a = fakeScene('start');
    sm.change(a);
    expect(a.enter).toHaveBeenCalledTimes(1);
    expect(sm.active).toBe(a);
  });

  it('切换时先 exit 旧场景再 enter 新场景', () => {
    const sm = new SceneManager();
    const a = fakeScene('start');
    const b = fakeScene('camp');
    sm.change(a);
    sm.change(b);
    expect(a.exit).toHaveBeenCalledTimes(1);
    expect(b.enter).toHaveBeenCalledTimes(1);
    expect(sm.active).toBe(b);
  });

  it('update/render 转发给当前场景', () => {
    const sm = new SceneManager();
    const a = fakeScene('camp');
    sm.change(a);
    sm.update(0.16);
    sm.render(rc);
    expect(a.update).toHaveBeenCalledWith(0.16);
    expect(a.render).toHaveBeenCalledWith(rc);
  });

  it('无活动场景时 update/render 安全', () => {
    const sm = new SceneManager();
    expect(() => {
      sm.update(0.1);
      sm.render(rc);
    }).not.toThrow();
  });
});
