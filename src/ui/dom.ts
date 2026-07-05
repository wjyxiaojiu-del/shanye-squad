// 极简 DOM 构建工具（UI 叠层用）

type ElOpts = {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOpts = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.style) Object.assign(node.style, opts.style);
  for (const c of children) node.append(c);
  return node;
}

/** 清空一个容器的所有子节点 */
export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}
