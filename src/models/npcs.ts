import type { VoxelModel } from '../data/types';
import { biped, Mob, PX, shadeHex, type BipedOpts, type BipedRig } from './builders';
import type { BoxPaint } from '../render/creatureSkins';

/**
 * Friendly NPC models (villagers, traders, guards...): pixel-skinned bipeds with natural skin
 * tones, warm clothes and soft dark eyes, so they never read as hostile mobs.
 */

const wood = (c = 0x6a4a2a): BoxPaint => ({ mat: 'wood', seed: c & 15 });
const STEEL = 0xb8bcc4;
const GOLD = 0xe0b040;

const SKIN = { fair: 0xf0c8a4, light: 0xe2b48c, tan: 0xc8946a, brown: 0x9a6a46, dark: 0x7a5034 };

type Opts = Omit<BipedOpts, 'face'> & { eye?: number; blush?: number };

function person(o: Opts, deco: (m: Mob, r: BipedRig) => void, scale = PX): VoxelModel {
  const m = new Mob();
  const r = biped(m, {
    ...o,
    face: { style: 'cute', eye: o.eye ?? 0x3a2414, alt: o.blush ?? shadeHex(o.skin, 0.88), glow: false },
    bodyPaint: { mat: 'cloth', ...o.bodyPaint },
  });
  deco(m, r);
  return m.build(scale, { gait: { leg: 0.5, arm: 0.4, roll: 0.05 } });
}

/** Simple brimmed hat: crown + brim. */
function hat(m: Mob, r: BipedRig, crown: number, brim: number, h = 3, brimW = 12, mat: BoxPaint['mat'] = 'cloth') {
  m.box(0, r.headTop - 1, 0, brimW, 1, brimW, brim, 'head', { mat });
  m.box(0, r.headTop, 0, 8, h, 8, crown, 'head', { mat });
}

function belt(m: Mob, r: BipedRig, c = 0x4a3020, buckle = GOLD) {
  m.box(0, r.legH, 0, r.bodyW + 0.4, 1.5, r.bodyD + 0.4, c, 'body', { mat: 'leather' });
  m.box(0, r.legH, r.bodyD / 2 + 0.3, 2, 1.5, 0.4, buckle, 'body', { mat: 'gold' });
}

function apron(m: Mob, r: BipedRig, c: number, low = 5) {
  m.box(0, low, r.bodyD / 2 + 0.4, r.bodyW - 2, r.bodyTop - low - 4, 0.6, c, 'body', { mat: 'leather' });
}

const villagerM = person(
  { skin: SKIN.light, shirt: 0x5a8a4a, pants: 0x6a5038, shoes: 0x3a2818, sleeve: 0x5a8a4a, hair: { color: 0x6a3a1a, rows: 2 } },
  (m, r) => belt(m, r, 0x5a3a20, 0x8a8a8a),
);

const villagerF = person(
  { skin: SKIN.fair, shirt: 0xb84a4a, pants: 0x8a3a3a, robe: 2, robeColor: 0x9a5a7a, robePaint: { accent: 0xf0e0c0 }, hair: { color: 0xc8842a, rows: 3, back: true } },
  (m, r) => {
    m.box(0, r.headY - 1, -4.5, 6, 7, 1, 0xc8842a, 'head', { mat: 'fur' }); // long hair down the back
    m.box(0, 6, r.bodyD / 2 + 1.2, 6, 10, 0.6, 0xf0e8d8, 'body', { mat: 'cloth' }); // white apron
    m.box(0, r.headTop, 0, 8.6, 1, 8.6, 0xf0e8d8, 'head', { mat: 'cloth' });
  },
);

