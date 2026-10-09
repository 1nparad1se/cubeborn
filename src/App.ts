import { PROG } from './config/progression';
import { BAG_SIZE } from './game/arpg/Loot';
import { iconImg } from './ui/icons';
import { RARITY_COLOR } from './data/achievements';
import type { AchievementDef } from './data/types';
import { runRecord, runGold } from './meta/runRecord';
import { DAY_NIGHT } from './config/dayNight';
import { dev } from './dev/DevMode';
import { DevUi } from './dev/DevUi';
import { Run } from './game/Run';
import type { Enemy } from './game/Enemy';
import { itemName, RARITY_COLOR as ITEM_COLOR } from './game/arpg/Gear';
import { NullFx, type FxSink } from './game/types';
import { Renderer } from './render/Renderer';
import { Input, keyName, SLOT_BINDS } from './input/Input';
import { audio } from './audio/Audio';
import { Profile } from './meta/Profile';
import { Hud } from './ui/Hud';
import { Menus, type MenuApi } from './ui/Menus';
import { SkillsScreen } from './ui/SkillsScreen';
import { RunModals } from './ui/RunModals';
import { h } from './ui/dom';
import { t, L, setLang, getLang } from './i18n';
import { HERO_BY_ID } from './data/heroes';
import { MAP_BY_ID, MAPS } from './data/maps';
import { DIFFICULTIES, DIFFICULTY_BY_ID } from './data/difficulty';
import { BOSS_BY_ID, RELIC_BY_ID } from './data/bosses';
import { generateTerrain } from './game/mapgen/generators';
import type { BossController } from './game/bosses/Boss';
import { WAVE_TYPE_COLOR, MODIFIERS, type RunMode, type Wave } from './game/Waves';

export const VERSION = 'v3.3.0';

/** Discrete camera zoom steps for the mouse wheel (camera distance multipliers). */
const ZOOM_STEPS = [0.75, 0.88, 1, 1.15, 1.35];

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

type Mode = 'splash' | 'menu' | 'run' | 'results';

