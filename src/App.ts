import { installCursors, setCursor } from './ui/cursor';
import { GameClock } from './game/GameClock';
import { NullFx, type FxSink } from './game/types';
import { Renderer } from './render/Renderer';
import { Input } from './input/Input';
import { audio } from './audio/Audio';
import { Profile } from './meta/Profile';
import { defaultSettings } from './meta/Save';
import { Hud } from './ui/Hud';
import { Inventory } from './ui/Inventory';
import { Menus, type MenuApi } from './ui/Menus';
import { RunModals } from './ui/RunModals';
import { h } from './ui/dom';
import { t, L, setLang } from './i18n';
import { World } from './rpg/World';
import { SPAWN, TEST_MAP, buildTestMap } from './rpg/testMap';
import { cloneGear, type Gear } from './rpg/equipment';
import type { Terrain } from './game/Terrain';

const VERSION = 'v6.0.0';

/** Discrete camera zoom steps for the mouse wheel (camera distance multipliers). */
const ZOOM_STEPS = [0.75, 0.88, 1, 1.15, 1.35];
/** Seconds between automatic saves while playing. */
const AUTOSAVE = 30;

/** Forwards FxSink calls to a target that can be swapped once the renderer exists. */
class ProxyFx implements FxSink {
  target: FxSink = NullFx;
  burst(...a: Parameters<FxSink['burst']>) {
    this.target.burst(...a);
  }
  number(...a: Parameters<FxSink['number']>) {
    this.target.number(...a);
  }
  text(...a: Parameters<FxSink['text']>) {
    this.target.text(...a);
  }
  shake(a: number) {
    this.target.shake(a);
  }
  light(...a: Parameters<FxSink['light']>) {
    this.target.light(...a);
  }
  sound(id: string, v?: number) {
    this.target.sound(id, v);
  }
  vibrate(ms: number) {
    this.target.vibrate(ms);
  }
  emit(...a: Parameters<FxSink['emit']>) {
    this.target.emit(...a);
  }
  level() {
    return this.target.level();
  }
}

type Mode = 'splash' | 'menu' | 'run';

/** Top-level controller: screens, the game loop and saving the played character. */
export class App implements MenuApi {
  readonly profile = new Profile();
  readonly version = VERSION;
  private root: HTMLElement;
  private view: HTMLElement;
  private renderer: Renderer;
  private input: Input;
  private hud: Hud;
  private inventory: Inventory;
  private menus: Menus;
  private modals: RunModals;
  private toasts: HTMLElement;
  /** The training ground being played (null in menus). */
  world: World | null = null;
  private runChar: string | null = null;
  private postVignette: HTMLElement;
  private frameDue = 0;
  private paused = false;
  private mode: Mode = 'splash';
  private last = performance.now();
  private charTime = 0;
  private autosaveT = AUTOSAVE;
  /** The world's 24-hour clock: advanced only while playing, kept in the save. */
  readonly clock: GameClock;
  /** The test map is built once and reused by the menu backdrop and every visit. */
  private terrain: Terrain | null = null;