const farmer = person(
  { skin: SKIN.tan, shirt: 0xd8c8a0, pants: 0x4a6a9a, shoes: 0x4a3018, hair: { color: 0x8a5a2a, rows: 1 } },
  (m, r) => {
    // overall straps and a big straw hat
    m.box(0, r.legH, r.bodyD / 2 + 0.3, 6, 6, 0.4, 0x4a6a9a, 'body', { mat: 'cloth' });
    m.pair(2, r.legH + 6, r.bodyD / 2 + 0.3, 1, 6, 0.4, 0x4a6a9a, 'body', { mat: 'cloth' });
    hat(m, r, 0xe8d070, 0xd8c060, 3, 14, 'wood');
    m.box(0, r.headTop, 0, 8.4, 1, 8.4, 0xb83a2a, 'head', { mat: 'cloth' });
    m.box(-r.armX, -2, 3, 1, 18, 1, 0x8a6a3a, 'armR', wood());
    m.box(-r.armX, 15, 4, 1, 1, 4, 0x9a9aa0, 'armR', { mat: 'metal' });
  },
);

const smith = person(
  { skin: SKIN.brown, shirt: 0x8a6a4a, pants: 0x3a3430, shoes: 0x2a2018, sleeve: SKIN.brown, body: [10, 12, 5], arm: [5, 12, 5], hair: { color: 0x1a1410, rows: 1 } },
  (m, r) => {
    apron(m, r, 0x5a3a20, 4);
    m.box(0, r.headY, 4.4, 6, 2, 1, 0x2a1a10, 'head', { mat: 'fur' }); // short beard
    m.box(-r.armX, 9, 3.5, 1.4, 9, 1.4, 0x6a4a2a, 'armR', wood());
    m.box(-r.armX, 17, 3.5, 2, 3, 5, 0x5a5a62, 'armR', { mat: 'metal' });
  },
);

const merchant = person(
  { skin: SKIN.light, shirt: 0x7a2a6a, pants: 0x3a2a4a, robe: 3, robeColor: 0x6a2a5a, robePaint: { accent: GOLD }, bodyPaint: { front: 'buttons', accent: GOLD }, sleeve: 0x8a3a7a, hair: { color: 0x3a2a1a, rows: 1 } },
  (m, r) => {
    belt(m, r, 0xc89a3a, 0xf0e0a0);
    m.box(0, r.headTop - 1, 0, 11, 1, 11, 0x5a1a4a, 'head', { mat: 'cloth' });
    m.box(0, r.headTop, 0, 8, 3, 8, 0x7a2a6a, 'head', { mat: 'cloth', bands: [[1, GOLD, 'gold']] });
    m.box(3, r.headTop + 2, -2, 1, 4, 2, 0x2aa86a, 'head', { mat: 'plain' }); // feather
    m.box(0, r.headY - 1, 4.4, 4, 2, 1, 0x3a2a1a, 'head', { mat: 'fur' });
    m.box(r.armX, 10, 3, 3, 3, 3, 0xc89a3a, 'armL', { mat: 'leather' }); // coin purse
  },
);

const mage = person(
  { skin: SKIN.fair, shirt: 0x3a4aa8, pants: 0x2a3a8a, robe: 1, robePaint: { accent: 0xe8d070 }, bodyPaint: { front: 'trim', accent: 0xe8d070 }, hair: { color: 0xd8d8e0, rows: 1 } },
  (m, r) => {
    m.box(0, r.headY - 3, 4.4, 6, 5, 1, 0xe8e8f0, 'head', { mat: 'fur' }); // white beard
    m.box(0, r.headTop - 1, 0, 12, 1, 12, 0x2a3a98, 'head', { mat: 'cloth' });
    m.box(0, r.headTop, 0, 8, 3, 8, 0x3a4aa8, 'head', { mat: 'cloth', bands: [[1, 0xe8d070, 'gold']] });
    m.box(0, r.headTop + 3, -0.5, 5, 3, 5, 0x3a4aa8, 'head', { mat: 'cloth' });
    m.box(0.5, r.headTop + 6, -1.5, 2, 3, 2, 0x3a4aa8, 'head', { mat: 'cloth' });
    m.box(-r.armX, -2, 3, 1.4, 20, 1.4, 0x8a6a3a, 'armR', wood());
    m.box(-r.armX, 18, 3, 3, 4, 3, 0x6ad8ff, 'armR', { mat: 'crystal', glow: 0.8 });
  },
);