/** Top-level controller: screens, the game loop and meta progression. */
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
  private toasts: HTMLElement;
  private run: Run | null = null;
  private runArgs: [string, string, string, RunMode] = ['berserker', 'blightwood', 'normal', 'campaign'];
  private postVignette: HTMLElement;
  private frameDue = 0;
  private paused = false;
  private mode: Mode = 'splash';
  private last = performance.now();
  private hintActive = false;
  private finished = false;
  /** Achievements already announced during the current run (live unlock toasts). */
  private liveAch = new Set<string>();
  private achCheckT = 1;

  constructor(root: HTMLElement) {
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
    this.input.onMap = () => this.hud.toggleMap();
    this.input.onInventory = () => this.toggleInventory();
    this.input.onJump = () => {
      if (this.run && this.mode !== 'menu' && !this.paused && !this.modals.isOpen) this.run.player.requestJump();
    };
    this.hud = new Hud(root);
    this.hud.onPause = () => this.togglePause();
    this.hud.arpg.onInventory = () => this.toggleInventory();
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
    this.initDev();
    this.applySettings();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.autoPause();
        audio.suspend(true);
      } else audio.suspend(false);
    });
    window.addEventListener('blur', () => this.autoPause());
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

  pickCampfire(clientX: number, clientY: number): string | null {
    return this.renderer.pickCampfire(clientX, clientY);
  }

  private backdropPaused = false;
  setBackdropPaused(v: boolean) {
    this.backdropPaused = v;
  }

  // ------------------------------------------------------------------ developer mode
  private devUi: DevUi | null = null;

  /** Developer tools exist only when the build allows them; they start switched off. */
  private initDev() {
    dev.attach(this.profile);
    if (!dev.available) return;
    // console access for automated tests: window.cubebornDev
    (window as unknown as { cubebornDev: typeof dev }).cubebornDev = dev;
    const kb = () => this.profile.data.settings.keybinds;
    this.devUi = new DevUi(this.root, () => ({ panel: kb().devPanel[0] ?? '', debug: kb().devDebug[0] ?? '', god: kb().devGod[0] ?? '' }));
    dev.onProfileChange = () => {
      if (this.mode === 'menu') this.menus.render();
    };
    this.wireDevClass();
    this.input.onDev = (a) => {
      if (!dev.enabled || !this.devUi) return false;
      if (a === 'devPanel') this.devUi.setPanel(!dev.panelOpen);
      else if (a === 'devDebug') this.devUi.setDebug(!dev.debugOpen);
      else dev.toggle('god');
      return true;
    };
  }

  private wireDevClass() {
    dev.onStartClass = (id) => {
      if (this.run) {
        this.renderer.endRun();
        this.run = null;
        dev.endRun();
      }
      this.startRun(id, this.runArgs[1], this.runArgs[2], this.runArgs[3]);
    };
  }

  setDevMode(on: boolean) {
    dev.setEnabled(on);
    if (this.run) dev.applyRun(this.run);
  }

  openDevPanel() {
    this.devUi?.setPanel(true);
  }

  toggleDevDebug() {
    this.devUi?.setDebug(!dev.debugOpen);
  }

  setMenuShift(v: number) {
    this.renderer.menuShift = v;
  }

  applySettings() {
    const s = this.profile.data.settings;
    audio.setVolumes(s.master, s.sfx, s.music, s.ui);
    const effectsChanged = s.effects !== this.renderer.currentQuality;
    this.renderer.applySettings(s);
    if (effectsChanged && this.mode === 'menu') this.showMenuBackdrop();
    this.renderer.setZoom(s.cameraZoom);
    this.hud.setOptions({ minimap: s.showMinimap, waves: s.showWaveCounter, fps: s.showFps, enemies: s.showEnemyCount });
    this.postVignette.classList.toggle('hidden', !s.postProcessing);
    this.input.binds = s.keybinds;
    this.hud.arpg.binds = s.keybinds;
    this.skills.binds = s.keybinds;
    if (this.run) this.run.settings.damageNumbers = s.damageNumbers;
    this.applyDisplayMode();
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
    if (this.mode === 'run' && !this.paused && this.run?.state === 'playing' && !this.run.ending) this.togglePause();
  }

  private handleEscape() {
    const confirm = this.root.querySelector('.modal-back.confirm');
    if (confirm) {
      confirm.remove();
      return;
    }
    if (this.mode === 'run') {
      if (this.skills.isOpen) {
        this.skills.close();
        return;
      }
      if (this.invOpen) {
        this.toggleInventory();
        return;
      }
      if (this.paused || (this.run?.state === 'playing' && !this.run.ending)) this.togglePause();
      return;
    }
    if (this.mode === 'menu' && this.menus.canGoBack) this.menus.back();
  }

  private skills: SkillsScreen;
  /** Skills window (K): learning skills and picking upgrades while the fight goes on. */
  toggleSkills() {
    const run = this.run;
    if (!run || this.mode !== 'run' || this.paused || this.invOpen) return;
    this.skills.toggle(run);
  }

  private invOpen = false;
  /** Inventory screen (I / C): the game waits while it is open. */
  toggleInventory() {
    const run = this.run;
    if (!run || this.mode !== 'run') return;
    if (this.invOpen) {
      this.invOpen = false;
      this.modals.close();
      this.input.setEnabled(true);
      this.sfx('uiBack');
      return;
    }
    if (this.paused || this.modals.isOpen || run.state !== 'playing' || run.ending) return;
    this.invOpen = true;
    this.input.setEnabled(false);
    this.modals.inventory(run, () => this.toggleInventory());
    this.sfx('ui');
  }

  resetProgress() {
    this.profile.reset();
    setLang(this.profile.data.settings.lang);
    this.menus.home();
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
      audio.unlock();
      audio.play('select');
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
      this.toMenu();
    };
    el.addEventListener('pointerup', go, { once: true });
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.mode === 'splash' && (e.key === 'Enter' || e.key === ' ')) go();
      },
      { once: false },
    );
    this.root.appendChild(el);
  }

  private showMenuBackdrop() {
    const p = this.profile.data;
    const map = MAP_BY_ID[p.last.map] && this.profile.isMapUnlocked(p.last.map) ? MAP_BY_ID[p.last.map] : MAPS[0];
    // a small slice of the map is enough for the menu backdrop
    const terrain = generateTerrain({ ...map, size: 96 }, 4242, { zones: false });
    // clear a small stage in the middle for the hero
    this.renderer.showMenu(map, terrain, HERO_BY_ID[p.last.hero]?.model ?? 'bram');
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

  // ------------------------------------------------------------------ run lifecycle
  /** Id of the character the current run plays (null for developer runs of another class). */
  private runChar: string | null = null;

  startRun(heroId: string, mapId: string, diffId: string, mode: RunMode = 'campaign') {
    this.runArgs = [heroId, mapId, diffId, mode];
    this.menus.setVisible(false);
    this.modals.close();
    this.skills?.close();
    this.renderer.endRun();
    const p = this.profile;
    const fx = new ProxyFx();
    const run = new Run({
      map: MAP_BY_ID[mapId],
      diff: DIFFICULTY_BY_ID[diffId],
      hero: HERO_BY_ID[heroId],
      permanent: p.permanentMods(),
      fx,
      settings: { damageNumbers: p.data.settings.damageNumbers, dayLength: DAY_NIGHT.lengths[p.data.settings.dayNight] ?? DAY_NIGHT.lengths[DAY_NIGHT.defaultLength] },
      tr: (k) => t(k),
      mode,
      // the active character carries its own level, skills and items; other classes (developer runs) use the old shared gear
      ...(p.char && p.char.cls === heroId ? { char: structuredClone(p.char) } : { gear: { bag: p.data.gear.bag, equipped: p.data.gear.equipped[heroId] ?? {} } }),
    });
    this.runChar = p.char && p.char.cls === heroId ? p.char.id : null;
    fx.target = this.renderer.startRun(run, { sound: (id, v) => audio.play(id, v), vibrate: () => {} });
    this.renderer.setZoom(p.data.settings.cameraZoom);
    this.run = run;
    dev.applyRun(run);
    this.devUi?.setInRun(true);
    this.finished = false;
    this.liveAch.clear();
    this.achCheckT = 1;
    this.paused = false;
    this.hud.bestWave = mode === 'endless' ? (p.data.endless[mapId]?.wave ?? 0) : 0;
    this.hud.reset(run);
    this.hud.setVisible(true);
    this.input.setEnabled(true);
    this.mode = 'run';
    this.bindRunEvents(run);
    audio.playMusic(run.map.generator);
    this.hud.showBanner(L(run.map.name), '#ffffff', 2.2, mode === 'endless' ? t('mode_endless') : t('campaign_banner', { n: 30 }));
    if (!p.data.seenIntro) {
      this.hintActive = true;
      const kb = p.data.settings.keybinds;
      this.hud.showHint(true, [kb.up, kb.left, kb.down, kb.right].map((k) => keyName(k[0] ?? '')).join(''));
      this.input.onFirstMove = () => {
        setTimeout(() => {
          this.hud.showHint(false);
          this.hintActive = false;
        }, 1200);
        p.data.seenIntro = true;
        p.save();
      };
    } else this.hud.showHint(false);
  }

  private bindRunEvents(run: Run) {
    run.events.on('bossSpawn', (b: BossController) => {
      if (b.isClone) return;
      this.hud.setBoss(b);
      this.hud.showBanner(t('boss_appears', { name: L(b.def.name) }), '#ff4a5a', 3);
      if (b.isFinal) audio.playMusic('boss');
    });
    run.events.on('bossPhase', (b: BossController) => {
      if (!b.isClone) this.hud.showBanner(t('boss_rage', { name: L(b.def.name) }), '#ff7a3a', 2);
    });
    run.events.on('bossDefeated', (b: BossController) => {
      if (b.isClone) return;
      this.hud.showBanner(t('boss_defeated', { name: L(b.def.name) }), '#ffd23d', 3);
      if (!b.isFinal) audio.playMusic(run.map.generator);
    });
    const bannerColor = (key: string) =>
      key === 'ev_treasure' ? '#ffd23d' : key.startsWith('dn_blood') || key === 'dn_nightboss' ? '#ff4a5a' : key === 'dn_dawn' ? '#ffd08a' : key.startsWith('dn_') ? '#9ab8ff' : '#ff8a5a';
    run.events.on('banner', (key) => this.hud.showBanner(t(key), bannerColor(key)));
    run.events.on('wave', (w: Wave) => {
      if (w.n === 1) return;
      const title = run.mode === 'endless' ? t('hud_wave_endless', { n: w.n }) : t('hud_wave', { n: w.n, total: 30 });
      const sub = t('wave_' + w.type) + (w.boss ? ' — ' + L(BOSS_BY_ID[w.boss]?.name) : '') + ' · ' + t('wave_hint_' + w.type);
      this.hud.showBanner(title, WAVE_TYPE_COLOR[w.type], 2.8, sub);
      audio.play(w.type === 'boss' || w.type === 'final' ? 'bossRoar' : 'levelup');
    });
    run.events.on('modifier', (id) => {
      const m = MODIFIERS.find((x) => x.id === id);
      this.toast(t('mod_' + id) + ': ' + t('mod_' + id + '_desc'), m?.color ?? '#ffffff');
    });
    run.events.on('feature', (key) => this.hud.showBanner(t(key), '#ffcf7a', 2.6, t(key + '_desc')));
    run.loot.onPickup = (it) => {
      if (it.rarity !== 'common') this.toast(t('inv_got', { name: itemName(it, getLang()) }), ITEM_COLOR[it.rarity]);
    };
    run.events.on('gameover', () => this.finishRun(false));
    run.events.on('victory', () => this.finishRun(true));
  }

  private togglePause() {
    const run = this.run;
    if (this.mode !== 'run' || !run || this.finished) return;
    if (this.paused) {
      this.paused = false;
      this.modals.close();
      this.input.setEnabled(true);
      audio.play('ui');
      return;
    }
    if (run.state !== 'playing' || run.ending) return;
    this.paused = true;
    this.input.setEnabled(false);
    audio.play('ui');
    this.modals.pause(run, {
      resume: () => this.togglePause(),
      restart: () => {
        this.paused = false;
        this.finishRun(false, true);
        this.startRun(...this.runArgs);
      },
      exit: () => {
        this.paused = false;
        this.finishRun(false);
      },
    });
  }

  /** Applies rewards and stats to the profile and shows the results screen. */
  private finishRun(victory: boolean, silent = false) {
    const run = this.run;
    if (!run || this.finished) return;
    this.finished = true;
    this.input.setEnabled(false);
    const p = this.profile;
    // results of a run played with developer tools go to a throwaway copy of the save
    const sandbox = run.debug.tainted && !p.testBase;
    if (sandbox) {
      const settings = p.data.settings;
      p.testBase = p.data;
      p.data = JSON.parse(JSON.stringify(p.data));
      p.data.settings = settings;
    }
    // equipment and bag persist between runs
    const gs = run.loot.serialize();
    const ch = this.runChar ? p.data.chars.find((c) => c.id === this.runChar) : null;
    if (ch) {
      // the character keeps everything it earned: level, experience, skills, items
      ch.level = run.player.level;
      ch.xp = run.player.level >= PROG.maxLevel ? 0 : run.player.xp;
      ch.skills = [...run.action.levels];
      ch.tri = run.action.tri.map((t) => [t[0], t[1]]);
      ch.points = run.action.points;
      ch.equipped = gs.equipped;
      ch.bag = gs.bag;
      ch.runs++;
      ch.playTime += Math.round(run.time);
    } else {
      // the run carried the first slice of the stash as its bag; the rest stays in storage
      p.data.gear.bag = [...gs.bag, ...p.data.gear.bag.slice(BAG_SIZE)];
      p.data.gear.shop = [];
      p.data.gear.equipped[run.hero.id] = gs.equipped;
    }
    const s = run.summary();
    const diff = run.diff;
    const goldEarned = Run.goldReward(s, diff.reward);
    p.data.gold += goldEarned;
    const rec = runRecord(run, goldEarned);
    for (const [k, v] of Object.entries(rec.add)) if (v) p.addStat(k, v);
    for (const [k, v] of Object.entries(rec.max)) p.maxStat(k, v);
    let relic: string | null = null;
    for (const id of s.bosses) {
      const def = BOSS_BY_ID[id];
      if (def && RELIC_BY_ID[def.relic] && p.discover('relics', def.relic)) relic = L(RELIC_BY_ID[def.relic].name);
    }
    for (const id of s.seen) {
      if (BOSS_BY_ID[id]) p.discover('bosses', id);
      else p.discover('enemies', id);
    }
    let endless: { newRecord: boolean; best: number } | undefined;
    if (run.mode === 'endless') {
      const prev = p.data.endless[run.map.id];
      const newRecord = !prev || s.wave > prev.wave || (s.wave === prev.wave && s.time > prev.time);
      endless = { newRecord: newRecord && !!prev, best: prev?.wave ?? s.wave };
      if (newRecord) p.data.endless[run.map.id] = { wave: s.wave, time: Math.round(s.time), kills: s.kills, gold: goldEarned, level: s.level, hero: run.hero.id };
      p.maxStat('bestEndlessWave', s.wave);
    }
    if (victory && run.mode === 'campaign') {
      p.addStat('herowin_' + run.hero.id, 1);
      p.addStat('diffwin_' + diff.id, 1);
      const di = DIFFICULTIES.findIndex((d) => d.id === diff.id);
      p.data.mapClears[run.map.id] = Math.max(p.data.mapClears[run.map.id] ?? -1, di);
    }
    const achievements = p.checkAchievements();
    p.data.seenIntro = true;
    p.save();
    if (sandbox) {
      p.data = p.testBase!;
      p.testBase = null;
    }
    if (silent) return;
    // live unlock toasts would cover the results, which list the same achievements
    this.toasts.querySelectorAll('.ach-toast').forEach((el) => el.remove());
    this.mode = 'results';
    audio.playMusic(victory ? 'victory' : 'menu');
    const newUnlocks: string[] = [];
    if (victory && run.mode === 'campaign' && run.map.id !== MAPS[MAPS.length - 1].id) {
      const di = DIFFICULTIES.findIndex((d) => d.id === diff.id);
      if (di < 3 && (p.data.mapClears[run.map.id] ?? -1) === di) newUnlocks.push(t('diff_unlocked', { name: L(DIFFICULTIES[di + 1].name) }));
    }
    setTimeout(
      () =>
        this.modals.results(
          { victory, summary: s, goldEarned, diffName: L(diff.name), achievements, relic, newUnlocks, endless, run },
          {
            retry: () => this.startRun(...this.runArgs),
            menu: () => this.exitToMenu(),
          },
        ),
      silent ? 0 : 200,
    );
  }

  private exitToMenu() {
    this.skills.close();
    this.renderer.endRun();
    this.run = null;
    dev.endRun();
    this.devUi?.setInRun(false);
    this.showMenuBackdrop();
    this.toMenu();
  }

  /**
   * Live achievement unlocks: projects the run in progress onto the lifetime stats once a second.
   * Developer-mode runs never count; finishRun saves the unlocks (and shows them in the results).
   */
  private checkLiveAchievements(run: Run) {
    if (run.debug.tainted || this.profile.testBase) return;
    const list = this.profile.liveAchievements(runRecord(run, runGold(run)), this.liveAch);
    list.forEach((a, i) => {
      this.liveAch.add(a.id);
      setTimeout(() => this.achievementToast(a), i * 700);
    });
  }

  private achievementToast(a: AchievementDef) {
    if (this.finished) return;
    const col = RARITY_COLOR[a.rarity];
    const el = h(
      'div.toast.ach-toast',
      { style: `--tc:${col}` },
      h('div.ach-toast-icon', iconImg(a.icon, a.color)),
      h('div.ach-toast-body', h('div.ach-toast-head', t('ach_unlocked') + ' · ' + t('rarity_' + a.rarity)), h('div.ach-toast-name', L(a.name)), h('div.ach-toast-desc', L(a.desc))),
    );
    this.toasts.appendChild(el);
    audio.play('achieve', 0.8);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  }

  private toast(text: string, color = '#ffffff') {
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
    this.hud.setHover(hover);
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
    // big fights pull the camera back a little
    let near = 0;
    run.enemies.forEachInRadius(run.player.x, run.player.z, 12, () => {
      near++;
    }, false);
    rig.autoTarget = 1 + Math.min(0.22, near / 160) + (run.bosses.some((b) => b.e.alive) ? 0.12 : 0);
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
    dev.tick(realDt);
    this.devUi?.frame(realDt);
    const dt = Math.min(realDt, 1 / 20);
    const run = this.run;
    if (run && this.mode !== 'menu') {
      const [sx, sz] = this.input.update();
      const [ix, iz] = this.renderer.rig.screenToWorld(sx, sz);
      const devHold = dev.enabled && dev.paused;
      const active = !this.paused && !this.modals.isOpen && run.state === 'playing' && !devHold;
      this.readMouse(run, active);
      const sdt = dev.enabled ? dt * dev.timeScale : dt;
      if (active || (run.ending && !devHold)) {
        // fixed-ish sub-steps keep collisions stable on slow frames (and at developer time scales)
        const steps = Math.max(1, Math.ceil(sdt / (1 / 40)));
        for (let i = 0; i < steps; i++) run.update(sdt / steps, ix, iz);
        this.achCheckT -= sdt;
        if (this.achCheckT <= 0) {
          this.achCheckT = 1;
          this.checkLiveAchievements(run);
        }
      }
      const visDt = active || (run.ending && !devHold) ? sdt * (run.ending ? run.timeScale : 1) : 0;
      this.renderer.frame(visDt);
      this.hud.update(run, visDt, realDt);
      // aggregated per-frame sounds
      if (run.hitSoundBudget > 0) audio.play('hit', Math.min(1, 0.3 + run.hitSoundBudget * 0.05));
      if (run.killSoundBudget > 0) audio.play('kill', Math.min(1, 0.4 + run.killSoundBudget * 0.1));
      if (run.xpSoundBudget > 0) audio.play('xp', 0.6);
      run.hitSoundBudget = run.killSoundBudget = run.xpSoundBudget = 0;
      audio.setIntensity(Math.min(1, run.enemies.aliveCount / 250));
      void this.hintActive;
    } else if (!this.backdropPaused || this.mode !== 'menu') {
      this.renderer.frame(realDt);
    }
  };
}
