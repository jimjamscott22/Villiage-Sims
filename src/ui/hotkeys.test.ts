import { describe, expect, it } from 'vitest';
import { isHotkeyBlocked, isTypingTarget } from './hotkeys';

describe('hotkey guard', () => {
  it('treats inputs, textareas, selects and contenteditable as typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('blocks hotkeys while typing or while a modal is open', () => {
    expect(isHotkeyBlocked({ tagName: 'INPUT' }, false)).toBe(true);
    expect(isHotkeyBlocked({ tagName: 'BODY' }, true)).toBe(true);
    expect(isHotkeyBlocked({ tagName: 'BODY' }, false)).toBe(false);
  });
});