function guard(o: { tabard: number; trim: number; helm: number; skin: number; fur?: number; turban?: number }) {
  return person(
    { skin: o.skin, shirt: o.tabard, pants: 0x5a5a62, shoes: 0x3a2a1a, sleeve: 0x8a8e96, armPaint: { mat: 'metal' }, legPaint: { mat: 'metal' },
      bodyPaint: { front: 'cross', accent: o.trim, bands: [[1, 0x3a2a1a, 'leather']] }, hair: { color: o.helm, rows: 3, mat: 'metal', back: true } },
    (m, r) => {
      if (o.turban !== undefined) {
        m.box(0, r.headTop - 1, 0, 9, 3, 9, o.turban, 'head', { mat: 'cloth', bands: [[1, o.trim, 'gold']] });
        m.box(0, r.headTop + 2, 0, 3, 2, 3, o.helm, 'head', { mat: 'metal' });
      } else {
        m.box(0, r.headTop, 0, 9, 1, 9, o.helm, 'head', { mat: 'metal' });
        m.box(0, r.headTop + 1, 0, 2, 2, 6, o.trim, 'head', { mat: 'cloth' }); // crest
      }
      if (o.fur !== undefined) m.box(0, r.bodyTop - 3, -0.5, r.bodyW + 5, 3, r.bodyD + 3, o.fur, 'body', { mat: 'fur' });
      else m.pair(r.armX, r.bodyTop - 2, 0, 5, 3, 5, o.helm, 'armL', { mat: 'metal' });
      belt(m, r);
      // halberd
      m.box(-r.armX, -1, 3, 1, 28, 1, 0x6a4a2a, 'armR', wood());
      m.box(-r.armX, 27, 3, 1, 4, 1, STEEL, 'armR', { mat: 'metal' });
      m.box(-r.armX, 22, 4.5, 1, 4, 2, STEEL, 'armR', { mat: 'metal' });
      m.box(-r.armX, 23, 1.5, 1, 2, 2, STEEL, 'armR', { mat: 'metal' });
    },
  );
}

const priest = person(
  { skin: SKIN.light, shirt: 0xf0ece0, pants: 0xd8d4c8, robe: 1, robePaint: { accent: GOLD }, bodyPaint: { front: 'cross', accent: GOLD }, hair: { color: 0x8a8a8a, rows: 1 } },
  (m, r) => {
    m.box(0, r.bodyTop - 2, 0, 10, 2, 6, GOLD, 'body', { mat: 'gold' });
    m.box(0, r.headTop, 0, 8.4, 1, 8.4, 0xf0ece0, 'head', { mat: 'cloth' });
    m.box(r.armX, 10, 3.5, 3, 4, 2, 0x8a3a2a, 'armL', { mat: 'leather' }); // holy book
  },
);

const noble = person(
  { skin: SKIN.fair, shirt: 0x2a3a8a, pants: 0xe8e0d0, shoes: 0x1a1a1a, sleeve: 0x2a3a8a, bodyPaint: { front: 'buttons', accent: GOLD }, hair: { color: 0xe8c870, rows: 2 } },
  (m, r) => {
    m.box(0, 3, -r.bodyD / 2 - 0.8, r.bodyW + 3, r.bodyTop - 4, 1, 0xa82a2a, 'body', { mat: 'cloth', bands: [[1, GOLD, 'gold']] }); // cape
    m.box(0, r.bodyTop - 2, -0.5, r.bodyW + 4, 2, r.bodyD + 3, 0xf0f0f0, 'body', { mat: 'fur' });
    m.box(0, r.headTop, 0, 8.4, 2, 8.4, GOLD, 'head', { mat: 'gold', front: 'gem', accent: 0xc83a3a });
    m.pair(3, r.headTop + 2, 3, 1, 1, 1, GOLD, 'head', { mat: 'gold' });
    belt(m, r, 0x1a1a1a);
  },
);