  constructor(root: HTMLElement) {
    installCursors();
    this.root = root;
    root.classList.add('app');
    const s = this.profile.data.settings;
    setLang(s.lang);
    this.clock = GameClock.fromSave(this.profile.data.clock);
    this.view = h('div.view');
    root.appendChild(this.view);
    this.renderer = new Renderer(this.view, s);
    this.postVignette = h('div.post-vignette.hidden');
    this.view.appendChild(this.postVignette);
    this.input = new Input(this.view, s.keybinds);
    this.input.onPause = () => this.handleEscape();
    this.input.onZoom = (dir) => this.stepZoom(dir);
    this.input.onJump = () => {
      if (this.world && this.mode === 'run' && !this.paused) this.world.player.requestJump();
    };
    this.input.onInventory = () => this.toggleInventory();
    this.hud = new Hud(root);
    this.hud.setVisible(false);
    this.hud.onInventory = () => this.toggleInventory();
    this.hud.onClearTarget = () => this.world?.select(null);
    this.inventory = new Inventory(root);
    this.inventory.onSfx = (id) => this.sfx(id);
    this.inventory.onClose = () => this.toggleInventory(false);
    this.inventory.onChange = (g) => this.setGear(g);
    this.menus = new Menus(root, this);
    this.menus.setVisible(false);
    this.modals = new RunModals(root, this);
    this.toasts = h('div.toasts');
    root.appendChild(this.toasts);
    this.applySettings();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.autoPause();
        this.saveChar();
        audio.suspend(true);
      } else audio.suspend(false);
    });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => this.saveChar());
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && s.displayMode !== 'windowed') {
        s.displayMode = 'windowed';
        this.profile.saveSoon();
      }
    });
    this.showMenuBackdrop();
    this.splash();
    this.schedule();
  }

  // ------------------------------------------------------------------ MenuApi
  sfx(id: string) {
    audio.play(id);
  }

  setMenuShift(v: number) {
    this.renderer.menuShift = v;
  }

  applySettings() {
    const s = this.profile.data.settings;
    audio.setVolumes(s.master, s.sfx, s.music, s.ui, s.ambient);
    this.input.swapMouse = s.swapMouse;
    this.input.invertWheel = s.invertWheel;
    this.root.style.setProperty('--ui-scale', String(s.uiScale));
    const effectsChanged = s.effects !== this.renderer.currentQuality;
    this.renderer.applySettings(s);
    if (effectsChanged && this.mode === 'menu') this.showMenuBackdrop();
    this.renderer.setZoom(s.cameraZoom);
    this.hud.setOptions({ fps: s.showFps });
    this.postVignette.classList.toggle('hidden', !s.postProcessing);
    this.input.binds = s.keybinds;
    this.applyDisplayMode();
  }

  resetSettings() {
    this.profile.data.settings = defaultSettings();
    setLang(this.profile.data.settings.lang);
    this.profile.save();
    this.applySettings();
    if (this.mode === 'menu') this.menus.render();
  }

  private applyDisplayMode() {
    const want = this.profile.data.settings.displayMode !== 'windowed';
    try {
      if (want && !document.fullscreenElement) void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
      else if (!want && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    } catch {
      /* fullscreen unavailable */
    }
  }

  captureKey(cb: (code: string) => void) {
    this.input.capture = cb;
  }

  needsRestart(): boolean {
    return this.renderer.msaa !== (this.profile.data.settings.antiAliasing !== 'off');
  }

  private stepZoom(dir: number) {
    const s = this.profile.data.settings;
    let i = 0;
    for (let k = 0; k < ZOOM_STEPS.length; k++) if (Math.abs(ZOOM_STEPS[k] - s.cameraZoom) < Math.abs(ZOOM_STEPS[i] - s.cameraZoom)) i = k;
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))];
    if (next === s.cameraZoom) return;
    s.cameraZoom = next;
    this.renderer.setZoom(next);
    this.profile.saveSoon();
  }

  private autoPause() {
    if (!this.profile.data.settings.autoPause) return;
    if (this.mode === 'run' && !this.paused) this.togglePause();
  }

  private handleEscape() {
    const confirm = this.root.querySelector('.modal-back.confirm');
    if (confirm) {
      confirm.remove();
      return;
    }
    if (this.mode === 'run') {
      if (this.paused && this.modals.escape()) return;
      if (this.inventory.isOpen) {
        this.toggleInventory(false);
        return;
      }
      this.togglePause();
      return;
    }
    if (this.mode === 'menu' && this.menus.canGoBack) this.menus.back();
  }

  // ------------------------------------------------------------------ inventory
  /** Opens or closes the inventory window (the world keeps running behind it). */
  toggleInventory(force?: boolean) {
    const w = this.world;
    if (!w || this.mode !== 'run' || this.paused) return;
    const open = force ?? !this.inventory.isOpen;
    if (open === this.inventory.isOpen) return;
    const ch = this.currentChar();
    if (open && ch) this.inventory.open(cloneGear(w.gear), w.raceId, ch.name);
    else this.inventory.close();
    this.sfx('ui');
  }

  /** New gear from the inventory: the world (stats, model) and the save follow at once. */
  private setGear(g: Gear) {
    const w = this.world;
    const ch = this.currentChar();
    if (!w || !ch) return;
    w.setGear(cloneGear(g));
    ch.gear = cloneGear(g);
    this.profile.saveSoon();
  }

  private currentChar() {
    return this.runChar ? (this.profile.data.chars.find((c) => c.id === this.runChar) ?? null) : null;
  }

  // ------------------------------------------------------------------ screens
  private splash() {
    this.mode = 'splash';
    const el = h(
      'div.splash',
      h('div.logo', h('div.logo-cubes', h('i'), h('i'), h('i')), h('div.logo-title', 'CUBEBORN'), h('div.logo-sub', t('game_subtitle'))),
      h('div.tap', t('tap_to_start')),
      h('div.splash-foot', t('splash_note')),
    );
    const go = () => {
      if (this.mode !== 'splash') return;
      audio.unlock();
      audio.play('select');
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
      this.toMenu();
    };
    el.addEventListener('pointerup', go, { once: true });
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'splash' && (e.key === 'Enter' || e.key === ' ')) go();
    });
    this.root.appendChild(el);
  }

  private testTerrain(): Terrain {
    return (this.terrain ??= buildTestMap());
  }

  private showMenuBackdrop() {
    this.renderer.showMenu(TEST_MAP, this.testTerrain(), SPAWN.x, SPAWN.z + 3);
  }

  private toMenu() {
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.hud.setVisible(false);
    this.inventory.close();
    this.modals.close();
    this.menus.setVisible(true);
    this.menus.home();
    audio.playMusic('menu');
  }

  // ------------------------------------------------------------------ playing
  /** Enters the training meadow with a saved character (always at the spawn point). */
  play(charId: string) {
    const p = this.profile;
    const ch = p.data.chars.find((c) => c.id === charId);
    if (!ch) return;
    p.selectChar(ch.id);
    this.menus.setVisible(false);
    this.modals.close();
    this.renderer.endRun();
    const fx = new ProxyFx();
    const s = p.data.settings;
    const world = new World(fx, this.clock, ch.race, cloneGear(ch.gear), this.testTerrain());
    this.world = world;
    this.runChar = ch.id;
    this.charTime = 0;
    this.autosaveT = AUTOSAVE;
    fx.target = this.renderer.startRun(world, { sound: (id, v) => audio.play(id, v), vibrate: () => {} });
    this.renderer.setZoom(s.cameraZoom);
    this.paused = false;
    this.hud.reset();
    this.hud.setVisible(true);
    this.input.setEnabled(true);
    this.mode = 'run';
    world.events.on('banner', (key) => this.hud.showBanner(t(key), key === 'dn_dawn' ? '#ffd08a' : '#9ab8ff'));
    audio.playMusic('forest');
    this.hud.showBanner(L(TEST_MAP.name), '#ffffff', 2.2, `${ch.name} · Уровень ${ch.level}`);
    this.hud.showHint(s.showHints && ch.playTime < 60);
    if (s.showHints) this.input.onFirstMove = () => setTimeout(() => this.hud.showHint(false), 6000);
    this.saveChar();
  }

  /** Writes the played character: gear and play time (the clock too). */
  private saveChar(): boolean {
    const w = this.world;
    const ch = this.currentChar();
    if (!w || !ch) return false;
    ch.gear = cloneGear(w.gear);
    ch.playTime += Math.round(w.time - this.charTime);
    this.charTime = Math.round(w.time);
    ch.lastPlayed = Date.now();
    this.profile.data.clock = this.clock.toSave();
    return this.profile.save();
  }

  private togglePause() {
    const w = this.world;
    if (this.mode !== 'run' || !w) return;
    if (this.paused) {
      this.paused = false;
      this.modals.close();
      this.input.setEnabled(true);
      audio.play('ui');
      return;
    }
    this.paused = true;
    this.inventory.close();
    this.input.setEnabled(false);
    audio.play('ui');
    this.modals.pause(w, {
      resume: () => this.togglePause(),
      save: () => this.saveChar(),
      exit: () => this.exitToMenu(),
    });
  }

  private exitToMenu() {
    this.saveChar();
    this.paused = false;
    this.inventory.close();
    this.renderer.endRun();
    this.world = null;
    this.runChar = null;
    this.showMenuBackdrop();
    this.toMenu();
  }

  toast(text: string, color = '#ffffff') {
    const el = h('div.toast', { style: `--tc:${color}` }, text);
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  // ------------------------------------------------------------------ loop
  private channel: MessageChannel | null = null;
  private schedule() {
    const s = this.profile.data.settings;
    if (s.vsync || document.hidden) {
      requestAnimationFrame(this.loop);
      return;
    }
    if (!this.channel) {
      this.channel = new MessageChannel();
      this.channel.port1.onmessage = () => this.loop(performance.now());
    }
    this.channel.port2.postMessage(0);
  }

  /**
   * Mouse controls: left click on a dummy selects it as the target and starts attacking it, left
   * click on the ground walks there; the right button (or the attack key) attacks the target,
   * or toward the cursor without one.
   */
  private readMouse(w: World, active: boolean) {
    const inp = this.input;
    const c = w.ctl;
    const rig = this.renderer.rig;
    const vw = this.view.clientWidth || 1;
    const vh = this.view.clientHeight || 1;
    let hover = null;
    if (inp.mx >= 0) {
      const g = rig.terrainPoint(inp.mx, inp.my, vw, vh, (x, z) => w.terrain.groundY(x, z), 0);
      if (g) {
        c.aimX = g[0];
        c.aimZ = g[1];
      }
      // dummies are tall: test the cursor at a few heights of the body
      for (const lift of [1.2, 0.7, 0.2]) {
        const q = rig.terrainPoint(inp.mx, inp.my, vw, vh, (x, z) => w.terrain.groundY(x, z), lift);
        if (q) hover = w.dummyAt(q[0], q[1], 0.3);
        if (hover) break;
      }
    }
    setCursor(hover ? 'attack' : 'default');
    if (!active) {
      inp.lmbPressed = inp.rmbPressed = false;
      c.attackHeld = false;
      c.moveX = c.moveZ = 0;
      return;
    }
    if (inp.lmbPressed) {
      inp.lmbPressed = false;
      if (hover) w.select(hover, true);
      else c.clickMove = { x: c.aimX, z: c.aimZ };
    }
    if (inp.rmbPressed) {
      inp.rmbPressed = false;
      if (hover) w.select(hover, true);
    }
    c.attackHeld = inp.rmb || inp.held('attack');
    if (inp.held('attack') && w.target) w.autoAttack = true;
  }

  private loop = (now: number) => {
    this.schedule();
    const limit = this.profile.data.settings.fpsLimit;
    if (limit > 0) {
      if (now < this.frameDue - 1) return;
      this.frameDue = Math.max(this.frameDue + 1000 / limit, now);
    } else if (!this.profile.data.settings.vsync && now - this.last < 1) return;
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const dt = Math.min(realDt, 1 / 20);
    const w = this.world;
    if (w && this.mode === 'run') {
      const [sx, sz] = this.input.update();
      const [ix, iz] = this.renderer.rig.screenToWorld(sx, sz);
      const active = !this.paused && !this.modals.isOpen;
      this.readMouse(w, active);
      w.ctl.moveX = active ? ix : 0;
      w.ctl.moveZ = active ? iz : 0;
      const sim = !this.paused && !this.modals.isOpen;
      if (sim) {
        this.clock.advance(realDt);
        const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
        for (let i = 0; i < steps; i++) w.update(dt / steps);
        this.autosaveT -= dt;
        if (this.autosaveT <= 0) {
          this.autosaveT = AUTOSAVE;
          this.saveChar();
        }
      }
      this.renderer.frame(sim ? dt : 0);
      const ch = this.currentChar();
      this.hud.update(w, realDt, ch?.name ?? '', ch?.level ?? 1);
      audio.setAmbience(!this.paused, 0.5, 0, w.dayNight.period === 'night', realDt);
    } else {
      audio.setAmbience(false, 0, 0, false, realDt);
      this.renderer.frame(realDt);
    }
  };
}
