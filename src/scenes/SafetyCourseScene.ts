import type { GameServices, RenderContext, Scene } from '../core/types';
import { SAFETY_CHAPTERS, type SafetyChapter, type QuizChoice } from '../state/safetyChapters';
import { drawPaper } from '../render/handdrawn';
import { el } from '../ui/dom';

type Mode = 'overview' | 'read' | 'quiz';

/**
 * 安全小课堂 —— 8 个户外安全知识章节的阅读 + 测验。
 * 每章答对 → 解锁一枚安全徽章。
 * 完成后可继续进入「简易担架」游戏。
 */
export class SafetyCourseScene implements Scene {
  readonly id = 'safetyCourse' as const;

  private mode: Mode = 'overview';
  private activeChapter: SafetyChapter | null = null;
  private panel: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private lastBadgeId: string | null = null;

  constructor(private services: GameServices) {}

  enter(): void {
    this.unsub = this.services.input.onPress((k) => {
      if (k === 'action' || k === 'confirm') this.onAction();
    });
    this.showOverview();
  }

  exit(): void {
    this.panel?.remove();
    this.panel = null;
    this.unsub?.();
    this.unsub = null;
  }

  update(): void {
    /* 静态 DOM 场景，无需更新 */
  }

  /** 任意空白/按钮处点击也触发"下一动作" */
  onPointer(): void {
    this.onAction();
  }

  private onAction(): void {
    this.services.audio.play('click');
    if (this.mode === 'overview') return; // overview 需要专门点章节
    if (this.mode === 'read') this.showQuiz();
    if (this.mode === 'quiz' && this.lastBadgeId) {
      // 已经答对了（lastBadgeId 有值），点一下返回总览
      this.lastBadgeId = null;
      this.showOverview();
    }
  }

  private clearPanel(): void {
    this.panel?.remove();
    this.panel = null;
  }

  private showOverview(): void {
    this.mode = 'overview';
    this.clearPanel();
    const s = this.services;
    const panel = el('div', { class: 'panel safety-overview' });
    panel.append(
      el('div', { class: 'panel-title', text: '🏫 安全小课堂' }),
      el('div', {
        class: 'panel-sub',
        text: `已解锁 ${s.save.safetyBadgeCount()} / ${SAFETY_CHAPTERS.length} 枚安全徽章`,
      }),
    );

    const grid = el('div', { class: 'chapter-grid' });
    SAFETY_CHAPTERS.forEach((ch, i) => {
      const completed = this.services.save.chapterCompleted(ch.id);
      const unlocked = this.services.save.badgeUnlocked(ch.badgeId);
      const locked = i > 0 && !this.services.save.chapterCompleted(SAFETY_CHAPTERS[i - 1].id);
      const cell = el(
        'div',
        {
          class:
            'chapter-card' +
            (completed ? ' completed' : '') +
            (locked ? ' locked' : '') +
            (unlocked ? ' unlocked' : ''),
        },
        [
          el('div', { class: 'emoji', text: locked ? '🔒' : ch.emoji }),
          el('div', { class: 'name', text: ch.title }),
          el('div', { class: 'game', text: completed ? '✅ 已解锁徽章' : locked ? '先完成上一章' : ch.subtitle }),
        ],
      );
      if (!completed && !locked) {
        cell.addEventListener('click', () => {
          this.services.audio.play('click');
          this.openChapter(ch);
        });
      } else if (completed) {
        cell.addEventListener('click', () => {
          this.services.audio.play('click');
          this.openChapter(ch);
        });
      }
      grid.append(cell);
    });
    panel.append(grid);

    // 返回营地板 + CTA：进入担架游戏
    const back = el('button', { class: 'hand-btn top-left-back', text: '← 返回营地' });
    back.addEventListener('click', () => this.services.nav.goCamp());
    panel.append(back);

    // 已经完成全部章节时，显示进入担架游戏的按钮
    if (s.save.safetyChapterCompletedCount() >= SAFETY_CHAPTERS.length) {
      const cta = el('button', { class: 'hand-btn cta', text: '🎮 已学完！出发挑战简易担架 →' });
      cta.addEventListener('click', () => this.services.nav.startGame('stretcher'));
      panel.append(cta);
    }

    s.uiLayer.append(panel);
    this.panel = panel;
  }

  private openChapter(ch: SafetyChapter): void {
    this.activeChapter = ch;
    this.showRead();
  }

  private showRead(): void {
    this.mode = 'read';
    this.lastBadgeId = null;
    this.clearPanel();
    const s = this.services;
    const ch = this.activeChapter!;
    const panel = el('div', { class: 'panel reading-panel' });
    panel.append(
      el('div', { class: 'chapter-emoji', text: ch.emoji }),
      el('div', { class: 'panel-title', text: ch.title }),
      el('div', { class: 'panel-sub', text: ch.subtitle }),
    );

    // PPT 幻灯片轮播
    if (ch.slides.length > 0) {
      const slideshow = this.buildSlideshow(ch);
      panel.append(slideshow);
    }

    // 文字补充阅读
    const body = el('div', { class: 'chapter-body' });
    ch.body.forEach((p) => body.append(el('p', { text: p })));
    panel.append(body);

    const back = el('button', { class: 'hand-btn top-left-back', text: '← 章节列表' });
    back.addEventListener('click', () => this.showOverview());
    panel.append(back);

    if (s.save.chapterCompleted(ch.id)) {
      panel.append(el('div', { class: 'badge-earned', text: '✅ 已解锁徽章 · 可重玩答题' }));
    }
    const goQuiz = el('button', { class: 'hand-btn cta', text: s.save.chapterCompleted(ch.id) ? '↻ 再测一次' : '✏️ 前往测验 →' });
    goQuiz.addEventListener('click', () => {
      s.audio.play('click');
      this.showQuiz();
    });
    panel.append(goQuiz);

    s.uiLayer.append(panel);
    this.panel = panel;
  }

