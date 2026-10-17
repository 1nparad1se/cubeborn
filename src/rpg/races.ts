/**
 * Race registry (data-driven). Five races are planned; only humans are playable now. To add a race:
 * add an entry here with `available: true`, its base stats and a skin id that the human-style
 * model builder knows (render/human/skins.ts). Nothing else in the game names races directly.
 */
export interface RaceBase {
  /** Health. */
  maxHp: number;
  /** Flat physical defense. */
  physDef: number;
  /** Walking speed, blocks per second. */
  moveSpeed: number;
  /** Physical damage multiplier (1 = weapon damage as listed). */
  physPower: number;
  /** Magic damage multiplier. */
  magicPower: number;
}

export interface RaceDef {
  id: string;
  name: string;
  /** Short description for character creation. */
  desc: string;
  available: boolean;
  base: RaceBase;
  /** Skin used by the cubic character model. */
  skin: string;
}

const RACES: RaceDef[] = [
  {
    id: 'human',
    name: 'Человек',
    desc: 'Выносливые и разносторонние. Владеют любым оружием и доспехом без штрафов.',
    available: true,
    base: { maxHp: 100, physDef: 0, moveSpeed: 4.6, physPower: 1, magicPower: 1 },
    skin: 'human',
  },
  { id: 'orc', name: 'Орк', desc: 'Скоро.', available: false, base: { maxHp: 120, physDef: 2, moveSpeed: 4.4, physPower: 1.05, magicPower: 0.9 }, skin: 'human' },
  { id: 'light_elf', name: 'Светлый эльф', desc: 'Скоро.', available: false, base: { maxHp: 90, physDef: 0, moveSpeed: 4.8, physPower: 0.95, magicPower: 1.1 }, skin: 'human' },
  { id: 'dark_elf', name: 'Тёмный эльф', desc: 'Скоро.', available: false, base: { maxHp: 92, physDef: 0, moveSpeed: 4.8, physPower: 1.05, magicPower: 1.05 }, skin: 'human' },
  { id: 'dwarf', name: 'Гном', desc: 'Скоро.', available: false, base: { maxHp: 115, physDef: 3, moveSpeed: 4.3, physPower: 1.0, magicPower: 0.95 }, skin: 'human' },
];

export const RACE_BY_ID: Record<string, RaceDef> = Object.fromEntries(RACES.map((r) => [r.id, r]));

/** Races a new character can pick. */
export function playableRaces(): RaceDef[] {
  return RACES.filter((r) => r.available);
}
