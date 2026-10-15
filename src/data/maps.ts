import type { MapDef } from './types';

/**
 * The one persistent world: Greenvale, a 250×250 grass meadow with scattered trees and a
 * small river on its eastern side. The layout is hand-placed (see game/map/greenvale.ts) and
 * is identical on every launch.
 */
export const GREENVALE: MapDef = {
  id: 'greenvale',
  name: { ru: 'Зелёный Дол', en: 'Greenvale' },
  desc: { ru: 'Тихая долина: трава, рощи и речка на востоке.', en: 'A quiet vale of grass, groves and a small river to the east.' },
  size: 250,
  generator: 'meadow',
  palette: {
    sky: 0x9fd2ec, fog: 0xa8d0c8, fogNear: 30, fogFar: 64, ambient: 0xd6ecff, ambientIntensity: 0.6,
    sun: 0xfff1d6, sunIntensity: 1.2, hemiGround: 0x5a7a34,
    tiles: {
      grass: [0x6aa842, 0x70ad46, 0x64a23f],
      grass2: [0x78b44c, 0x7eb952],
      bank: [0x8fae5a, 0x96b360],
      sand: [0xd8c48a, 0xd0bb82, 0xdccb92],
      water: [0x2fa3c8, 0x34aad0],
    },
    blocks: { trunk: [0x6a4a2c, 0x76522f], leaves: [0x4f8a34, 0x5a9a3a, 0x467e2e, 0x6aa63e], birch: [0xe8e4d8, 0xd8d2c4], pine: [0x2f6a3a, 0x36743f] },
  },
  music: { root: 45, scale: 'dorian', tempo: 100, mood: 'forest' },
};
