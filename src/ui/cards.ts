import type { Section, Sticker } from '../core/types';
import type { ScoreResult } from '../scoring/logic';
import { el } from './dom';

/**
 * 成功卡片 —— 小游戏通关后弹出，展示获得的贴纸与评级。
 * 点击"返回营地"触发 onClose。
 */
export function showSuccessCard(
  parent: HTMLElement,
  sticker: Sticker,
  result: ScoreResult,
  onClose: () => void,
): void {
  const backdrop = el('div', { class: 'card-backdrop' });
  const card = el('div', { class: 'success-card' });
  const btn = el('button', { class: 'hand-btn', text: '返回营地 →' });

  card.append(
    el('div', { class: 'emoji', text: sticker.emoji }),
    el('div', { class: 'title', text: '挑战成功！' }),
    el('div', { class: 'sticker-name', text: `获得贴纸 · ${sticker.name}` }),
    el('div', { class: 'stars', text: '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) }),
    el('div', { class: 'desc', text: '已收进「活动图鉴」' }),
    btn,
  );
  backdrop.append(card);
  parent.append(backdrop);

  const close = () => {
    backdrop.remove();
    onClose();
  };
  btn.addEventListener('click', close);
}

/**
 * "敬请期待"卡片 —— 未实现的板块木牌进入时弹出。
 */
export function showComingSoonCard(
  parent: HTMLElement,
  section: Section,
  onClose: () => void,
): void {
  const backdrop = el('div', { class: 'card-backdrop' });
  const card = el('div', { class: 'success-card' });
  const btn = el('button', { class: 'hand-btn', text: '好的 →' });

  card.append(
    el('div', { class: 'emoji', text: '🚧' }),
    el('div', { class: 'title', text: section.title }),
    el('div', { class: 'sticker-name', text: `「${section.gameTitle}」` }),
    el('div', { class: 'desc', text: '这个营地还在搭建中，敬请期待！' }),
    btn,
  );
  backdrop.append(card);
  parent.append(backdrop);

  const close = () => {
    backdrop.remove();
    onClose();
  };
  btn.addEventListener('click', close);
}

/**
 * 通用"返回营地"按钮（左上角）+ 防误触确认弹窗。
 * 返回一个 cleanup 函数，场景 exit 时调用以移除按钮和可能残留的弹窗。
 */
export function mountBackButton(parent: HTMLElement, onConfirm: () => void): () => void {
  const btn = el('button', { class: 'hand-btn back-btn', text: '↩ 返回营地' });
  parent.append(btn);

  let dialog: HTMLElement | null = null;
  const closeDialog = () => {
    dialog?.remove();
    dialog = null;
  };

  btn.addEventListener('click', () => {
    if (dialog) return;
    const backdrop = el('div', { class: 'card-backdrop' });
    const card = el('div', { class: 'success-card' });
    const yes = el('button', { class: 'hand-btn', text: '返回营地' });
    const no = el('button', { class: 'hand-btn ghost', text: '继续游戏' });
    card.append(
      el('div', { class: 'emoji', text: '🏕️' }),
      el('div', { class: 'title', text: '离开这个挑战？' }),
      el('div', { class: 'desc', text: '当前进度不会保存哦' }),
      el('div', { class: 'btn-row' }, [no, yes]),
    );
    backdrop.append(card);
    parent.append(backdrop);
    dialog = backdrop;

    no.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeDialog(); // 点空白取消
    });
    yes.addEventListener('click', () => {
      closeDialog();
      onConfirm();
    });
  });

  return () => {
    closeDialog();
    btn.remove();
  };
}
