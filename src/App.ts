import { Run } from './game/Run';
import { NullFx, type FxSink } from './game/types';
import { Renderer } from './render/Renderer';
import { Input } from './input/Input';
import { audio } from './audio/Audio';
import { Profile } from './meta/Profile';
import { Hud } from './ui/Hud';
import { Menus, type MenuApi } from './ui/Menus';
import { RunModals } from './ui/RunModals';
import { h } from './ui/dom';
import { t, L, setLang } from './i18n';
import { HERO_BY_ID } from './data/heroes';
import { MAP_BY_ID, MAPS } from './data/maps';
import { DIFFICULTIES, DIFFICULTY_BY_ID } from './data/difficulty';
import { WEAPONS, WEAPON_BY_ID } from './data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from './data/passives';
import { BOSS_BY_ID, RELIC_BY_ID } from './data/bosses';
import { generateTerrain } from './game/mapgen/generators';
import type { BossController } from './game/bosses/Boss';

export const VERSION = 'v1.0.0';

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
  private runArgs: [string, string, string] = ['bram', 'blightwood', 'normal'];
  private paused = false;
  private mode: Mode = 'splash';
  private last = performance.now();
  private hintActive = false;
  private finished = false;

  constructor(root: HTMLElement) {
    this.root = root;
    root.classList.add('app');
    const s = this.profile.data.settings;
    setLang(s.lang);
    this.view = h('div.view');
    root.appendChild(this.view);
    this.renderer = new Renderer(this.view, s.quality);
    this.input = new Input(this.view);
    this.input.onPause = () => this.togglePause();
    this.hud = new Hud(root);
    this.hud.onPause = () => this.togglePause();
    this.hud.setVisible(false);
    this.menus = new Menus(root, this);
    // Android back button (APK shell): pause / resume / step back through menus.
    (window as unknown as { cubebornBack: () => boolean }).cubebornBack = () => this.handleBack();
    this.menus.setVisible(false);
    this.modals = new RunModals(root, this);
    this.toasts = h('div.toasts');
    root.appendChild(this.toasts);
    this.applySettings();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.mode === 'run' && !this.paused && this.run?.state === 'playing') this.togglePause();
        audio.suspend(true);
      } else audio.suspend(false);
    });
    this.showMenuBackdrop();
    this.splash();
    requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ MenuApi
  sfx(id: string) {
    audio.play(id);
  }

  setShowcase(modelId: string) {
    this.renderer.setShowcase(modelId);
  }

  applySettings() {
    const s = this.profile.data.settings;
    audio.setVolumes(s.sfx, s.music);
    if (s.quality !== this.renderer.currentQuality) {
      this.renderer.applyQuality(s.quality);
      if (this.mode === 'menu') this.showMenuBackdrop();
    }
    this.renderer.setSettings({ damageNumbers: s.damageNumbers, screenShake: s.screenShake });
    this.hud.setFpsVisible(s.showFps);
    if (this.run) this.run.settings.damageNumbers = s.damageNumbers;
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
    const terrain = generateTerrain(map, 4242);
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
  startRun(heroId: string, mapId: string, diffId: string) {
    this.runArgs = [heroId, mapId, diffId];
    this.menus.setVisible(false);
    this.modals.close();
    this.renderer.endRun();
    const p = this.profile;
    const fx = new ProxyFx();
    const run = new Run({
      map: MAP_BY_ID[mapId],
      diff: DIFFICULTY_BY_ID[diffId],
      hero: HERO_BY_ID[heroId],
      permanent: p.permanentMods(),
      unlockedWeapons: new Set(WEAPONS.filter((w) => p.isWeaponUnlocked(w.id)).map((w) => w.id)),
      unlockedPassives: new Set(PASSIVES.filter((x) => p.isPassiveUnlocked(x.id)).map((x) => x.id)),
      fx,
      settings: { damageNumbers: p.data.settings.damageNumbers },
      tr: (k) => t(k),
    });
    const s = p.data.settings;
    fx.target = this.renderer.startRun(
      run,
      {
        sound: (id, v) => audio.play(id, v),
        vibrate: (ms) => {
          if (!s.vibration || !navigator.vibrate) return;
          try {
            navigator.vibrate(ms);
          } catch {
            /* vibration unavailable */
          }
        },
      },
      { damageNumbers: s.damageNumbers, screenShake: s.screenShake },
    );
    this.run = run;
    this.finished = false;
    this.paused = false;
    this.hud.reset();
    this.hud.setVisible(true);
    this.input.setEnabled(true);
    this.mode = 'run';
    this.bindRunEvents(run);
    audio.playMusic(run.map.generator);
    this.hud.showBanner(L(run.map.name), '#ffffff', 2.2);
    if (!p.data.seenIntro) {
      this.hintActive = true;
      this.hud.showHint(true, matchMedia('(pointer: coarse)').matches);
      this.input.onFirstMove = () => {
        setTimeout(() => {
          this.hud.showHint(false, false);
          this.hintActive = false;
        }, 1200);
        p.data.seenIntro = true;
        p.save();
      };
    } else this.hud.showHint(false, false);
  }

  private bindRunEvents(run: Run) {
    run.events.on('levelup', (choices) => {
      this.input.setEnabled(false);
      this.modals.levelUp(run, choices, () => {
        if (run.state === 'levelup') return;
        this.modals.close();
        this.input.setEnabled(true);
      });
    });
    run.events.on('chest', (data) => {
      this.input.setEnabled(false);
      this.modals.chest(run, data, () => {
        run.closeChest();
        this.modals.close();
        this.input.setEnabled(true);
      });
    });
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
    run.events.on('banner', (key) => this.hud.showBanner(t(key), key === 'ev_treasure' ? '#ffd23d' : '#ff8a5a'));
    run.events.on('evolution', (id) => {
      const w = WEAPON_BY_ID[id];
      this.toast(t('evolved', { name: L(w.name) }), '#ffb02e');
    });
    run.events.on('gameover', () => this.finishRun(false));
    run.events.on('victory', () => this.finishRun(true));
  }

  private handleBack(): boolean {
    const confirm = this.root.querySelector('.modal-back.confirm');
    if (confirm) {
      confirm.remove();
      return true;
    }
    if (this.mode === 'run') {
      if (this.run?.state === 'playing' && !this.run.ending) this.togglePause();
      return true;
    }
    if (this.mode === 'menu' && this.menus.canGoBack) {
      this.menus.back();
      return true;
    }
    return this.mode === 'results' || this.mode === 'splash' ? this.mode === 'results' : false;
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
    const s = run.summary();
    const diff = run.diff;
    const goldEarned = Run.goldReward(s, diff.reward);
    p.data.gold += goldEarned;
    p.addStat('gold', goldEarned);
    p.addStat('kills', s.kills);
    p.addStat('runs', 1);
    p.addStat('elites', s.elites);
    p.addStat('chests', s.chests);
    p.addStat('treasureSprites', s.treasureSprites);
    p.addStat('bossKills', s.bosses.length);
    p.maxStat('bestRunKills', s.kills);
    p.maxStat('bestLevel', s.level);
    p.maxStat('bestTime', s.time);
    p.maxStat('bestRunEvos', s.evolutions.length);
    p.maxStat('bestWeaponCount', s.weaponCount);
    p.maxStat('maxedWeapons', s.maxedWeapons);
    for (const [id, n] of Object.entries(run.stats.killsBy)) p.addStat('kill_' + id, n);
    let relic: string | null = null;
    for (const id of s.bosses) {
      p.addStat('boss_' + id, 1);
      const def = BOSS_BY_ID[id];
      if (def && RELIC_BY_ID[def.relic] && p.discover('relics', def.relic)) relic = L(RELIC_BY_ID[def.relic].name);
    }
    for (const id of s.discovered) {
      if (WEAPON_BY_ID[id]) p.discover('weapons', id);
      else if (PASSIVE_BY_ID[id]) p.discover('passives', id);
    }
    for (const id of s.seen) {
      if (BOSS_BY_ID[id]) p.discover('bosses', id);
      else p.discover('enemies', id);
    }
    if (victory) {
      p.addStat('herowin_' + run.hero.id, 1);
      p.addStat('diffwin_' + diff.id, 1);
      const di = DIFFICULTIES.findIndex((d) => d.id === diff.id);
      p.data.mapClears[run.map.id] = Math.max(p.data.mapClears[run.map.id] ?? -1, di);
    }
    const achievements = p.checkAchievements();
    p.data.seenIntro = true;
    p.save();
    if (silent) return;
    this.mode = 'results';
    audio.playMusic(victory ? 'victory' : 'menu');
    const newUnlocks: string[] = [];
    if (victory && run.map.id !== MAPS[MAPS.length - 1].id) {
      const di = DIFFICULTIES.findIndex((d) => d.id === diff.id);
      if (di < 3 && (p.data.mapClears[run.map.id] ?? -1) === di) newUnlocks.push(t('diff_unlocked', { name: L(DIFFICULTIES[di + 1].name) }));
    }
    setTimeout(
      () =>
        this.modals.results(
          { victory, summary: s, goldEarned, diffName: L(diff.name), achievements, relic, newUnlocks },
          {
            retry: () => this.startRun(...this.runArgs),
            menu: () => this.exitToMenu(),
          },
        ),
      silent ? 0 : 200,
    );
  }

  private exitToMenu() {
    this.renderer.endRun();
    this.run = null;
    this.showMenuBackdrop();
    this.toMenu();
  }

  private toast(text: string, color = '#ffffff') {
    const el = h('div.toast', { style: `--tc:${color}` }, text);
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  // ------------------------------------------------------------------ loop
  private loop = (now: number) => {
    requestAnimationFrame(this.loop);
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const dt = Math.min(realDt, 1 / 20);
    const run = this.run;
    if (run && this.mode !== 'menu') {
      const [ix, iz] = this.input.update();
      const active = !this.paused && !this.modals.isOpen && run.state === 'playing';
      if (active || run.ending) {
        // fixed-ish sub-steps keep collisions stable on slow frames
        const steps = dt > 1 / 40 ? 2 : 1;
        for (let i = 0; i < steps; i++) run.update(dt / steps, ix, iz);
      }
      const visDt = active || run.ending ? dt * (run.ending ? run.timeScale : 1) : 0;
      this.renderer.frame(visDt);
      this.hud.update(run, visDt, realDt);
      // aggregated per-frame sounds
      if (run.hitSoundBudget > 0) audio.play('hit', Math.min(1, 0.3 + run.hitSoundBudget * 0.05));
      if (run.killSoundBudget > 0) audio.play('kill', Math.min(1, 0.4 + run.killSoundBudget * 0.1));
      if (run.xpSoundBudget > 0) audio.play('xp', 0.6);
      run.hitSoundBudget = run.killSoundBudget = run.xpSoundBudget = 0;
      audio.setIntensity(Math.min(1, run.enemies.aliveCount / 250));
      void this.hintActive;
    } else {
      this.renderer.frame(realDt);
    }
  };
}
