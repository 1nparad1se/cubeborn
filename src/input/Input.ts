/**
 * Movement input: floating virtual stick (touch or mouse drag anywhere on the play area),
 * keyboard (WASD / arrows) and gamepad left stick. Produces a world-space direction where
 * screen-up maps to -z.
 */
export class Input {
  x = 0;
  z = 0;
  private keys = new Set<string>();
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private sx = 0;
  private sy = 0;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private radius = 56;
  enabled = false;
  onPause: (() => void) | null = null;
  /** Fired when the player first moves (used by the controls hint). */
  onFirstMove: (() => void) | null = null;

  constructor(area: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    area.appendChild(this.base);

    area.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') {
        if (this.enabled) this.onPause?.();
        return;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.ox = this.sx = e.clientX;
    this.oy = this.sy = e.clientY;
    this.radius = Math.max(44, Math.min(70, Math.min(window.innerWidth, window.innerHeight) * 0.11));
    const size = this.radius * 2;
    this.base.style.width = this.base.style.height = size + 'px';
    this.base.style.left = this.ox - this.radius + 'px';
    this.base.style.top = this.oy - this.radius + 'px';
    this.base.classList.add('on');
    this.updateKnob();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.sx = e.clientX;
    this.sy = e.clientY;
    // drag the base along when the finger goes past the rim (floating stick)
    const dx = this.sx - this.ox;
    const dy = this.sy - this.oy;
    const d = Math.hypot(dx, dy);
    const max = this.radius * 1.25;
    if (d > max) {
      this.ox = this.sx - (dx / d) * max;
      this.oy = this.sy - (dy / d) * max;
      this.base.style.left = this.ox - this.radius + 'px';
      this.base.style.top = this.oy - this.radius + 'px';
    }
    this.updateKnob();
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  };

  private release() {
    this.pointerId = null;
    this.base.classList.remove('on');
  }

  private updateKnob() {
    let dx = this.sx - this.ox;
    let dy = this.sy - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  update(): [number, number] {
    let x = 0;
    let z = 0;
    if (this.pointerId !== null) {
      const dx = this.sx - this.ox;
      const dy = this.sy - this.oy;
      const d = Math.hypot(dx, dy);
      const dead = this.radius * 0.12;
      if (d > dead) {
        const m = Math.min(1, (d - dead) / (this.radius * 0.7));
        x = (dx / d) * m;
        z = (dy / d) * m;
      }
    }
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
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

  private padPause = false;

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.release();
  }
}
