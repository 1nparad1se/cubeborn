import { h, clear } from './dom';
import { t, LANGS, setLang, type Lang } from '../i18n';
import { keyName } from '../input/Input';
import { QUALITY_PRESETS, defaultKeybinds, type BindAction, type Quality, type Settings } from '../meta/Save';
import { confirmBox, type MenuApi } from './Menus';
import { dev } from '../dev/DevMode';

const RESOLUTIONS: [number, number][] = [
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
];

/** Resolutions that fit the current monitor (in physical pixels). */
export function availableResolutions(): string[] {
  const dpr = window.devicePixelRatio || 1;
  const sw = Math.round((window.screen?.width || 1920) * dpr);
  const sh = Math.round((window.screen?.height || 1080) * dpr);
  const out = RESOLUTIONS.filter(([w, hh]) => w <= sw && hh <= sh).map(([w, hh]) => `${w}x${hh}`);
  return out.length ? out : ['1280x720'];
}

type Tab = 'video' | 'graphics' | 'gameplay' | 'audio' | 'controls' | 'other' | 'developer';
let lastTab: Tab = 'video';

const SUB_KEYS = ['shadows', 'effects', 'particles', 'viewDistance', 'antiAliasing', 'textures', 'postProcessing'] as const;

/** Tabbed settings, shared by the main menu and the pause menu. */
export function settingsPanel(api: MenuApi, rerender: () => void, inRun = false): HTMLElement {
  const s = api.profile.data.settings;
  const save = () => {
    api.profile.saveSoon();
    api.applySettings();
  };
  const body = h('div.set-body');
  const tabs = h('div.tabs.set-tabs');
  const note = h('div.set-note');

  // ---- control builders
  const row = (label: string, control: HTMLElement, hint?: string) => h('div.set-row', h('span.set-label', label, hint ? h('small', hint) : null), control);
  const slider = (label: string, get: () => number, set: (v: number) => void, fmt = (v: number) => Math.round(v * 100) + '%', min = 0, max = 100, k = 100) => {
    const val = h('span.val', fmt(get()));
    const input = h('input', { type: 'range', min, max, value: Math.round(get() * k) }) as HTMLInputElement;
    input.addEventListener('input', () => {
      set(Number(input.value) / k);
      val.textContent = fmt(get());
      save();
    });
    return row(label, h('div.slider', input, val));
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void, hint?: string) => {
    const b = h('button.toggle' + (get() ? '.on' : ''), {
      onclick: () => {
        set(!get());
        b.classList.toggle('on', get());
        b.textContent = get() ? t('on') : t('off');
        api.sfx('ui');
        save();
      },
    }, get() ? t('on') : t('off'));
    return row(label, b, hint);
  };
  const seg = <T extends string | number>(label: string, opts: { id: T; name: string }[], get: () => T, set: (v: T) => void, hint?: string) => {
    const box = h('div.seg');
    const draw = () => {
      clear(box);
      for (const o of opts)
        box.append(
          h('button' + (o.id === get() ? '.sel' : ''), {
            onclick: () => {
              api.sfx('ui');
              set(o.id);
              save();
              draw();
            },
          }, o.name),
        );
    };
    draw();
    return row(label, box, hint);
  };
  /** Changing any graphics sub-setting turns the preset into "custom". */
  const sub = <K extends (typeof SUB_KEYS)[number]>(key: K) => (v: Settings[K]) => {
    s[key] = v;
    s.quality = 'custom';
    renderTab();
  };
  const lv3 = [
    { id: 'low' as const, name: t('q_low') },
    { id: 'medium' as const, name: t('q_medium') },
    { id: 'high' as const, name: t('q_high') },
  ];

  /** Two key slots for an action; a key belongs to one action only. */
  const bindRow = (a: BindAction) => {
    const all = Object.keys(defaultKeybinds()) as BindAction[];
    const keys = h('div.binds');
    for (let slot = 0; slot < 2; slot++) {
      const code = s.keybinds[a][slot] ?? '';
      const b = h('button.bind' + (code ? '' : '.empty'), {
        onclick: () => {
          api.sfx('ui');
          b.textContent = t('press_key');
          b.classList.add('wait');
          api.captureKey((c) => {
            if (c !== 'Escape' || a === 'pause') {
              if (c === 'Backspace' || c === 'Delete') s.keybinds[a].splice(slot, 1);
              else {
                for (const other of all) s.keybinds[other] = s.keybinds[other].filter((k) => k !== c);
                const list = s.keybinds[a];
                if (slot < list.length) list[slot] = c;
                else list.push(c);
              }
              save();
            }
            renderTab();
          });
        },
      }, code ? keyName(code) : '—');
      keys.append(b);
    }
    return row(t('bind_' + a), keys);
  };

  const renderTab = () => {
    clear(body);
    clear(note);
    if (api.needsRestart()) note.append(t('set_restart_note'));
    switch (lastTab) {
      case 'video': {
        const res = availableResolutions();
        body.append(
          seg(t('set_display'), [
            { id: 'windowed', name: t('dm_windowed') },
            { id: 'fullscreen', name: t('dm_fullscreen') },
            { id: 'borderless', name: t('dm_borderless') },
          ], () => s.displayMode, (v) => (s.displayMode = v), t('set_display_hint')),
          seg(t('set_resolution'), [{ id: 'native', name: t('res_native') }, ...res.map((r) => ({ id: r, name: r.replace('x', '×') }))], () => (s.resolution === 'native' || res.includes(s.resolution) ? s.resolution : 'native'), (v) => (s.resolution = v), t('set_resolution_hint')),
          toggle(t('set_vsync'), () => s.vsync, (v) => (s.vsync = v)),
          seg(t('set_fps_limit'), [30, 60, 120, 144, 165, 240, 0].map((n) => ({ id: n, name: n ? String(n) : '∞' })), () => s.fpsLimit, (v) => (s.fpsLimit = v)),
          slider(t('set_shake'), () => s.screenShake, (v) => (s.screenShake = v)),
        );
        break;
      }
      case 'graphics':
        body.append(
          seg<Quality>(t('set_quality'), [
            { id: 'low', name: t('q_low') },
            { id: 'medium', name: t('q_medium') },
            { id: 'high', name: t('q_high') },
            { id: 'ultra', name: t('q_ultra') },
            ...(s.quality === 'custom' ? [{ id: 'custom' as Quality, name: t('q_custom') }] : []),
          ], () => s.quality, (v) => {
            s.quality = v;
            if (v !== 'custom') Object.assign(s, QUALITY_PRESETS[v]);
            renderTab();
          }),
          seg(t('set_shadows'), [{ id: 'off' as const, name: t('off') }, ...lv3], () => s.shadows, sub('shadows')),
          seg(t('set_effects'), lv3, () => s.effects, sub('effects')),
          seg(t('set_particles'), lv3, () => s.particles, sub('particles')),
          seg(t('set_view_distance'), [
            { id: 'near', name: t('vd_near') },
            { id: 'medium', name: t('vd_medium') },
            { id: 'far', name: t('vd_far') },
            { id: 'max', name: t('vd_max') },
          ], () => s.viewDistance, sub('viewDistance')),
          seg(t('set_aa'), [
            { id: 'off', name: t('off') },
            { id: 'msaa', name: 'MSAA' },
            { id: 'ssaa', name: 'MSAA + SSAA' },
          ], () => s.antiAliasing, sub('antiAliasing'), t('set_aa_hint')),
          seg(t('set_textures'), lv3, () => s.textures, sub('textures')),
          toggle(t('set_post'), () => s.postProcessing, sub('postProcessing'), t('set_post_hint')),
        );
        break;
      case 'gameplay':
        body.append(
          toggle(t('set_numbers'), () => s.damageNumbers, (v) => (s.damageNumbers = v)),
          seg(t('set_hpbars'), [
            { id: 'off', name: t('off') },
            { id: 'elites', name: t('hp_elites') },
            { id: 'all', name: t('hp_all') },
          ], () => s.enemyHealthBars, (v) => (s.enemyHealthBars = v)),
          toggle(t('set_minimap'), () => s.showMinimap, (v) => (s.showMinimap = v)),
          toggle(t('set_wave_counter'), () => s.showWaveCounter, (v) => (s.showWaveCounter = v)),
          toggle(t('set_fps'), () => s.showFps, (v) => (s.showFps = v)),
          toggle(t('set_enemy_count'), () => s.showEnemyCount, (v) => (s.showEnemyCount = v)),
          toggle(t('set_autopause'), () => s.autoPause, (v) => (s.autoPause = v)),
          slider(t('set_zoom'), () => s.cameraZoom, (v) => (s.cameraZoom = v), (v) => Math.round(v * 100) + '%', 75, 135),
          seg<Lang>(t('set_lang'), LANGS, () => s.lang, (v) => {
            s.lang = v;
            setLang(v);
            rerender();
          }),
        );
        break;
      case 'audio':
        body.append(
          slider(t('set_master'), () => s.master, (v) => (s.master = v)),
          slider(t('set_music'), () => s.music, (v) => (s.music = v)),
          slider(t('set_sfx'), () => s.sfx, (v) => (s.sfx = v)),
          slider(t('set_ui'), () => s.ui, (v) => (s.ui = v)),
        );
        break;
      case 'controls': {
        for (const a of ['up', 'down', 'left', 'right', 'pause', 'zoomIn', 'zoomOut', 'map'] as BindAction[]) body.append(bindRow(a));
        body.append(
          h('div.set-hint', t('bind_hint')),
          h('div.center', h('button.btn.small', {
            onclick: () => {
              api.sfx('ui');
              s.keybinds = defaultKeybinds();
              save();
              renderTab();
            },
          }, t('bind_reset'))),
        );
        break;
      }
      case 'developer': {
        const on = dev.enabled;
        body.append(
          toggle(t('dev_mode'), () => dev.enabled, (v) => {
            api.setDevMode(v);
            renderTab();
          }, t('dev_mode_hint')),
        );
        if (on) {
          const k = s.keybinds;
          body.append(
            h('div.dev-enabled', '✓ Developer Mode Enabled'),
            h('div.set-hint', t('dev_test_note')),
            h(
              'div.dev-set-btns',
              h('button.btn.small', { onclick: () => api.openDevPanel() }, `${t('dev_open_panel')} (${keyName(k.devPanel[0] ?? '')})`),
              h('button.btn.small', { onclick: () => api.toggleDevDebug() }, `${t('dev_debug_info')} (${keyName(k.devDebug[0] ?? '')})`),
              h('button.btn.small.danger', {
                onclick: () => {
                  dev.resetTestState();
                  renderTab();
                },
              }, 'RESET TEST STATE'),
            ),
            h('div.set-sub', t('dev_hotkeys')),
            bindRow('devPanel'),
            bindRow('devDebug'),
            bindRow('devGod'),
          );
        }
        break;
      }
      case 'other':
        body.append(
          inRun ? h('div.set-hint', t('set_reset_in_run')) : row(t('set_reset'), h('button.btn.danger.small', { onclick: (e: MouseEvent) => confirmReset(e, api) }, t('btn_reset'))),
          h('div.credits', t('credits'), h('br'), api.version),
        );
        break;
    }
  };

  const drawTabs = () => {
    clear(tabs);
    const ids: Tab[] = ['video', 'graphics', 'gameplay', 'audio', 'controls', 'other'];
    if (dev.available) ids.push('developer');
    for (const id of ids)
      tabs.append(
        h('button.tab' + (lastTab === id ? '.sel' : ''), {
          onclick: () => {
            api.sfx('ui');
            lastTab = id;
            drawTabs();
            renderTab();
          },
        }, t('settab_' + id)),
      );
  };
  drawTabs();
  renderTab();
  return h('div.settings', tabs, note, body);
}

function confirmReset(e: MouseEvent, api: MenuApi) {
  confirmBox(e.target as HTMLElement, t('reset_confirm'), () => api.resetProgress());
}
