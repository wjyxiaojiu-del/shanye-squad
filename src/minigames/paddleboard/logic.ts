// ============================================================
// 桨板平衡 —— 纯逻辑（无 DOM，便于单元测试）
// ============================================================
//
// 玩法（节奏型）：一块桨板浮在水面上，会被波浪推得左右倾斜。玩家按 ←→
// /触屏左右半屏施加反向力矩来抵消，保持板体在平衡区内。倾斜角度超过
// MAX_TILT 即"落水"失败并立刻自动重开；坚持 TARGET_TIME 秒即通关。
//
// 手感：波浪随时间逐渐变大——初期很稳，后期要越来越频繁地主动调整。
// 永远按倾斜的反方向，推力大于波浪峰值即可稳住。

export interface PaddleState {
  /** 板体倾斜角 (rad)，正值右倾，0 为水平 */
  tilt: number;
  /** 倾斜角速度 (rad/s) */
  tiltVel: number;
  /** 波浪累计相位（驱动倾斜干扰） */
  wavePhase: number;
  /** 已存活时间（秒） */
  timeAlive: number;
  /** 是否已落水 */
  fallen: boolean;
  /** 是否已通关 */
  finished: boolean;
  /** 过程中最大倾斜偏差（绝对值，用于评分） */
  maxDeviation: number;
}

// ---- 平衡手感参数 ----
export const TARGET_TIME = 25; // 坚持多久通关（秒）
export const MAX_TILT = 0.58; // 约 33°，超限即落水
const WAVE_BASE = 0.4; // 基础波幅（随时间增长，单位 rad/s²——直接作为角加速度）
const WAVE_RAMP = 0.03; // 每秒波幅增长（最大约 1.15，远小于 INPUT=4.0）
const INPUT = 4.6; // 玩家角加速度（rad/s²，远大于峰值波——完美操作必定稳住）
const DAMPING = 0.7; // 角速度阻尼（1/s，偏低才能在无操作时累计倾斜翻覆）
// 多频叠加让波浪有节奏变化，更像水面
const WAVE_FREQS = [0.7, 1.9, 3.3];
const WAVE_WEIGHTS = [0.6, 0.3, 0.1];

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function createPaddle(): PaddleState {
  return { tilt: 0, tiltVel: 0, wavePhase: 0, timeAlive: 0, fallen: false, finished: false, maxDeviation: 0 };
}

/** 波浪在当前相位的无量纲力（-1..1，确定性） */
function waveShape(wavePhase: number): number {
  let t = 0;
  for (let i = 0; i < WAVE_FREQS.length; i++) {
    t += WAVE_WEIGHTS[i] * Math.sin(wavePhase * WAVE_FREQS[i]);
  }
  return t; // ∈ [-1, 1]
}

/**
 * 推进一帧。纯函数返回新状态。
 * @param state 当前状态
 * @param dir   玩家输入：-1 左推 / 0 不动 / +1 右推
 * @param dt    秒
 */
export function tickPaddle(state: PaddleState, dir: -1 | 0 | 1, dt: number): PaddleState {
  if (state.fallen || state.finished) return state;

  const wavePhase = state.wavePhase + dt;
  const timeAlive = state.timeAlive + dt;
  const waveAmp = WAVE_BASE * (1 + WAVE_RAMP * timeAlive); // 逐渐变强的波浪
  const wave = waveShape(wavePhase) * waveAmp;

  // 玩家按压力矩：tilt>0（右倾）时按左键产生反向加速度把板拉回水平
  // correcting = +1 表示玩家在按"反向 corrective"（倾斜>0 按左键 dir=-1，or 倾斜<0 按右键 dir=+1）
  const correcting = -sign(state.tilt) * dir; // {+1（按对，提供反向矫正力矩）, 0（未按或平衡）, -1（按错）}
  // 基础角速度阻尼（抵抗 tiltVel，符号始终与 tiltVel 相反）
  const damp = state.tiltVel * DAMPING;
  // 按对方向时提供"角速度刹车"：直接按比例缩减 tiltVel（手感"盯一下即稳"）
  const brakeFactor = correcting > 0 ? 0.78 : 0; // 每帧角速度折减比例

  // 角加速度：波浪 + 玩家反向输入（correcting 为正时产生反向 -INPUT 把倾斜拉回）
  const acc = wave - correcting * INPUT;
  const tiltVel = (state.tiltVel + acc * dt - damp * dt) * (1 - brakeFactor);
  const tilt = state.tilt + tiltVel * dt;

  const maxDeviation = Math.max(state.maxDeviation, Math.abs(tilt));

  // 落水判定
  if (Math.abs(tilt) > MAX_TILT) {
    return { tilt, tiltVel, wavePhase, timeAlive, maxDeviation, fallen: true, finished: false };
  }

  const finished = timeAlive >= TARGET_TIME;
  return { tilt, tiltVel, wavePhase, timeAlive, finished, fallen: false, maxDeviation };
}

export function isFallen(s: PaddleState): boolean {
  return s.fallen;
}

export function isFinished(s: PaddleState): boolean {
  return s.finished;
}

export function correctionDir(s: PaddleState, deadZone = 0.02): -1 | 0 | 1 {
  if (s.tilt > deadZone) return -1;
  if (s.tilt < -deadZone) return 1;
  return 0;
}

/** 表现分 0..1：通关时主要奖励坚持，辅以平衡偏移小加分 */
export function paddlePerformance(s: PaddleState): number {
  if (!s.finished) return 0;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const balance = 1 - clamp01(s.maxDeviation / MAX_TILT);
  // 通关保底 0.65，平衡越好加分越多，最多到 1
  return clamp01(0.65 + 0.4 * balance);
}

/** 0..1 存活进度（用于 HUD） */
export function paddleProgress(s: PaddleState): number {
  return Math.max(0, Math.min(1, s.timeAlive / TARGET_TIME));
}
