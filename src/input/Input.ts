import type { BindAction, Keybinds } from '../meta/Save';

/**
 * PC input: rebindable keyboard movement, pause, camera zoom (mouse wheel or keys) and the
 * big-map toggle, plus an optional gamepad. Produces a world-space direction where
 * screen-up maps to -z.
 */
export class Input {
  x = 0;
  z = 0;
  private keys = new Set<string>();
  enabled = false;
  binds: Keybinds;
  onPause: (() => void) | null = null;
  /** +1 zoom out, -1 zoom in. */
  onZoom: ((dir: number) => void) | null = null;
  onMap: (() => void) | null = null;
  /** Developer hotkeys; returns true when developer mode handled the key. */
  onDev: ((action: 'devPanel' | 'devDebug' | 'devGod') => boolean) | null = null;
  /** Fired when the player first moves (used by the controls hint). */
  onFirstMove: (() => void) | null = null;
  /** While set, the next key press is captured for rebinding instead of played. */
  capture: ((code: string) => void) | null = null;
  private padPause = false;

  constructor(area: HTMLElement, binds: Keybinds) {
    this.binds = binds;
    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        const f = this.capture;
        this.capture = null;
        f(e.code);
        return;
      }
      if (e.code === 'Tab' && this.enabled) e.preventDefault();
      // typing into a text field (developer panel) never drives the game
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA')) return;
      for (const a of ['devPanel', 'devDebug', 'devGod'] as const) {
        if (this.is(a, e.code) && !e.repeat && this.onDev?.(a)) {
          e.preventDefault();
          return;
        }
      }
      if (e.repeat) return;
      // Escape always pauses, whatever the bindings say
      if (e.code === 'Escape' || this.is('pause', e.code)) {
        this.onPause?.();
        return;
      }
      if (this.enabled) {
        if (this.is('zoomIn', e.code)) this.onZoom?.(-1);
        else if (this.is('zoomOut', e.code)) this.onZoom?.(1);
        else if (this.is('map', e.code)) this.onMap?.();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    area.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 0.5) this.onZoom?.(Math.sign(e.deltaY));
      },
      { passive: false },
    );
    // no context menu over the game view
    area.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private is(action: BindAction, code: string): boolean {
    return this.binds[action]?.includes(code) ?? false;
  }

  private held(action: BindAction): boolean {
    for (const c of this.binds[action] ?? []) if (this.keys.has(c)) return true;
    return false;
  }

  update(): [number, number] {
    let x = 0;
    let z = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (this.held('up')) z -= 1;
    if (this.held('down')) z += 1;
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) {
        x += ax;
        z += ay;
      }
      if (gp.buttons[9]?.pressed && !this.padPause) {
        this.padPause = true;
        if (this.enabled) this.onPause?.();
      } else if (!gp.buttons[9]?.pressed) this.padPause = false;
    }
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    if (!this.enabled) x = z = 0;
    if ((x || z) && this.onFirstMove) {
      const f = this.onFirstMove;
      this.onFirstMove = null;
      f();
    }
    this.x = x;
    this.z = z;
    return [x, z];
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.keys.clear();
  }
}

/** Human-readable key name for a KeyboardEvent.code. */
export function keyName(code: string): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Space: 'Space', Equal: '=', Minus: '-',
    NumpadAdd: 'Num +', NumpadSubtract: 'Num -', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', Enter: 'Enter', Backquote: '`', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', CapsLock: 'Caps',
  };
  return map[code] ?? code.replace('Numpad', 'Num ');
}
