const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Duck-typed so it is testable in Node (no `HTMLElement`). */
export function isTypingTarget(target: unknown): boolean {
  if (target == null || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return (
    element.isContentEditable === true ||
    (typeof element.tagName === 'string' && TYPING_TAGS.includes(element.tagName))
  );
}

export function isHotkeyBlocked(target: unknown, modalOpen: boolean): boolean {
  return modalOpen || isTypingTarget(target);
}

/** Global game hotkeys must not fire while typing or behind a modal dialog. */
export function shouldIgnoreHotkey(event: KeyboardEvent): boolean {
  return isHotkeyBlocked(event.target, document.querySelector('[aria-modal="true"]') !== null);
}
