import { h, clear, hex } from './dom';
import { thumbImg } from '../render/Thumbnails';
import { iconImg } from './icons';
import { t, L } from '../i18n';
import type { Profile } from '../meta/Profile';
import { ACHIEVEMENTS } from '../data/achievements';
import { CLASSES, CLASS_BY_ID } from '../game/action/classes';
import type { ClassDef, ClassId, SkillDef, Step } from '../game/action/types';
import { SLOT_KEYS } from '../game/action/types';
import { SkillSandbox, type DemoAction } from '../render/SkillSandbox';
import { CAST, DMG_COLOR, classInfo, classStage, dmgName, hideTip, tr } from './ClassPreview';
import './viewer.css';

const SPEEDS = [0.25, 0.5, 1];

export interface ViewerScreen {
  el: HTMLElement;
  dispose(): void;
}

const SUMMON_NAME: Record<string, [string, string]> = {
  wolf: ['волк', 'wolf'], golem: ['голем', 'golem'], wisp: ['огонёк', 'wisp'], ancient: ['древний', 'ancient'], hawk: ['ястреб', 'hawk'],
  clone: ['двойник', 'clone'], serpent: ['змей', 'serpent'], drake: ['дракон', 'drake'],
};
const MOVE_NAME: Record<string, [string, string]> = {
  dash: ['Рывок', 'Dash'], leap: ['Прыжок', 'Leap'], blink: ['Телепорт', 'Teleport'], back: ['Отскок', 'Backstep'], behind: ['За спину', 'Behind'],
};

/** Short chips describing what a skill's script does (moves, projectiles, zones, summons, buffs). */
function scriptChips(steps: Step[]): string[] {
  const out = new Set<string>();
  for (const s of steps)
    for (const e of s.ev) {
      if (e.do === 'move') out.add(`${tr(...MOVE_NAME[e.kind])} ${e.dist}`);
      else if (e.do === 'proj') out.add(tr('Снаряд', 'Projectile') + ((e.n ?? 1) > 1 ? ` ×${e.n}` : '') + (e.explode ? tr(' · взрыв', ' · blast') : '') + (e.pierce === -1 ? tr(' · пронзает', ' · pierce') : ''));
      else if (e.do === 'zone') out.add(tr('Зона', 'Zone') + ` r${e.r}` + (e.dur ? ` · ${e.dur}${tr(' сек', 's')}` : '') + ((e.n ?? 1) > 1 ? ` ×${e.n}` : ''));
      else if (e.do === 'summon') out.add(tr('Призыв', 'Summon') + `: ${tr(...(SUMMON_NAME[e.kind] ?? [e.kind, e.kind]))}` + ((e.n ?? 1) > 1 ? ` ×${e.n}` : ''));
      else if (e.do === 'buff') out.add(tr('Усиление', 'Buff') + ` ${e.dur}${tr(' сек', 's')}`);
      else if (e.do === 'chain') out.add(tr('Цепь', 'Chain') + ` ×${e.n}`);
      else if (e.do === 'hit' && (e.n ?? 1) > 1) out.add(tr('Ударов', 'Hits') + ` ×${e.n}`);
    }
  return [...out];
}

interface SkillEntry {
  id: string;
  key: string;
  name: string;
  desc: string;
  icon: string;
  color: number;
  kind: string;
  params: [string, string, string?][];
  chips: string[];
  demo: DemoAction[];
}

