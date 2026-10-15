import { installCursors, setCursor } from './ui/cursor';
import { PROG } from './config/progression';
import { DAY_NIGHT } from './config/dayNight';
import { Run } from './game/Run';
import type { Enemy } from './game/Enemy';
import { NullFx, type FxSink } from './game/types';
import { Renderer } from './render/Renderer';
import { Input, keyName, SLOT_BINDS } from './input/Input';
import { audio } from './audio/Audio';
import { Profile } from './meta/Profile';
import { defaultSettings } from './meta/Save';
import { Hud } from './ui/Hud';
import { Menus, type MenuApi } from './ui/Menus';
import { SkillsScreen } from './ui/SkillsScreen';
import { RunModals } from './ui/RunModals';
import { h } from './ui/dom';
import { t, L, setLang } from './i18n';
import { HERO_BY_ID } from './data/heroes';
import { CREATURES } from './data/bestiary';
import { GREENVALE } from './data/maps';
import { buildMenuGround, RIVER } from './game/map/greenvale';
import { tr } from './ui/ClassPreview';

export const VERSION = 'v5.2.0';

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
  private menus: Menus;
  private modals: RunModals;
  private skills: SkillsScreen;
  private toasts: HTMLElement;
  private run: Run | null = null;
  /** Id of the character being played. */
  private runChar: string | null = null;
  private postVignette: HTMLElement;
  private frameDue = 0;
  private paused = false;
  private mode: Mode = 'splash';
  private last = performance.now();
  /** Run time already added to the character's play time. */
  private charTime = 0;
  private autosaveT = AUTOSAVE;
  private backdropPaused = false;

  constructor(root: HTMLElement) {
    installCursors();
    this.root = root;
    root.classList.add('app');
    const s = this.profile.data.settings;
    setLang(s.lang);
    this.view = h('div.view');
    root.appendChild(this.view);
    this.renderer = new Renderer(this.view, s);
    this.postVignette = h('div.post-vignette.hidden');
    this.view.appendChild(this.postVignette);
    this.input = new Input(this.view, s.keybinds);
    this.input.onPause = () => this.handleEscape();
    this.input.onZoom = (dir) => this.stepZoom(dir);
    this.input.onMap = () => {
      if (this.mode === 'run' && !this.paused) this.hud.toggleMap();
    };
    this.input.onJump = () => {
      if (this.run && this.mode === 'run' && !this.paused && !this.modals.isOpen) this.run.player.requestJump();
    };
    this.hud = new Hud(root);
    this.hud.arpg.onLearn = (i) => this.run?.action.learn(i);
    this.input.onLearn = (i) => this.run?.action.learn(i);
    this.hud.setVisible(false);
    this.menus = new Menus(root, this);
    this.menus.setVisible(false);
    this.modals = new RunModals(root, this);
    this.skills = new SkillsScreen(root);
    this.skills.onSfx = (id) => this.sfx(id);
    this.skills.binds = s.keybinds;
    this.hud.arpg.onSkills = () => this.toggleSkills();
    this.input.onSkills = () => this.toggleSkills();
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
      // leaving fullscreen with the browser's own key: keep the setting honest
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

  setShowcase(modelId: string) {
    this.renderer.setShowcase(modelId);
  }

  setCampfire(members: { id: string; cls: string }[], activeId: string | null) {
    this.renderer.setCampfire(members, activeId);
  }

  campfireAnchors() {
    return this.renderer.campfireAnchors();
  }

  setBackdropPaused(v: boolean) {
    this.backdropPaused = v;
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
    this.hud.setOptions({ minimap: s.showMinimap, fps: s.showFps });
    this.postVignette.classList.toggle('hidden', !s.postProcessing);
    this.input.binds = s.keybinds;
    this.hud.arpg.binds = s.keybinds;
    this.skills.binds = s.keybinds;
    if (this.run) this.run.settings.damageNumbers = s.damageNumbers;
    this.applyDisplayMode();
  }

  resetSettings() {
    this.profile.data.settings = defaultSettings();
    setLang(this.profile.data.settings.lang);
    this.profile.save();
    this.applySettings();
    if (this.mode === 'menu') this.menus.render();
  }

  /** Fullscreen API stand-in for display modes (borderless = fullscreen without browser UI). */
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
      if (this.hud.minimap.big) {
        this.hud.toggleMap();
        return;
      }
      if (this.skills.isOpen) {
        this.skills.close();
        return;
      }
      this.togglePause();
      return;
    }
    if (this.mode === 'menu' && this.menus.canGoBack) this.menus.back();
  }

  /** Skills window (K): learning skills while the world goes on. */
  toggleSkills() {
    const run = this.run;
    if (!run || this.mode !== 'run' || this.paused) return;
    this.skills.toggle(run);
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

  private showMenuBackdrop() {
    const ch = this.profile.char;
    this.renderer.showMenu(GREENVALE, buildMenuGround(GREENVALE), HERO_BY_ID[ch?.cls ?? '']?.model ?? HERO_BY_ID.berserker?.model ?? 'bram');
  }

  private toMenu() {
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.hud.setVisible(false);
    this.modals.close();
    this.menus.setVisible(true);
    this.menus.home();
    audio.playMusic('menu');
  }

  // ------------------------------------------------------------------ playing
  /** Enters the world with a saved character. */
  play(charId: string) {
    const p = this.profile;
    const ch = p.data.chars.find((c) => c.id === charId);
    const hero = ch ? HERO_BY_ID[ch.cls] : null;
    if (!ch || !hero) return;
    p.selectChar(ch.id);
    this.menus.setVisible(false);
    this.modals.close();
    this.skills.close();
    this.renderer.endRun();
    const fx = new ProxyFx();
    const s = p.data.settings;
    const run = new Run({
      map: GREENVALE,
      hero,
      fx,
      settings: { damageNumbers: s.damageNumbers, dayLength: DAY_NIGHT.lengths[s.dayNight] ?? DAY_NIGHT.lengths[DAY_NIGHT.defaultLength] },
      tr: (k) => t(k),
      char: structuredClone(ch),
    });
    this.run = run;
    this.runChar = ch.id;
    this.charTime = 0;
    this.autosaveT = AUTOSAVE;
    this.target = null;
    fx.target = this.renderer.startRun(run, { sound: (id, v) => audio.play(id, v), vibrate: () => {} });
    this.renderer.setZoom(s.cameraZoom);
    this.paused = false;
    this.hud.reset(run);
    this.hud.setVisible(true);
    this.input.setEnabled(true);
    this.mode = 'run';
    run.events.on('banner', (key) => this.hud.showBanner(t(key), key === 'dn_dawn' ? '#ffd08a' : '#9ab8ff'));
    run.events.on('meet', (id) => {
      // a creature met in the world opens its bestiary entry
      const seen = this.profile.data.bestiary;
      if (seen.includes(id)) return;
      seen.push(id);
      this.profile.saveSoon();
      const c = CREATURES.find((x) => x.id === id);
      if (c) this.toast(`${tr('Бестиарий', 'Bestiary')}: ${L(c.name)}`, '#ffd23d');
    });
    run.events.on('respawn', () => {
      this.renderer.snapTo(run.player.x, run.player.z);
      this.hud.showBanner(tr('Вы пришли в себя', 'You come to'), '#ffffff', 2);
    });
    audio.playMusic(run.map.generator);
    this.hud.showBanner(L(run.map.name), '#ffffff', 2.2, `${ch.name} · ${tr('Уровень', 'Level')} ${ch.level}`);
    if (s.showHints && ch.playTime < 30) {
      const kb = s.keybinds;
      this.hud.showHint(true, [kb.up, kb.left, kb.down, kb.right].map((k) => keyName(k[0] ?? '')).join(''));
      this.input.onFirstMove = () => setTimeout(() => this.hud.showHint(false), 1200);
    } else this.hud.showHint(false);
    this.saveChar();
  }

  /** Writes the played character: level, experience, skills, position, play time. */
  private saveChar(): boolean {
    const run = this.run;
    const p = this.profile;
    const ch = run && this.runChar ? p.data.chars.find((c) => c.id === this.runChar) : null;
    if (!run || !ch) return false;
    ch.level = run.player.level;
    ch.xp = run.player.level >= PROG.maxLevel ? 0 : run.player.xp;
    ch.skills = [...run.action.levels];
    ch.tri = run.action.tri.map((x) => [x[0], x[1]]);
    ch.points = run.action.points;
    if (run.state === 'playing') ch.pos = { x: +run.player.x.toFixed(2), z: +run.player.z.toFixed(2) };
    ch.playTime += Math.round(run.time - this.charTime);
    this.charTime = Math.round(run.time);
    ch.lastPlayed = Date.now();
    return p.save();
  }

  private togglePause() {
    const run = this.run;
    if (this.mode !== 'run' || !run) return;
    if (this.paused) {
      this.paused = false;
      this.modals.close();
      this.input.setEnabled(true);
      audio.play('ui');
      return;
    }
    this.paused = true;
    this.skills.close();
    this.input.setEnabled(false);
    audio.play('ui');
    this.modals.pause(run, {
      resume: () => this.togglePause(),
      save: () => this.saveChar(),
      exit: () => this.exitToMenu(),
    });
  }

  private exitToMenu() {
    this.saveChar();
    this.paused = false;
    this.skills.close();
    this.renderer.endRun();
    this.run = null;
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
  /**
   * Frame pacing: with VSync the loop follows requestAnimationFrame; without it a message
   * channel drives frames as fast as the FPS limit allows. The limit skips frames in both modes.
   */
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

  /** Mouse/keyboard to action-RPG controls: cursor ground point, click-to-move, attack, skills. */
  private lmbMode: 'move' | 'attack' = 'move';
  /** Enemy picked with a click (its info frame stays visible). */
  private target: Enemy | null = null;
  private readMouse(run: Run, active: boolean) {
    const inp = this.input;
    const c = run.ctl;
    const rig = this.renderer.rig;
    const w = this.view.clientWidth || 1;
    const hgt = this.view.clientHeight || 1;
    if (inp.mx >= 0) {
      const g = rig.groundPoint(inp.mx, inp.my, w, hgt, 0);
      if (g) {
        c.aimX = g[0];
        c.aimZ = g[1];
      }
    }
    // enemy under the cursor: test at body height so tall foes are easy to pick
    let hover: Enemy | null = null;
    if (inp.mx >= 0) {
      const g = rig.groundPoint(inp.mx, inp.my, w, hgt, 0.7);
      if (g) {
        let best = 1e9;
        run.enemies.forEachInRadius(g[0], g[1], 2.5, (e) => {
          if (!e.alive || e.def.category === 'prop' || e.isAlly) return;
          const d = Math.hypot(e.x - g[0], e.z - g[1]) - e.radius * e.scale;
          if (d < 0.6 && d < best) {
            best = d;
            hover = e;
          }
        });
      }
    }
    // clicking an enemy selects it as the target: its frame (name, level, health) stays up
    if (hover && inp.lmbPressed) this.target = hover;
    if (this.target && (!this.target.alive || !this.target.active)) this.target = null;
    this.hud.setHover(hover ?? this.target);
    setCursor(hover ? 'attack' : 'default');
    if (!active) {
      inp.lmbPressed = false;
      inp.casts.length = 0;
      inp.dodgeQueued = false;
      inp.identityQueued = false;
      c.held.fill(false);
      c.attack = false;
      return;
    }
    const here = inp.held('attackHere');
    if (inp.lmbPressed) {
      inp.lmbPressed = false;
      this.lmbMode = here ? 'attack' : 'move';
      if (this.lmbMode === 'move') {
        c.click = true;
        const ring = run.effects.add('ring', c.aimX, c.aimZ, 0.35, 0x9affc0);
        ring.r = 0.6;
      }
    }
    c.attack = inp.rmb || inp.held('attack') || (inp.lmb && (this.lmbMode === 'attack' || here));
    for (let i = 0; i < SLOT_BINDS.length; i++) c.held[i] = inp.held(SLOT_BINDS[i]);
    c.move = inp.lmb && this.lmbMode === 'move' && !here;
    c.stop = inp.held('stop');
    if (inp.casts.length) {
      c.casts.push(...inp.casts);
      inp.casts.length = 0;
    }
    if (inp.dodgeQueued) {
      c.dodge = true;
      inp.dodgeQueued = false;
    }
    if (inp.identityQueued) {
      c.identity = true;
      inp.identityQueued = false;
    }
    let near = 0;
    run.enemies.forEachInRadius(run.player.x, run.player.z, 12, () => {
      near++;
    });
    rig.autoTarget = 1 + Math.min(0.22, near / 160);
  }

  private loop = (now: number) => {
    this.schedule();
    const limit = this.profile.data.settings.fpsLimit;
    if (limit > 0) {
      // allow 1 ms of slack so a 60 Hz limit on a 60 Hz display does not drop frames
      if (now < this.frameDue - 1) return;
      this.frameDue = Math.max(this.frameDue + 1000 / limit, now);
    } else if (!this.profile.data.settings.vsync && now - this.last < 1) return;
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const dt = Math.min(realDt, 1 / 20);
    const run = this.run;
    if (run && this.mode === 'run') {
      const [sx, sz] = this.input.update();
      const [ix, iz] = this.renderer.rig.screenToWorld(sx, sz);
      const active = !this.paused && !this.modals.isOpen && run.state === 'playing';
      this.readMouse(run, active);
      const sim = !this.paused && !this.modals.isOpen;
      if (sim) {
        // sub-steps keep collisions stable on slow frames
        const steps = Math.max(1, Math.ceil(dt / (1 / 40)));
        for (let i = 0; i < steps; i++) run.update(dt / steps, ix, iz);
        this.autosaveT -= dt;
        if (this.autosaveT <= 0) {
          this.autosaveT = AUTOSAVE;
          this.saveChar();
        }
      }
      this.renderer.frame(sim ? dt : 0);
      this.hud.update(run, realDt);
      // aggregated per-frame sounds
      if (run.hitSoundBudget > 0) audio.play('hit', Math.min(1, 0.3 + run.hitSoundBudget * 0.05));
      if (run.killSoundBudget > 0) audio.play('kill', Math.min(1, 0.4 + run.killSoundBudget * 0.1));
      if (run.xpSoundBudget > 0) audio.play('xp', 0.6);
      run.hitSoundBudget = run.killSoundBudget = run.xpSoundBudget = 0;
      const p = run.player;
      const rd = Math.abs(p.x - RIVER.centerX(p.z)) - RIVER.halfWidth(p.z);
      const water = p.z < RIVER.sourceZ - 4 ? 0 : Math.max(0, 1 - Math.max(0, rd) / 18);
      audio.setAmbience(!this.paused, 0.5, water, run.dayNight.enabled && run.dayNight.period === 'night', realDt);
    } else {
      audio.setAmbience(false, 0, 0, false, realDt);
    }
    if (!run || this.mode !== 'run') {
      if (this.backdropPaused && this.mode === 'menu') return;
      this.renderer.frame(realDt);
    }
  };
}

