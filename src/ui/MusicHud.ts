// ============================================================
// 通用音乐控制 HUD —— 挂到营地/开始/房间等场景的右上角
// ============================================================
//
// 背景音乐开关 + 音量视觉计量。置于游戏内任意场景右上角,自动避让刘海。
// 设计:两个紧邻小按钮 [♪] [🔊]。
//   ♪:切换开/停(绿=播放,灰=静音)
//   🔊:循环切换音量(0 → 0.35 → 0.6 → 0.9)

import type { AudioApi } from '../core/Audio';

export class MusicHud {
  readonly root: HTMLElement;
  private btn: HTMLButtonElement;
  private vol: HTMLSpanElement;
  private audio: AudioApi;

  constructor(audio: AudioApi) {
    this.audio = audio;

    this.root = document.createElement('div');
    this.root.className = 'music-hud';

    this.btn = document.createElement('button');
    this.btn.className = 'music-hud-btn';
    this.btn.setAttribute('aria-label', '背景音乐开关');
    this.btn.addEventListener('click', () => this.toggle());

    this.vol = document.createElement('span');
    this.vol.className = 'music-hud-vol';

    this.root.append(this.btn, this.vol);
    this.refresh();
  }

  private toggle(): void {
    this.audio.toggleMusic();
    this.refresh();
  }

  /** 视觉同步 muted/musicOn/volume */
  refresh(): void {
    const on = this.audio.musicOn;
    this.btn.textContent = '♪';
    this.btn.classList.toggle('on', on);
    // 音量 4 段指示(静音 ░ / 小 ▒ / 中 ▓ / 大 █)
    const v = this.audio.musicVolume;
    const bars = v < 0.05 ? 0 : v < 0.4 ? 1 : v < 0.65 ? 2 : 3;
    this.vol.className = 'music-hud-vol';
    this.vol.setAttribute('data-v', String(bars));
    this.vol.textContent = ['░', '▒', '▓', '█'][bars];
  }

  startIfAllowed(): void {
    // 先 unlock AudioContext(幂等:已 unlock 不会重建),再启背景音乐
    this.audio.unlock();
    if (this.audio.muted) return;
    this.audio.startMusic();
    this.refresh();
  }

  attach(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }
}