/** Every action of a class for the skills panel: basic, Q..F, ultimate, identity, special, dodge. */
function skillEntries(c: ClassDef): SkillEntry[] {
  const sec = tr(' сек', 's');
  const res = L(c.res.name);
  const out: SkillEntry[] = [];
  const skillParams = (s: SkillDef): [string, string, string?][] => {
    const p: [string, string, string?][] = [[tr('Перезарядка', 'Cooldown'), s.cd + sec]];
    if (s.range) p.push([tr('Дальность', 'Range'), String(s.range)]);
    if (s.radius) p.push([tr('Радиус', 'Radius'), String(s.radius)]);
    if (s.cost) p.push([s.cost > 0 ? tr('Расход', 'Cost') : tr('Даёт', 'Gains'), `${Math.abs(s.cost)} ${res}`, c.res.color]);
    p.push([tr('Тип', 'Type'), tr(...CAST[s.type])]);
    p.push([tr('Урон', 'Damage'), dmgName(s.el), DMG_COLOR[s.el]]);
    if (s.castTime) p.push([tr('Подготовка', 'Cast'), s.castTime + sec]);
    if (s.chargeMax) p.push([tr('Заряд', 'Charge'), s.chargeMax + sec + (s.chargeMul ? ` ×${s.chargeMul}` : '')]);
    if (s.holdMax) p.push([tr('Удержание', 'Hold'), s.holdMax + sec]);
    if (s.unlock > 1) p.push([tr('Уровень', 'Level'), String(s.unlock)]);
    return p;
  };
  out.push({
    id: 'basic', key: tr('ПКМ', 'RMB'), name: L(c.basic.name), desc: L(c.basic.desc), icon: c.basic.icon, color: c.color, kind: tr('Базовая атака', 'Basic attack'),
    params: [[tr('Ударов', 'Hits'), String(c.basic.steps.length)], [tr('Урон', 'Damage'), dmgName(c.basic.el), DMG_COLOR[c.basic.el]], [tr('Тип', 'Type'), c.basic.ranged ? tr('дальний', 'ranged') : tr('ближний', 'melee')]],
    chips: scriptChips(c.basic.steps), demo: [{ k: 'basic' }],
  });
  c.skills.forEach((s, i) => out.push({ id: s.id, key: SLOT_KEYS[i], name: L(s.name), desc: L(s.desc), icon: s.icon, color: s.color, kind: tr('Навык', 'Skill'), params: skillParams(s), chips: scriptChips(s.steps), demo: [{ k: 'skill', slot: i }] }));
  out.push({ id: 'ult', key: 'V', name: L(c.ult.name), desc: L(c.ult.desc), icon: c.ult.icon, color: c.ult.color, kind: tr('Пробуждение', 'Awakening'), params: skillParams(c.ult), chips: scriptChips(c.ult.steps), demo: [{ k: 'ult' }] });
  const id = c.identity;
  const idDemo: DemoAction[] = [];
  if (id.kind === 'axis') {
    // Divine Axis detonates seals: place one first
    const seal = c.skills.findIndex((s) => s.steps.some((st) => st.ev.some((e) => e.do === 'zone' && e.vis === 'seal')));
    if (seal >= 0) idDemo.push({ k: 'skill', slot: seal });
  }
  idDemo.push({ k: 'identity' });
  out.push({
    id: 'identity', key: 'Z', name: L(id.name), desc: L(id.desc), icon: id.icon, color: id.color, kind: tr('Идентичность', 'Identity'),
    params: [[tr('Нужно', 'Needs'), `${id.need} ${res}`, c.res.color], ...(id.dur ? [[tr('Длительность', 'Duration'), id.dur + sec] as [string, string]] : [])],
    chips: id.step ? scriptChips([id.step]) : [], demo: idDemo,
  });
  if (c.special)
    out.push({ id: 'special', key: 'X', name: L(c.special.name), desc: L(c.special.desc), icon: c.special.icon, color: c.color, kind: tr('Особое действие', 'Special'), params: [[tr('Перезарядка', 'Cooldown'), c.special.cd + sec]], chips: scriptChips([c.special.step]), demo: [{ k: 'special' }] });
  const dg = c.dodge;
  out.push({
    id: 'dodge', key: tr('Пробел', 'Space'), name: L(dg.name), desc: tr('Уклонение с неуязвимостью в начале.', 'An evasive move, invulnerable at the start.'), icon: c.id + '_dodge', color: c.color, kind: tr('Уклонение', 'Dodge'),
    params: [[tr('Перезарядка', 'Cooldown'), dg.cd + sec], ...(dg.charges > 1 ? [[tr('Заряды', 'Charges'), String(dg.charges)] as [string, string]] : [])],
    chips: scriptChips([dg.step]), demo: [{ k: 'dodge' }],
  });
  return out;
}

/**
 * CHARACTER VIEWER: class list on the left, the hero on a lit turntable in the centre (drag
 * rotates, wheel / pinch zooms, every clip of the rig can be played and replayed) and the
 * class's actions on the right. Each action has a Play button that runs a full demo in an
 * isolated SkillSandbox (real ActionSystem + ActionFxRenderer against an empty fake run).
 */