const hunter = person(
  { skin: SKIN.tan, shirt: 0x4a6a34, pants: 0x5a4a30, shoes: 0x3a2818, hair: { color: 0x3a6a2a, rows: 2, mat: 'cloth', back: true } },
  (m, r) => {
    m.box(0, r.headTop, -1, 6, 2, 6, 0x3a6a2a, 'head', { mat: 'cloth' });
    m.box(0, r.headTop - 3, -4.6, 6, 4, 1, 0x3a6a2a, 'head', { mat: 'cloth' });
    belt(m, r, 0x5a3a20, 0x8a8a8a);
    m.box(r.armX, 8, 4, 1, 16, 1, 0x7a5030, 'armL', wood());
    m.box(r.armX, 9, 3, 0.4, 14, 0.4, 0xe8e0d0, 'armL', { mat: 'plain' });
    m.box(1.5, r.bodyTop - 8, -3, 3, 9, 2, 0x6a4a2a, 'body', { mat: 'leather' });
    m.box(1.5, r.bodyTop + 1, -3, 2, 2, 1, 0xf0f0f0, 'body', { mat: 'plain' });
  },
);

const miner = person(
  { skin: SKIN.light, shirt: 0x9a6a3a, pants: 0x4a4a52, shoes: 0x2a2018, hair: { color: 0x5a3a1a, rows: 1 } },
  (m, r) => {
    m.box(0, r.headY - 1, 4.4, 6, 3, 1, 0x5a3a1a, 'head', { mat: 'fur' });
    m.box(0, r.headTop - 1, 0, 9.4, 3, 9.4, 0xd8a83a, 'head', { mat: 'metal' });
    m.box(0, r.headTop - 0.5, 5, 2, 2, 1, 0xfff0a0, 'head', { mat: 'glow' }); // lamp
    m.pair(2, r.legH, r.bodyD / 2 + 0.3, 1, r.bodyTop - r.legH, 0.4, 0x5a3a20, 'body', { mat: 'leather' });
    // pickaxe
    m.box(-r.armX, 9, 3.5, 1.2, 12, 1.2, 0x7a5a3a, 'armR', wood());
    m.box(-r.armX, 20, 3.5, 1, 1.5, 9, 0x8a8e96, 'armR', { mat: 'metal' });
  },
);

const caravaneer = person(
  { skin: SKIN.brown, shirt: 0xe8d8b0, pants: 0xc8a870, shoes: 0x6a4a2a, robe: 3, robeColor: 0xd8c08a, robePaint: { accent: 0x2a6a9a }, sleeve: 0xe8d8b0 },
  (m, r) => {
    m.box(0, r.headTop - 1, 0, 9, 3, 9, 0xf0e8d0, 'head', { mat: 'cloth', bands: [[1, 0x2a6a9a, 'cloth']] });
    m.box(0, r.headTop + 2, -0.5, 6, 2, 6, 0xf0e8d0, 'head', { mat: 'cloth' });
    m.box(0, r.bodyTop - 3, 0, 10, 3, 6, 0x2a6a9a, 'body', { mat: 'cloth' }); // scarf
    m.box(0, r.headY, 4.4, 5, 1, 1, 0x1a1410, 'head', { mat: 'fur' });
    m.box(0, r.legH + 1, -4, 7, 8, 3, 0x8a5a30, 'body', { mat: 'leather', bands: [[1, 0x5a3a20, 'leather']] }); // pack
  },
);

const innkeeper = person(
  { skin: SKIN.fair, shirt: 0xe8e0d0, pants: 0x5a4030, shoes: 0x3a2818, body: [10, 12, 6], sleeve: 0xe8e0d0, hair: { color: 0xa83a1a, rows: 1 } },
  (m, r) => {
    m.box(0, r.headY - 1, 4.4, 8, 2, 1, 0xa83a1a, 'head', { mat: 'fur' }); // moustache
    apron(m, r, 0xf0ece0, 5);
    m.box(0, r.bodyTop - 4, 0, r.bodyW + 0.4, 4, r.bodyD + 0.4, 0x7a2a1a, 'body', { mat: 'cloth' }); // vest top
    m.box(-r.armX, 12, 4, 3, 4, 3, 0x9a6a3a, 'armR', { mat: 'wood', bands: [[1, 0x5a5a62, 'metal']] }); // mug
    m.box(-r.armX, 16, 4, 3, 1, 3, 0xf8f4e8, 'armR', { mat: 'snow' });
  },
);

