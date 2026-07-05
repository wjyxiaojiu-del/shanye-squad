// ============================================================
// 全屏切换工具 —— 隐藏移动浏览器地址栏 / 底部导航
// ============================================================
//
// 兼容:
// - 标准 Fullscreen API (Chrome/新版 Safari/桌面 webkitRequestFullscreen)
// - iOS Safari 只支持 webkitRequestFullscreen(<video>),不支持元素全屏,
//   所以给用户一个提示:加到桌面(PWA)才是真全屏。

const doc = document as unknown as {
  fullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
};

const root = document.documentElement as unknown as HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
};

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    doc.webkitFullscreenElement ||
    // iOS 上添加到桌面(PWA)后以全屏模式运行,视口高度 ≈ 屏幕高度
    window.innerHeight === window.screen.height
  );
}

/** 切换全屏；iOS Safari 不支持元素全屏时返回 false 由调用方兜底 */
export function toggleFullscreen(): boolean {
  if (isFullscreen()) {
    void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    return true;
  }
  void (root.requestFullscreen?.()?.catch?.(() => undefined) ??
    root.webkitRequestFullscreen?.());
  // 标准 API 调用成功也会走到这里(返回 true);iOS 静默失败也返回 true,
  // 调用方用 isFullscreen() 复查决定要不要弹提示
  return true;
}

/** iOS Safari:生成"添加到主屏幕"引导文案 */
export function iosPwaHint(): string {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS && isSafari && !window.matchMedia('(display-mode: standalone)').matches) {
    return '📲 iPhone 想全屏:点 Safari 底部「分享」→「添加到主屏幕」,再从桌面图标打开';
  }
  return '';
}

/** 是否 iOS Safari 且未加桌面(这类设备 Fullscreen API 调不通) */
export function isIOSSafariNotStandalone(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return !!(isIOS && isSafari && !window.matchMedia('(display-mode: standalone)').matches);
}