  /** 构建 PPT 幻灯片轮播（可左右滑动翻页） */
  /** PPT 幻灯片轮播（按钮 / 圆点 / 左右滑动均可换页） */
  private buildSlideshow(ch: SafetyChapter): HTMLElement {
    const root = el('div', { class: 'slideshow' });
    const total = ch.slides.length;
    let idx = 0;

    const stage = el('div', { class: 'slide-stage' });
    const img = document.createElement('img');
    img.className = 'slide-img';
    img.alt = ch.title;
    img.loading = 'lazy';
    stage.append(img);

    const counter = el('div', { class: 'slide-counter' });
    counter.style.display = total > 1 ? '' : 'none';

    const dots = el('div', { class: 'slide-dots' });
    ch.slides.forEach((_, i) => {
      const dot = el('span', { class: 'dot' });
      dot.addEventListener('click', () => go(i));
      dots.append(dot);
    });

    const render = () => {
      img.src = ch.slides[idx];
      counter.textContent = `${idx + 1} / ${total}`;
      Array.from(dots.children).forEach((d, i) => {
        (d as HTMLElement).classList.toggle('active', i === idx);
      });
    };
    const go = (i: number) => {
      idx = (i + total) % total;
      render();
    };

    const prevBtn = el('button', { class: 'slide-nav slide-prev', text: '‹' });
    prevBtn.addEventListener('click', () => go(idx - 1));
    const nextBtn = el('button', { class: 'slide-nav slide-next', text: '›' });
    nextBtn.addEventListener('click', () => go(idx + 1));

    // 指针滑动
    let pointerStartX = 0;
    stage.addEventListener('pointerdown', (e) => {
      pointerStartX = e.clientX;
    });
    stage.addEventListener('pointerup', (e) => {
      const dx = e.clientX - pointerStartX;
      if (dx < -40) go(idx + 1);
      else if (dx > 40) go(idx - 1);
    });

    root.append(prevBtn, stage, nextBtn, counter, dots);
    render();
    return root;
  }

  private showQuiz(): void {
    this.mode = 'quiz';
    this.clearPanel();
    const s = this.services;
    const ch = this.activeChapter!;
    const panel = el('div', { class: 'panel safety-overview' });
    panel.append(
      el('div', { class: 'panel-title', text: '📝 小测验' }),
      el('div', { class: 'panel-sub', text: ch.title }),
      el('div', { class: 'quiz-question', text: ch.quiz.question }),
    );

    const choices = el('div', { class: 'quiz-choices' });
    const feedback = el('div', { class: 'quiz-feedback' });
    let answered = false;

    const handleAnswer = (key: QuizChoice) => {
      if (answered) return;
      answered = true;
      this.services.audio.play(key.key === ch.quiz.answer ? 'success' : 'fail');
      if (key.key === ch.quiz.answer) {
        s.save.completeChapter(ch.id);
        s.save.unlockBadge(ch.badgeId);
        this.lastBadgeId = ch.badgeId;
        feedback.innerHTML = `<span class="correct">✅ 答对啦！获得徽章 · ${ch.emoji}</span>`;
        feedback.style.display = '';
        panel.append(
          el('div', {
            class: 'quiz-badge-unlocked',
            text: `${ch.emoji} 徽章解锁：${s.save.safetyBadgeCount()} / ${SAFETY_CHAPTERS.length}`,
          }),
        );
        const cont = el('button', { class: 'hand-btn cta', text: '继续 →' });
        cont.addEventListener('click', () => {
          s.audio.play('click');
          this.lastBadgeId = null;
          this.showOverview();
        });
        panel.append(cont);
      } else {
        feedback.innerHTML = `<span class="wrong">❌ ${ch.quiz.hint}</span>`;
        feedback.style.display = '';
        const retry = el('button', { class: 'hand-btn cta', text: '🔁 再来一次' });
        retry.addEventListener('click', () => {
          s.audio.play('click');
          this.showQuiz();
        });
        panel.append(retry);
      }
    };

    ch.quiz.choices.forEach((c) => {
      const btn = el('button', { class: 'quiz-choice', text: `${c.key}. ${c.text}` });
      btn.addEventListener('click', () => handleAnswer(c));
      choices.append(btn);
    });
    panel.append(choices);
    feedback.style.display = 'none';
    panel.append(feedback);

    const back = el('button', { class: 'hand-btn top-left-back', text: '← 返回阅读' });
    back.addEventListener('click', () => this.showRead());
    panel.append(back);

    s.uiLayer.append(panel);
    this.panel = panel;
  }

  render(r: RenderContext): void {
    drawPaper(r.ctx, r.width, r.height);
  }
}
