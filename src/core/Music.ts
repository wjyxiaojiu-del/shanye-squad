// ============================================================
// 背景音乐播放器 —— 循环播放项目内置 mp3
// ============================================================
//
// 浏览器要求媒体播放通常发生在用户手势之后。GameAudio.unlock() 仍负责
// 统一处理音频解锁流程,这里复用原有 MusicPlayer API 以免影响 HUD/场景调用。

import musicUrl from '../assets/audio/mermaid-bay-bgm.mp3';

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private _on = false;
  private _volume = 0.35;

  get on(): boolean {
    return this._on;
  }
  get volume(): number {
    return this._volume;
  }

  bind(_ctx: AudioContext): void {
    this.ensureAudio();
  }

  toggle(): boolean {
    this._on ? this.stop() : this.start();
    return this._on;
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.audio) this.audio.volume = this._volume;
  }

  start(): void {
    const audio = this.ensureAudio();
    if (!audio || this._on) return;

    audio.volume = this._volume;
    this._on = true;

    const playResult = audio.play();
    if (playResult) {
      playResult.catch(() => {
        if (!this._on) return;
        this._on = false;
      });
    }
  }

  stop(): void {
    if (!this._on) return;
    this._on = false;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (this.audio) return this.audio;
    if (typeof Audio === 'undefined') return null;

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this._volume;
    this.audio = audio;
    return audio;
  }
}
