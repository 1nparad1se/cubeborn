import { h, clear, hex, put } from './dom';
import { iconImg } from './icons';
import { thumbImg } from '../render/Thumbnails';
import { t, L } from '../i18n';
import { statModLines } from './format';
import type { Profile } from '../meta/Profile';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { WEAPON_BY_ID } from '../data/weapons';
import { ACHIEVEMENTS } from '../data/achievements';
import { CharacterViewer } from '../render/CharacterViewer';
import type { AnimName } from '../render/rig/Animator';

/** Animation buttons in the order they appear under the stage; digits 1-9 trigger them. */
const ANIMS: AnimName[] = ['idle', 'walk', 'run', 'attack', 'ability', 'hit', 'death', 'levelup', 'victory'];
const SPEEDS = [0.25, 0.5, 1];

export interface ViewerScreen {
  el: HTMLElement;
  dispose(): void;
}

/**
 * CHARACTER VIEWER: the selected hero stands full height on a lit turntable in its own scene.
 * Drag rotates (mouse or one finger), the wheel or a pinch zooms; buttons play every animation.
 */
export function viewerScreen(profile: Profile, heroId: string, sfx: (id: string) => void, onHero: (id: string) => void): ViewerScreen {
  const stageHost = h('div.cv-stage');
  const viewer = new CharacterViewer(stageHost);
  const info = h('div.cv-info');
  const strip = h('div.cv-strip');
  const animBar = h('div.cv-anims');
  const tools = h('div.cv-tools');
  let cur = heroId;

  const showHero = (id: string) => {
    const hero = HERO_BY_ID[id];
    if (!hero) return;
    cur = id;
    onHero(id);
    const unlocked = profile.isHeroUnlocked(id);
    viewer.setHero(hero.model, hero.color);
    stageHost.style.setProperty('--hc', hex(hero.color));
    for (const c of strip.children) c.classList.toggle('sel', (c as HTMLElement).dataset.id === id);
    const w = WEAPON_BY_ID[hero.startWeapon];
    const evo = w.evolution ? WEAPON_BY_ID[w.evolution.into] : null;
    const ach = ACHIEVEMENTS.find((a) => a.reward?.kind === 'hero' && a.reward.id === id);
    const wins = profile.stat('herowin_' + id);
    clear(info);
    put(
      info,
      h('div.cv-name', L(hero.name)),
      h('div.cv-title', { style: `color:${hex(hero.color)}` }, L(hero.title)),
      h('div.cv-status' + (unlocked ? '.ok' : '.locked'), unlocked ? '✓ ' + t('cv_unlocked') : '🔒 ' + (ach ? t('unlock_by', { name: L(ach.name), desc: L(ach.desc) }) : t('locked'))),
      h('p.cv-desc', L(hero.desc)),
      h('div.cv-sec', t('cv_stats')),
      h('div.kv', h('span', t('stat_maxHp')), h('span', String(hero.baseHp))),
      h('div.kv', h('span', t('stat_moveSpeed')), h('span', String(hero.baseSpeed))),
      ...statModLines(hero.stats).map((s) => h('div.mod', s)),
      h('div.cv-sec', t('start_weapon')),
      h('div.cv-weapon', iconImg(w.icon, w.color, 'icon'), h('div', h('b', L(w.name)), h('span', L(w.desc)))),
      evo ? h('div.cv-evo', '➜ ' + t('cv_evolves', { name: L(evo.name) })) : null,
      h('div.cv-sec', t('cv_ability')),
      h('div.perk', h('b', L(hero.perkName)), h('span', L(hero.perkDesc))),
      wins ? h('div.kv', h('span', t('cv_wins')), h('span', String(wins))) : null,
    );
  };

  HEROES.forEach((hero) => {
    const unlocked = profile.isHeroUnlocked(hero.id);
    strip.append(
      h(
        'button.cv-card' + (unlocked ? '' : '.locked'),
        {
          'data-id': hero.id,
          style: `--hc:${hex(hero.color)}`,
          title: L(hero.name),
          onclick: () => {
            sfx('select');
            showHero(hero.id);
          },
        },
        thumbImg(hero.model, 'thumb'),
        h('span.cv-card-name', L(hero.name)),
        unlocked ? null : h('span.cv-lock', '🔒'),
      ),
    );
  });

  const animBtns = new Map<AnimName, HTMLElement>();
  ANIMS.forEach((a, i) => {
    const b = h('button.cv-anim', {
      onclick: () => {
        sfx('ui');
        viewer.play(a);
      },
    }, h('span.key', String(i + 1)), t('anim_' + a));
    animBtns.set(a, b);
    animBar.append(b);
  });
  viewer.onModeChange = (m) => {
    for (const [a, b] of animBtns) b.classList.toggle('sel', a === m);
  };

  const speedSeg = h('div.seg.cv-speed');
  const renderSpeed = () => {
    clear(speedSeg);
    for (const s of SPEEDS)
      speedSeg.append(
        h('button' + (viewer.speed === s ? '.sel' : ''), {
          onclick: () => {
            viewer.speed = s;
            renderSpeed();
          },
        }, '×' + s),
      );
  };
  renderSpeed();
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b: HTMLElement = h('button.cv-tool' + (get() ? '.on' : ''), {
      onclick: () => {
        sfx('ui');
        set(!get());
        b.classList.toggle('on', get());
      },
    }, label);
    return b;
  };
  put(
    tools,
    h('span.cv-label', t('cv_speed')),
    speedSeg,
    toggle(t('cv_turntable'), () => viewer.turntable, (v) => (viewer.turntable = v)),
    toggle(t('cv_top'), () => viewer.topView, (v) => viewer.setTopView(v)),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(0.85) }, '+'),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(1 / 0.85) }, '−'),
    h('button.cv-tool', { onclick: () => viewer.resetView() }, t('cv_reset')),
  );

  const step = (dir: number) => {
    const i = HEROES.findIndex((x) => x.id === cur);
    sfx('select');
    showHero(HEROES[(i + dir + HEROES.length) % HEROES.length].id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') step(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') step(1);
    else if (e.code === 'KeyR') viewer.resetView();
    else if (e.code === 'KeyT') {
      viewer.turntable = !viewer.turntable;
      tools.querySelectorAll('.cv-tool')[0]?.classList.toggle('on', viewer.turntable);
    } else if (/^Digit[1-9]$/.test(e.code)) viewer.play(ANIMS[Number(e.code.slice(5)) - 1]);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const el = h(
    'div.cv',
    strip,
    h(
      'div.cv-center',
      h('div.cv-stage-wrap', stageHost, h('button.cv-nav.prev', { onclick: () => step(-1) }, '‹'), h('button.cv-nav.next', { onclick: () => step(1) }, '›'), h('div.cv-hint', t('cv_hint'))),
      animBar,
      tools,
    ),
    info,
  );
  showHero(cur);
  viewer.play('idle');
  viewer.start();
  return {
    el,
    dispose() {
      window.removeEventListener('keydown', onKey);
      viewer.dispose();
    },
  };
}