const alchemist = person(
  { skin: SKIN.light, shirt: 0x5a3a7a, pants: 0x3a2a4a, robe: 2, robeColor: 0x4a6a3a, robePaint: { accent: 0xc8e070 }, hair: { color: 0xe8e8e8, rows: 2, back: true } },
  (m, r) => {
    // goggles on the brow
    m.box(0, r.headY + 5, 0, 8.6, 1, 8.6, 0x5a3a20, 'head', { mat: 'leather' });
    m.pair(2, r.headY + 4.5, 4.5, 3, 2, 1, 0xc89a3a, 'head', { mat: 'copper' });
    m.pair(2, r.headY + 5, 5, 2, 1, 0.6, 0x6ae8c8, 'head', { mat: 'crystal' });
    // potion belt
    belt(m, r, 0x5a3a20, 0x8a8a8a);
    m.box(-3, r.legH - 2, r.bodyD / 2 + 0.6, 2, 3, 1.4, 0xe84a4a, 'body', { mat: 'crystal' });
    m.box(0, r.legH - 2, r.bodyD / 2 + 0.6, 2, 3, 1.4, 0x4ae86a, 'body', { mat: 'crystal' });
    m.box(3, r.legH - 2, r.bodyD / 2 + 0.6, 2, 3, 1.4, 0x4a8ae8, 'body', { mat: 'crystal' });
    m.box(r.armX, 11, 3.5, 2, 4, 2, 0xd84ad8, 'armL', { mat: 'crystal' });
  },
);

const elder = person(
  { skin: SKIN.light, shirt: 0x7a6a4a, pants: 0x5a4a3a, robe: 2, robeColor: 0x6a5a40, robePaint: { accent: 0xc8b890 }, hunch: 1, hair: { color: 0xe8e8e8, rows: 2, back: true } },
  (m, r) => {
    m.box(0, r.headY - 4, r.headZ + 4.4, 6, 7, 1, 0xf0f0f0, 'head', { mat: 'fur' });
    m.box(0, r.headY + 6, r.headZ + 4.4, 7, 1, 0.6, 0xf0f0f0, 'head', { mat: 'fur' });
    m.box(-r.armX, 0, 4, 1.4, 14, 1.4, 0x6a4a2a, 'armR', wood());
    m.box(-r.armX, 14, 3, 1.4, 1.4, 3, 0x6a4a2a, 'armR', wood());
  },
);

const child = person(
  { skin: SKIN.fair, shirt: 0xe8a83a, pants: 0x4a6a9a, shoes: 0x5a3a20, head: [9, 9, 9], body: [7, 8, 4], arm: [3, 8, 3], leg: [3, 7, 3], hand: 2, shoe: 1, hair: { color: 0x8a5a2a, rows: 2 } },
  (m, r) => m.box(0, r.headTop, -1, 4, 2, 4, 0x8a5a2a, 'head', { mat: 'fur' }),
  PX * 0.8,
);

export const NPC_MODELS: Record<string, VoxelModel> = {
  npc_villager_m: villagerM,
  npc_villager_f: villagerF,
  npc_farmer: farmer,
  npc_smith: smith,
  npc_merchant: merchant,
  npc_mage: mage,
  npc_guard: guard({ tabard: 0x2a4aa8, trim: 0xe8c050, helm: 0x9a9ea8, skin: SKIN.light }),
  npc_guard_north: guard({ tabard: 0x4a5a6a, trim: 0xe8e8f0, helm: 0x7a7e86, skin: SKIN.fair, fur: 0xd8d0c0 }),
  npc_guard_desert: guard({ tabard: 0xc8a060, trim: 0xb83a2a, helm: 0xc8a050, skin: SKIN.brown, turban: 0xf0e8d0 }),
  npc_noble: noble,
  npc_priest: priest,
  npc_hunter: hunter,
  npc_miner: miner,
  npc_caravaneer: caravaneer,
  npc_innkeeper: innkeeper,
  npc_alchemist: alchemist,
  npc_elder: elder,
  npc_child: child,
};
