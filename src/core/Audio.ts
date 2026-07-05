// ============================================================
// 程序化音效 —— Web Audio 合成，零外部文件
// ============================================================
//
// 用振荡器+增益包络实时合成短音效。浏览器要求音频在用户手势后才能
// 播放，所以首次 pointer/键盘交互时 unlock()。带全局静音开关。

export type SfxName =
  | 'click' // 点击/选择
  | 'success' // 通关
  | 'fail' // 失败/出错
  | 'pickup' // 拾取/清理/放置
  | 'step' // 攀爬/踩点
  | 'splash' // 落水/水花
  | 'whoosh' // 挥动/翻面
  | 'fire' // 点燃
  | 'star'; // 得星

interface Tone {
  freq: number;
  dur: number;
  type: OscillatorType;
  vol?: number;
  /** 频率滑动到的目标（做上/下滑音） */
  glide?: number;
  delay?: number;
}

import { MusicPlayer } from './Music';

// 每种音效 = 一组音（可叠加/序列）
const RECIPES: Record<SfxName, Tone[]> = {
  click: [{ freq: 520, dur: 0.06, type: 'square', vol: 0.18 }],
  step: [{ freq: 300, dur: 0.07, type: 'triangle', vol: 0.16, glide: 380 }],
  pickup: [{ freq: 440, dur: 0.08, type: 'triangle', vol: 0.18, glide: 660 }],
  whoosh: [{ freq: 200, dur: 0.16, type: 'sawtooth', vol: 0.1, glide: 90 }],
  splash: [
    { freq: 340, dur: 0.12, type: 'sawtooth', vol: 0.12, glide: 140 },
    { freq: 700, dur: 0.09, type: 'triangle', vol: 0.08, glide: 300, delay: 0.02 },
  ],
  fire: [
    { freq: 160, dur: 0.3, type: 'sawtooth', vol: 0.12, glide: 240 },
    { freq: 520, dur: 0.18, type: 'triangle', vol: 0.08, glide: 700, delay: 0.05 },
  ],
  fail: [
    { freq: 300, dur: 0.16, type: 'square', vol: 0.16, glide: 150 },
    { freq: 200, dur: 0.2, type: 'square', vol: 0.16, glide: 110, delay: 0.14 },
  ],
  star: [{ freq: 880, dur: 0.12, type: 'triangle', vol: 0.16, glide: 1200 }],
  // 成功：上行三音（do-mi-sol）
  success: [
    { freq: 523, dur: 0.14, type: 'triangle', vol: 0.2 },
    { freq: 659, dur: 0.14, type: 'triangle', vol: 0.2, delay: 0.13 },
    { freq: 784, dur: 0.26, type: 'triangle', vol: 0.22, delay: 0.26 },
  ],
};

export interface AudioApi {
  play(name: SfxName): void;
  unlock(): void;
  toggleMute(): boolean;
  readonly muted: boolean;
  // 背景音乐(mp3 循环播放)
  startMusic(): void;
  stopMusic(): void;
  toggleMusic(): boolean;
  cycleMusicVolume(): number;
  /** 当前音量挡位(0 | 0.35 | 0.6 | 0.9),音乐停时为上一挡残留 */
  readonly musicVolume: number;
  readonly musicOn: boolean;
}

export class GameAudio implements AudioApi {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private music = new MusicPlayer();
  private _volStep = 0.35; // 当前音量挡位:0 | .35 | .6 | .9

  get muted(): boolean {
    return this._muted;
  }
  get musicOn(): boolean {
    return this.music.on;
  }
  get musicVolume(): number {
    return this.music.on ? this._volStep : 0;
  }

  /** 首次用户手势时调用，创建/恢复 AudioContext */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // 把同一 ctx 传给音乐播放器(它自己不会创建新的)
    this.music.bind(this.ctx);
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  startMusic(): void {
    if (this._muted || !this.ctx) return;
    this.music.bind(this.ctx);
    this.music.start();
  }
  stopMusic(): void {
    this.music.stop();
  }
  toggleMusic(): boolean {
    if (this._muted || !this.ctx) return false;
    this.music.bind(this.ctx);
    return this.music.toggle();
  }
  cycleMusicVolume(): number {
    // 音量 4 步循环:静音 → 小 → 中 → 大 → 静音
    const steps = [0, 0.35, 0.6, 0.9];
    const idx = steps.indexOf(this._volStep);
    this._volStep = steps[(idx + 1) % steps.length];
    this.music.setVolume(this._volStep);
    return this._volStep;
  }

  play(name: SfxName): void {
    if (this._muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const tone of RECIPES[name]) {
      this.playTone(tone, now);
    }
  }

  private playTone(t: Tone, startBase: number): void {
    const ctx = this.ctx!;
    const start = startBase + (t.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.glide !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.glide), start + t.dur);
    }
    const vol = t.vol ?? 0.15;
    // 快速起音 + 指数衰减包络（避免爆音）
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

/** 静音降级：音频不可用时用，接口一致 */
export class NullAudio implements AudioApi {
  readonly muted = true;
  readonly musicOn = false;
  readonly musicVolume = 0;
  play(): void {}
  unlock(): void {}
  toggleMute(): boolean {
    return true;
  }
  startMusic(): void {}
  stopMusic(): void {}
  toggleMusic(): boolean {
    return false;
  }
  cycleMusicVolume(): number {
    return 0;
  }
}
