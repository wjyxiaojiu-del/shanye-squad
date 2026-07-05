// ============================================================
// 房间互动 DOM 叠层（睡觉 / 应急厨房）
// ============================================================

import { el } from '../ui/dom';

import { STEPS, gradeStep, calcResult, clampFire, type CookingStep, type Grade } from './miniCooking';

export interface RoomOverlayOptions {
  uiLayer: HTMLElement;
  audio: { play(name: string): void };
  /** 睡觉恢复回调 */
  onRest?: () => void;
  /** 睡前当前体力（用于恢复条起点动画，缺省 10） */
  fromStamina?: number;
  /** 烹饪完成回调（返回实际恢复的体力值） */
  onCookFinish?: (restored: number) => void;
}

function dismiss(overlay: HTMLElement): void {
  overlay.style.transition = 'opacity 0.4s ease';
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 400);
}

/** 睡觉动画：Zzz + 星火粒子 + 体力恢复 */
export function showSleepOverlay(opts: RoomOverlayOptions): void {
  const { uiLayer, audio, onRest } = opts;
  const startPct = Math.max(0, Math.min(100, opts.fromStamina ?? 10));
  const overlay = el('div', { class: 'room-overlay' });

  const scene = el('div', { class: 'sleep-scene' });

  // 床+小人区域
  const bed = el('div', { class: 'sleep-bed' });
  bed.innerHTML = `
    <div class="sleep-sky">
      <span class="sleep-moon"></span>
      <span class="sleep-star s1">✦</span>
      <span class="sleep-star s2">✧</span>
      <span class="sleep-star s3">⭐</span>
      <span class="sleep-star s4">✦</span>
      <span class="sleep-star s5">✧</span>
      <span class="sleep-star s6">·</span>
    </div>
    <div class="sleep-tent"></div>
    <span class="sleep-ember e1"></span>
    <span class="sleep-ember e2"></span>
    <span class="sleep-ember e3"></span>
    <div class="sleep-person">😴</div>
    <div class="sleep-bag">🛏️</div>
    <span class="sleep-z">Z</span>
    <span class="sleep-z z2">z</span>
    <span class="sleep-z z3">z</span>
  `;
  scene.append(bed);

  // 体力恢复条
  const staminaBar = el('div', { class: 'stamina-track' });
  const staminaFill = el('div', { class: 'stamina-fill' });
  staminaFill.style.height = `${startPct}%`;
  staminaBar.append(staminaFill);
  const staminaNum = el('div', { class: 'stamina-num', text: `体力 ${startPct}` });
  scene.append(staminaBar);
  scene.append(staminaNum);

  // 醒来提示
  const wake = el('div', { class: 'sleep-wake', text: '小九钻进睡袋，进入梦乡...' });
  scene.append(wake);

  overlay.append(scene);
  uiLayer.append(overlay);

  // 播放困意 sfx
  audio.play('step');

  // 睡觉 4s：体力从当前值涨到满，星月渐亮
  const fill = staminaFill;
  let ticks = 0;
  const iv = setInterval(() => {
    ticks += 1;
    const pct = Math.min(100, Math.round(startPct + ((100 - startPct) * ticks) / 40));
    fill.style.height = `${pct}%`;
    staminaNum.textContent = `体力 ${pct}`;
    if (ticks === 15) wake.textContent = '鼾声如雷... Zzz';
    if (ticks >= 40) {
      clearInterval(iv);
      finish();
    }
  }, 100);

  function finish() {
    audio.play('success');
    wake.style.display = 'none';
    const card = el('div', { class: 'sleep-card' });
    card.innerHTML = `
      <div class="emoji">💪</div>
      <div class="title">睡得好香！</div>
      <div class="desc">体力恢复满啦！明天的冒险储备就绪</div>
      <button class="hand-btn">起床探险 →</button>
    `;
    card.querySelector('button')!.addEventListener('click', () => {
      audio.play('click');
      if (onRest) onRest();
      dismiss(overlay);
    });
    (overlay as HTMLElement).querySelector('.sleep-scene')!.append(card);
  }
}

