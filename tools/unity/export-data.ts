// Dumps all game content to JSON for the Unity port.
import { writeFileSync } from 'node:fs';
import { WEAPONS, WEAPON_MAX_LEVEL } from '../../src/data/weapons';
import { PASSIVES } from '../../src/data/passives';
import { HEROES } from '../../src/data/heroes';
import { ENEMIES, ELITE_MODS } from '../../src/data/enemies';
import { BOSSES, RELICS } from '../../src/data/bosses';
import { MAPS } from '../../src/data/maps';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { PERM_UPGRADES } from '../../src/data/upgrades';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { ENEMY_MODELS, HERO_MODELS, ALLY_MODELS, BOSS_MODELS, PROJECTILE_MODELS, PICKUP_MODELS } from '../../src/models';
import { RU } from '../../src/i18n/ru';
import { EN } from '../../src/i18n/en';

const out = process.argv[2];
const data = {
  weaponMaxLevel: WEAPON_MAX_LEVEL,
  weapons: WEAPONS, passives: PASSIVES, heroes: HEROES, enemies: ENEMIES,
  elites: Object.entries(ELITE_MODS).map(([id, m]) => ({ id, ...m })),
  bosses: BOSSES, relics: RELICS, maps: MAPS, difficulties: DIFFICULTIES,
  upgrades: PERM_UPGRADES, achievements: ACHIEVEMENTS,
};
writeFileSync(out + '/content.json', JSON.stringify(data));
const models = { enemy: ENEMY_MODELS, hero: HERO_MODELS, ally: ALLY_MODELS, boss: BOSS_MODELS, projectile: PROJECTILE_MODELS, pickup: PICKUP_MODELS };
writeFileSync(out + '/models.json', JSON.stringify(models));
writeFileSync(out + '/i18n.json', JSON.stringify({ ru: RU, en: EN }));