export function viewerScreen(profile: Profile, heroId: string, sfx: (id: string) => void, onHero: (id: string) => void): ViewerScreen {
  const st = classStage(sfx, true);
  const viewer = st.viewer;
  const panel = h('div.cv-info.cvx-panel');
  const strip = h('div.cv-strip');
  const tools = h('div.cv-tools');
  const extra = h('div.cs-agroup.cvx-extra');
  let cur: ClassId = CLASS_BY_ID[heroId as ClassId] ? (heroId as ClassId) : CLASSES[0].id;
  let sb: SkillSandbox | null = null;
  let demoKey = '';
  let demoName = '';
  let lastDemo: SkillEntry | null = null;
  let lastAnim: (() => void) | null = null;
  const playBtns = new Map<string, HTMLElement>();

  // ---------------------------------------------------------------- demo controls
  const status = h('span.cvx-status');
  const pauseBtn: HTMLElement = h('button.cv-tool.cvx-pause', { onclick: () => setPaused(!viewer.paused) }, '⏸ ' + tr('Пауза', 'Pause'));
  const setPaused = (v: boolean) => {
    viewer.paused = v;
    pauseBtn.textContent = v ? '▶ ' + tr('Продолжить', 'Resume') : '⏸ ' + tr('Пауза', 'Pause');
    pauseBtn.classList.toggle('on', v);
  };
  const replay = () => {
    sfx('ui');
    if (lastDemo && (viewer.demoActive || !lastAnim)) runDemo(lastDemo);
    else lastAnim?.();
  };
  const toIdle = () => {
    sfx('ui');
    stopDemo();
    viewer.play('idle');
  };
  const demoBar = h(
    'div.cvx-demobar',
    status,
    pauseBtn,
    h('button.cv-tool', { onclick: replay, title: tr('Повторить', 'Replay') }, '↻ ' + tr('Повтор', 'Replay')),
    h('button.cv-tool', { onclick: toIdle, title: tr('Вернуться в покой', 'Back to idle') }, '■ ' + tr('Покой', 'Idle')),
  );

  const stopDemo = () => {
    if (viewer.demoActive) viewer.detachDemo();
    sb = null;
    demoKey = '';
    for (const b of playBtns.values()) b.classList.remove('on');
  };

  const runDemo = (e: SkillEntry) => {
    const c = CLASS_BY_ID[cur];
    if (!viewer.demoActive || !sb || sb.classId !== c.id) {
      stopDemo();
      sb = new SkillSandbox(c.id);
    }
    setPaused(false);
    sb.play(e.demo);
    viewer.attachDemo(sb, 'demo:' + e.id);
    lastDemo = e;
    demoKey = e.id;
    demoName = e.name;
    for (const [k, b] of playBtns) b.classList.toggle('on', k === e.id);
  };

  const tick = window.setInterval(() => {
    if (viewer.demoActive && sb) {
      const state = viewer.paused ? tr('пауза', 'paused') : sb.done ? tr('завершено', 'finished') : tr('играет', 'playing');
      status.textContent = `▶ ${demoName} — ${state}`;
      demoBar.classList.add('demo');
    } else {
      if (demoKey) {
        demoKey = '';
        for (const b of playBtns.values()) b.classList.remove('on');
      }
      status.textContent = tr('Анимация: ', 'Animation: ') + (viewer.mode || 'idle') + (viewer.paused ? ' · ' + tr('пауза', 'paused') : '');
      demoBar.classList.remove('demo');
    }
  }, 200);

  // ---------------------------------------------------------------- animations
  // every animation button stops a demo (CharacterViewer.play / playSeq detach it) and becomes the replay target
  st.anims.addEventListener(
    'click',
    (ev) => {
      const b = (ev.target as HTMLElement).closest('.cv-anim') as HTMLElement | null;
      if (!b || !st.anims.contains(b) || extra.contains(b)) return;
      sb = null;
      lastDemo = null;
      setPaused(false);
      lastAnim = () => b.click();
    },
    true,
  );
  const buildExtra = () => {
    clear(extra);
    const btn = (label: string, fn: () => void, title = label) => {
      const b: HTMLElement = h('button.cv-anim', {
        title,
        onclick: () => {
          sfx('ui');
          stopDemo();
          lastDemo = null;
          setPaused(false);
          lastAnim = fn;
          fn();
        },
      }, label);
      return b;
    };
    const list = h(
      'div.cs-aitems',
      btn(tr('Поворот', 'Turn'), () => viewer.playTurn()),
      btn(tr('Прыжок', 'Jump'), () => viewer.playJump()),
      btn(tr('Получение урона', 'Hit'), () => viewer.play('hit')),
      ...['levelup', 'ability', 'attack'].filter((c) => viewer.has(c)).map((c) => btn(c === 'levelup' ? tr('Новый уровень', 'Level up') : c === 'ability' ? tr('Способность', 'Ability') : tr('Атака', 'Attack'), () => viewer.playSeq([{ clip: c }], c), c)),
    );
    const all = h('div.cs-aitems.cvx-allclips');
    for (const c of viewer.clipNames()) all.append(btn(c, () => viewer.playSeq([{ clip: c, hold: /_(loop|charge|cast)$/.test(c) || /stagger|death|victory/.test(c) ? 1.6 : undefined }], c), c));
    extra.append(
      h('div.cs-alabel', tr('Другое', 'Other')),
      list,
      h('details.cvx-all', h('summary', tr(`Все клипы (${viewer.clipNames().length})`, `All clips (${viewer.clipNames().length})`)), all),
    );
    st.anims.append(extra);
  };

  // ---------------------------------------------------------------- skills panel
  const renderPanel = (c: ClassDef) => {
    clear(panel);
    playBtns.clear();
    const unlocked = profile.isHeroUnlocked(c.id);
    const ach = ACHIEVEMENTS.find((a) => a.reward?.kind === 'hero' && a.reward.id === c.id);
    const wins = profile.stat('herowin_' + c.id);
    const list = h('div.cvx-skills');
    for (const e of skillEntries(c)) {
      const play: HTMLElement = h(
        'button.cvx-play',
        {
          title: tr('Показать демо навыка', 'Play skill demo'),
          onclick: () => {
            sfx('select');
            runDemo(e);
          },
        },
        '▶',
      );
      playBtns.set(e.id, play);
      list.append(
        h(
          'div.cvx-skill',
          { style: `--sc:${hex(e.color)}`, 'data-id': e.id },
          h('div.cvx-skill-icon', iconImg('sk_' + e.icon, e.color, 'icon'), h('span.cvx-key', e.key)),
          h(
            'div.cvx-skill-body',
            h('div.cvx-skill-head', h('b', e.name), h('span.cvx-kind', e.kind)),
            h('p.cvx-desc', e.desc),
            h('div.cvx-params', ...e.params.map(([k, v, col]) => h('span.cvx-param', h('i', k), h('b', col ? { style: `color:${col}` } : null, v)))),
            e.chips.length ? h('div.cvx-chips', ...e.chips.map((x) => h('span', x))) : null,
          ),
          play,
        ),
      );
    }
    panel.append(
      h('div.cvx-head', { style: `--hc:${hex(c.color)}` }, h('div.cvx-name', L(c.name)), h('div.cvx-title', L(c.title))),
      h('div.cv-status' + (unlocked ? '.ok' : '.locked'), unlocked ? '✓ ' + t('cv_unlocked') : '🔒 ' + (ach ? t('unlock_by', { name: L(ach.name), desc: L(ach.desc) }) : t('locked'))),
      ...(wins ? [h('div.kv', h('span', t('cv_wins')), h('span', String(wins)))] : []),
      h('div.cv-sec', tr('Навыки и демо', 'Skills and demos')),
      h('div.cvx-note', tr('▶ — полное демо в отдельной сцене: анимации, эффекты, снаряды, призывы. Без урона и без влияния на игру.', '▶ — a full demo in a separate scene: animations, effects, projectiles, summons. No damage, no effect on the game.')),
      list,
      h('details.cvx-sheet', h('summary', tr('Описание класса', 'Class sheet')), classInfo(c, profile.data.settings.keybinds)),
    );
  };

  const showHero = (id: ClassId) => {
    const c = CLASS_BY_ID[id];
    if (!c) return;
    stopDemo();
    lastDemo = null;
    lastAnim = null;
    setPaused(false);
    cur = id;
    onHero(id);
    st.setClass(c);
    buildExtra();
    for (const el of strip.children) el.classList.toggle('sel', (el as HTMLElement).dataset.id === id);
    renderPanel(c);
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

  // ---------------------------------------------------------------- view tools
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
    'div.cv.cvx',
    strip,
    h(
      'div.cv-center',
      h(
        'div.cv-stage-wrap',
        st.stage,
        demoBar,
        h('button.cv-nav.prev', { onclick: () => step(-1) }, '‹'),
        h('button.cv-nav.next', { onclick: () => step(1) }, '›'),
        h('div.cv-hint', tr('ЛКМ — вращать · колесо — масштаб · ←/→ — класс · T — вращение · R — сброс', 'LMB — rotate · wheel — zoom · ←/→ — class · T — turntable · R — reset')),
      ),
      tools,
      st.anims,
    ),
    panel,
  );
  showHero(cur);
  viewer.play('idle');
  viewer.start();
  return {
    el,
    dispose() {
      window.clearInterval(tick);
      window.removeEventListener('keydown', onKey);
      hideTip();
      sb = null;
      // CharacterViewer.dispose detaches (and disposes) the demo sandbox, then frees the WebGL context
      st.dispose();
    },
  };
}
