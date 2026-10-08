import { h, clear, hex } from './dom';
import { thumbImg } from '../render/Thumbnails';
import { t, L } from '../i18n';
import type { Profile } from '../meta/Profile';
import { ACHIEVEMENTS } from '../data/achievements';
import { CLASSES, CLASS_BY_ID } from '../game/action/classes';
import type { ClassId } from '../game/action/types';
import { classInfo, classStage, tr } from './ClassPreview';

const SPEEDS = [0.25, 0.5, 1];

export interface ViewerScreen {
  el: HTMLElement;
  dispose(): void;
}

/**
 * CHARACTER VIEWER: the selected class stands full height on a lit turntable in its own scene.
 * Drag rotates (mouse or one finger), the wheel or a pinch zooms; grouped buttons play every
 * clip of the class (locomotion, basic chain, Q..F skills, ultimate, identity, dodge, reactions).
 */
export function viewerScreen(profile: Profile, heroId: string, sfx: (id: string) => void, onHero: (id: string) => void): ViewerScreen {
  const st = classStage(sfx, true);
  const viewer = st.viewer;
  const info = h('div.cv-info');
  const strip = h('div.cv-strip');
  const tools = h('div.cv-tools');
  let cur: ClassId = CLASS_BY_ID[heroId as ClassId] ? (heroId as ClassId) : CLASSES[0].id;

  const showHero = (id: ClassId) => {
    const c = CLASS_BY_ID[id];
    if (!c) return;
    cur = id;
    onHero(id);
    const unlocked = profile.isHeroUnlocked(id);
    st.setClass(c);
    for (const el of strip.children) el.classList.toggle('sel', (el as HTMLElement).dataset.id === id);
    const ach = ACHIEVEMENTS.find((a) => a.reward?.kind === 'hero' && a.reward.id === id);
    const wins = profile.stat('herowin_' + id);
    clear(info);
    info.append(
      h('div.cv-status' + (unlocked ? '.ok' : '.locked'), unlocked ? '✓ ' + t('cv_unlocked') : '🔒 ' + (ach ? t('unlock_by', { name: L(ach.name), desc: L(ach.desc) }) : t('locked'))),
      classInfo(c, profile.data.settings.keybinds),
    );
    if (wins) info.append(h('div.kv', h('span', t('cv_wins')), h('span', String(wins))));
  };

  for (const c of CLASSES) {
    const unlocked = profile.isHeroUnlocked(c.id);
    strip.append(
      h(
        'button.cv-card' + (unlocked ? '' : '.locked'),
        {
          'data-id': c.id,
          style: `--hc:${hex(c.color)}`,
          title: L(c.name),
          onclick: () => {
            sfx('select');
            showHero(c.id);
          },
        },
        thumbImg(c.id, 'thumb'),
        h('span.cv-card-name', L(c.name)),
        unlocked ? null : h('span.cv-lock', '🔒'),
      ),
    );
  }

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
  const spin = toggle(t('cv_turntable'), () => viewer.turntable, (v) => (viewer.turntable = v));
  tools.append(
    h('span.cv-label', t('cv_speed')),
    speedSeg,
    spin,
    toggle(t('cv_top'), () => viewer.topView, (v) => viewer.setTopView(v)),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(0.85) }, '+'),
    h('button.cv-tool', { onclick: () => viewer.zoomBy(1 / 0.85) }, '−'),
    h('button.cv-tool', { onclick: () => viewer.resetView() }, t('cv_reset')),
  );

  const step = (dir: number) => {
    const i = CLASSES.findIndex((x) => x.id === cur);
    sfx('select');
    showHero(CLASSES[(i + dir + CLASSES.length) % CLASSES.length].id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.defaultPrevented) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') step(-1);
    else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') step(1);
    else if (e.code === 'KeyR') viewer.resetView();
    else if (e.code === 'KeyT') {
      viewer.turntable = !viewer.turntable;
      spin.classList.toggle('on', viewer.turntable);
    } else if (/^Digit[1-9]$/.test(e.code)) (st.anims.querySelectorAll('.cv-anim:not(.mini)')[Number(e.code.slice(5)) - 1] as HTMLElement | undefined)?.click();
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  const el = h(
    'div.cv',
    strip,
    h(
      'div.cv-center',
      h(
        'div.cv-stage-wrap',
        st.stage,
        h('button.cv-nav.prev', { onclick: () => step(-1) }, '‹'),
        h('button.cv-nav.next', { onclick: () => step(1) }, '›'),
        h('div.cv-hint', tr('ЛКМ — вращать · колесо — масштаб · ←/→ — класс · T — вращение · R — сброс', 'LMB — rotate · wheel — zoom · ←/→ — class · T — turntable · R — reset')),
      ),
      tools,
      st.anims,
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
      st.dispose();
    },
  };
}