/** 应急厨房：迷你烹饪小游戏（玩家主动控火） */
export function showCookingOverlay(opts: RoomOverlayOptions): void {
  const { uiLayer, audio, onCookFinish } = opts;

  // 每步目标火候区间（与 miniCooking 判定一致）
  const TARGETS: Record<CookingStep, [number, number]> = {
    stirFire: [30, 70],
    flip: [40, 75],
    simmer: [15, 45],
    serve: [0, 25],
  };
  const heatName = (id: CookingStep): string => {
    const [lo, hi] = TARGETS[id];
    const mid = (lo + hi) / 2;
    return mid >= 55 ? '中大火' : mid >= 40 ? '中火' : mid >= 25 ? '小火' : '微火';
  };

  let stepIdx = 0;
  let fireLevel = 35; // 起始中低火，靠玩家控制
  let grades: Grade[] = [];
  let playing = true;
  let holding = false; // 是否正按住"加火"
  let curLo = 30;
  let curHi = 70;

  // ---- build UI ----
  const overlay = el('div', { class: 'room-overlay cook-overlay' });
  const panel = el('div', { class: 'cook-panel' });
  panel.append(el('div', { class: 'cook-title', text: '🍳 小九的应急厨房' }));

  // 常驻操作说明
  const howto = el('div', {
    class: 'cook-howto',
    text: '按住 🔥 加火，把火苗调进绿色区间，再点下方按钮完成这一步',
  });
  panel.append(howto);

  // 当前步骤提示 + 火候要求
  const stepLabel = el('div', { class: 'cook-step-label' });
  const stepReq = el('div', { class: 'cook-req' });
  const stepAction = el('button', { class: 'cook-step-action' });

  // 火力条
  const fireTrack = el('div', { class: 'fire-track' });
  const fireFill = el('div', { class: 'fire-fill' });
  const greenZone = el('div', { class: 'fire-green-zone' });
  fireTrack.append(greenZone, fireFill);
  const firePct = el('div', { class: 'fire-pct' });

  // 按住加火按钮
  const fireBtn = el('button', { class: 'cook-fire-btn', text: '🔥 按住加火' });

  panel.append(stepLabel, stepReq, fireTrack, firePct, fireBtn, stepAction);

  // 进度点
  const dots = el('div', { class: 'cook-dots' });
  STEPS.forEach(() => dots.append(el('span', { class: 'cook-dot' })));
  panel.append(dots);

  // 日志/结果
  const logEl = el('div', { class: 'cook-log' });
  panel.append(logEl);

  overlay.append(panel);
  uiLayer.append(overlay);

  const renderFire = () => {
    fireFill.style.width = `${fireLevel}%`;
    const inZone = fireLevel >= curLo && fireLevel <= curHi;
    fireTrack.classList.toggle('in-zone', inZone);
    firePct.textContent = inZone
      ? `${Math.round(fireLevel)}% · 🎯 就是现在！`
      : `${Math.round(fireLevel)}%`;
    // 颜色：达标绿 / 太小蓝 / 太大红 / 普通橙
    if (inZone) fireFill.style.background = '#7A8B6F';
    else if (fireLevel < 15) fireFill.style.background = '#6BA0B5';
    else if (fireLevel > 80) fireFill.style.background = '#B0574A';
    else fireFill.style.background = '#C1786A';
  };

  const updateStep = () => {
    const step = STEPS[stepIdx];
    stepLabel.textContent = `第 ${stepIdx + 1} / ${STEPS.length} 步：${step.label}`;
    stepAction.innerHTML = `${step.icon} ${step.label}`;
    const [lo, hi] = TARGETS[step.id];
    curLo = lo;
    curHi = hi;
    stepReq.textContent = `需要 ${heatName(step.id)}（${lo}–${hi}%）`;
    greenZone.style.left = `${lo}%`;
    greenZone.style.width = `${hi - lo}%`;
    Array.from(dots.children).forEach((d, i) => {
      const dd = d as HTMLElement;
      dd.classList.toggle('done', i < stepIdx);
      dd.classList.toggle('active', i === stepIdx);
    });
    renderFire();
  };

  stepAction.addEventListener('click', () => {
    if (!playing) return;
    const step = STEPS[stepIdx];
    const g = gradeStep(step.id, Math.round(fireLevel));
    grades.push(g);
    audio.play(g === 'miss' ? 'fail' : 'success');
    logEl.innerHTML += `<span class="grade-${g}">${step.icon} ${gradeLabel(g)}</span> `;
    stepIdx += 1;
    if (g === 'miss' || stepIdx >= STEPS.length) {
      playing = false;
      FIRE_LOOP_ID && clearInterval(FIRE_LOOP_ID);
      showResult();
      return;
    }
    updateStep();
  });

  // ---- 按住加火 / 松开回落 ----
  const startHold = (e: Event) => {
    e.preventDefault();
    holding = true;
  };
  const endHold = () => {
    holding = false;
  };
  fireBtn.addEventListener('pointerdown', startHold);
  fireBtn.addEventListener('pointerup', endHold);
  fireBtn.addEventListener('pointerleave', endHold);
  fireBtn.addEventListener('pointercancel', endHold);

  // ---- 火力物理：按住上升，松开自然回落 ----
  const RISE = 2.4;
  const FALL = 1.5;
  let FIRE_LOOP_ID: ReturnType<typeof setInterval> | null = setInterval(() => {
    if (!playing) return;
    fireLevel = clampFire(fireLevel + (holding ? RISE : -FALL));
    renderFire();
  }, 55);

  function showResult() {
    const result = calcResult(grades);
    panel.innerHTML = '';
    panel.append(el('div', { class: 'cook-title', text: '🍳 做好啦！' }));

    // 每步评级
    const stepLines = el('div', { class: 'cook-step-results' });
    grades.forEach((g, i) => {
      const line = el('div', { class: 'cook-step-line' });
      line.innerHTML = `${STEPS[i].icon} <span class="grade-${g}">${gradeLabel(g)}</span>`;
      stepLines.append(line);
    });
    panel.append(stepLines);

    // 主信息
    const card = el('div', { class: 'sleep-card' });
    card.innerHTML = `
      <div class="emoji">${result.success ? '🍜' : '💨'}</div>
      <div class="title">${result.success ? '大成功！' : '有点翻车...'}</div>
      <div class="desc">${result.message}</div>
      <div class="desc small">体力恢复 +${result.staminaRestored}</div>
    `;
    panel.append(card);

    const btn = el('button', { class: 'hand-btn', text: result.success ? '吃饱啦！' : '再试一次' });
    btn.addEventListener('click', () => {
      audio.play('click');
      if (onCookFinish && result.success) onCookFinish(result.staminaRestored);
      dismiss(overlay);
      if (!result.success) showCookingOverlay(opts);
    });
    panel.append(btn);
  }

  updateStep();
}

function gradeLabel(g: Grade): string {
  return { perfect: '完美！', good: '不错', ok: '还行', miss: '翻车！' }[g];
}
