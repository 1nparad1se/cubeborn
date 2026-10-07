export const GLYPHS: Record<string, (d: any) => void> = {
  sword: (d) => {
    d.l(3, 12, 11, 4, d.steel);
    d.l(4, 12, 12, 4, d.wh);
    d.l(12, 3, 12, 3, d.wh);
    d.l(2, 10, 6, 14, d.c);
    d.l(3, 13, 1, 15, d.wood);
  },
  fist: (d) => {
    d.r(4, 5, 8, 7, d.c);
    d.r(4, 4, 2, 2, d.lt);
    d.r(7, 4, 2, 2, d.lt);
    d.r(10, 4, 2, 2, d.lt);
    d.r(5, 12, 6, 3, d.dk);
    d.r(2, 7, 2, 3, d.c);
  },
  spear: (d) => {
    d.l(2, 14, 11, 5, d.wood);
    d.l(11, 5, 14, 2, d.steel);
    d.l(12, 5, 14, 3, d.wh);
    d.r(9, 6, 2, 2, d.c);
  },
  dagger: (d) => {
    d.l(4, 11, 10, 5, d.steel);
    d.l(5, 11, 11, 5, d.wh);
    d.l(3, 9, 6, 12, d.c);
    d.l(2, 13, 3, 12, d.wood);
    d.l(8, 14, 13, 9, d.steel);
  },
  staff: (d) => {
    d.l(3, 14, 10, 7, d.wood);
    d.o(11, 5, 2, d.c, true);
    d.p(11, 4, d.wh);
    d.p(13, 2, d.lt);
    d.p(8, 3, d.lt);
  },
  fireball: (d) => {
    d.o(9, 9, 4, d.c, true);
    d.o(9, 9, 2, d.lt, true);
    d.p(9, 9, d.wh);
    d.l(3, 3, 6, 6, d.c);
    d.l(5, 2, 7, 5, d.c);
    d.l(2, 6, 5, 7, d.c);
  },
  shard: (d) => {
    d.l(3, 13, 12, 3, d.c);
    d.l(4, 13, 13, 4, d.lt);
    d.l(3, 12, 12, 2, d.wh);
    d.r(2, 11, 3, 3, d.c);
    d.p(12, 9, d.lt);
    d.p(8, 12, d.lt);
  },
  bow: (d) => {
    d.l(4, 2, 2, 6, d.wood);
    d.l(2, 6, 2, 10, d.wood);
    d.l(2, 10, 4, 14, d.wood);
    d.l(4, 2, 4, 14, d.wh);
    d.l(4, 8, 14, 8, d.steel);
    d.l(12, 6, 14, 8, d.c);
    d.l(12, 10, 14, 8, d.c);
  },
  crossbow: (d) => {
    d.l(2, 6, 8, 2, d.wood);
    d.l(8, 2, 14, 6, d.wood);
    d.l(8, 3, 8, 14, d.wood);
    d.l(2, 6, 14, 6, d.wh);
    d.l(8, 1, 8, 5, d.steel);
    d.r(7, 11, 3, 2, d.c);
  },
  glaive: (d) => {
    d.o(8, 8, 5, d.c, false);
    d.o(8, 8, 4, d.lt, false);
    d.r(7, 7, 3, 3, d.dk);
    d.p(13, 4, d.wh);
    d.p(3, 12, d.wh);
  },
  saw: (d) => {
    d.o(8, 8, 5, d.steel, true);
    d.o(8, 8, 2, d.dk, true);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      d.p(Math.round(8 + Math.cos(a) * 6.5), Math.round(8 + Math.sin(a) * 6.5), d.c);
    }
  },
  wisp: (d) => {
    d.o(8, 7, 3, d.c, true);
    d.o(8, 7, 1, d.wh, true);
    d.l(7, 10, 5, 14, d.lt);
    d.l(9, 10, 10, 14, d.lt);
    d.p(3, 4, d.lt);
    d.p(13, 3, d.lt);
  },
  lightning: (d) => {
    d.l(10, 1, 5, 8, d.c);
    d.l(5, 8, 10, 8, d.c);
    d.l(10, 8, 5, 15, d.c);
    d.l(11, 1, 6, 8, d.lt);
    d.l(9, 9, 6, 14, d.wh);
  },
  chain: (d) => {
    d.l(1, 4, 5, 7, d.c);
    d.l(5, 7, 8, 4, d.c);
    d.l(8, 4, 11, 9, d.c);
    d.l(11, 9, 14, 6, d.c);
    d.p(5, 7, d.wh);
    d.p(11, 9, d.wh);
    d.o(14, 12, 1, d.lt, true);
    d.o(2, 12, 1, d.lt, true);
  },
  beam: (d) => {
    d.l(2, 14, 7, 9, d.wh);
    d.r(7, 6, 4, 4, d.c);
    d.l(11, 6, 14, 2, '#ff6a6a');
    d.l(11, 7, 14, 6, '#6aff8a');
    d.l(11, 9, 14, 10, '#6a9aff');
    d.l(10, 10, 12, 14, '#ffe06a');
  },
  halo: (d) => {
    d.o(8, 6, 5, d.c, false);
    d.o(8, 6, 4, d.lt, false);
    d.p(8, 1, d.wh);
    d.r(6, 11, 4, 4, d.dk);
  },
  heart: (d) => {
    d.r(3, 4, 4, 4, d.c);
    d.r(9, 4, 4, 4, d.c);
    d.r(2, 5, 12, 4, d.c);
    d.r(3, 9, 10, 2, d.c);
    d.r(5, 11, 6, 2, d.c);
    d.r(7, 13, 2, 1, d.c);
    d.r(4, 5, 2, 2, d.wh);
  },
  tornado: (d) => {
    d.l(2, 3, 14, 3, d.c);
    d.l(3, 6, 12, 6, d.lt);
    d.l(5, 9, 11, 9, d.c);
    d.l(6, 12, 9, 12, d.lt);
    d.l(7, 14, 8, 14, d.c);
  },
  flask: (d) => {
    d.r(7, 2, 3, 4, d.wh);
    d.r(6, 1, 5, 1, d.wood);
    d.o(8, 10, 4, d.c, true);
    d.r(5, 9, 7, 1, d.lt);
    d.p(6, 11, d.wh);
  },
  bomb: (d) => {
    d.o(7, 10, 4, '#3a3a44', true);
    d.p(5, 8, '#8a8a9a');
    d.l(9, 6, 11, 3, d.wood);
    d.p(12, 2, d.c);
    d.p(13, 1, '#fff27a');
    d.p(11, 1, '#fff27a');
  },
  mine: (d) => {
    d.r(2, 9, 12, 4, '#4a3a4a');
    d.r(5, 6, 6, 3, d.c);
    d.p(7, 5, d.wh);
    d.p(2, 8, d.lt);
    d.p(13, 8, d.lt);
  },
  meteor: (d) => {
    d.o(10, 10, 3, d.c, true);
    d.o(10, 10, 1, '#fff27a', true);
    d.l(2, 2, 7, 7, d.lt);
    d.l(4, 1, 8, 6, d.c);
    d.l(1, 4, 6, 8, d.c);
  },
  skull: (d) => {
    d.r(4, 3, 8, 7, d.c);
    d.r(3, 5, 10, 4, d.c);
    d.r(5, 10, 6, 3, d.c);
    d.r(5, 6, 2, 2, '#1a1a22');
    d.r(9, 6, 2, 2, '#1a1a22');
    d.p(8, 9, '#1a1a22');
    d.p(6, 12, d.dk);
    d.p(9, 12, d.dk);
  },
  cskull: (d) => {
    GLYPHS.skull(d);
    d.p(6, 6, '#ff4a6a');
    d.p(10, 6, '#ff4a6a');
  },
  rune: (d) => {
    d.r(3, 2, 10, 12, d.dk);
    d.l(8, 3, 8, 12, d.c);
    d.l(5, 5, 8, 8, d.c);
    d.l(11, 5, 8, 8, d.c);
    d.l(5, 11, 11, 11, d.lt);
  },
  nova: (d) => {
    d.o(8, 8, 2, d.wh, true);
    d.l(8, 1, 8, 15, d.c);
    d.l(1, 8, 15, 8, d.c);
    d.l(3, 3, 13, 13, d.lt);
    d.l(13, 3, 3, 13, d.lt);
  },
  // ---- passives
  whetstone: (d) => {
    d.r(2, 8, 12, 5, '#7a7f86');
    d.r(3, 8, 10, 1, '#a0a6ae');
    d.l(4, 6, 12, 2, d.c);
    d.p(13, 1, d.wh);
  },
  charm: (d) => {
    d.l(4, 1, 8, 5, d.wood);
    d.l(12, 1, 8, 5, d.wood);
    d.o(8, 9, 4, d.c, true);
    d.o(8, 9, 2, d.lt, true);
  },
  thorns: (d) => {
    d.r(4, 4, 8, 9, d.c);
    d.r(5, 5, 6, 7, d.lt);
    d.p(3, 3, d.wh);
    d.p(12, 3, d.wh);
    d.p(2, 8, d.wh);
    d.p(13, 8, d.wh);
    d.p(8, 14, d.wh);
  },
  boots: (d) => {
    d.r(5, 2, 5, 9, d.c);
    d.r(5, 10, 9, 4, d.c);
    d.r(5, 4, 5, 1, d.lt);
    d.l(1, 6, 3, 6, d.wh);
    d.l(1, 9, 3, 9, d.wh);
  },
  hourglass: (d) => {
    d.r(3, 1, 10, 2, d.wood);
    d.r(3, 13, 10, 2, d.wood);
    d.l(4, 3, 8, 8, d.wh);
    d.l(12, 3, 8, 8, d.wh);
    d.l(4, 13, 8, 8, d.wh);
    d.l(12, 13, 8, 8, d.wh);
    d.r(6, 10, 4, 3, d.c);
  },
  lens: (d) => {
    d.o(7, 7, 5, d.steel, false);
    d.o(7, 7, 4, d.c, true);
    d.p(5, 5, d.wh);
    d.l(11, 11, 14, 14, d.wood);
  },
  candle: (d) => {
    d.r(6, 7, 4, 8, '#e8e0d0');
    d.p(8, 6, '#3a2a1a');
    d.r(7, 2, 2, 4, d.c);
    d.p(8, 1, '#fff27a');
  },
  target: (d) => {
    d.o(8, 8, 6, d.c, false);
    d.o(8, 8, 3, d.c, false);
    d.p(8, 8, d.wh);
    d.l(8, 0, 8, 3, d.wh);
  },
  gauntlet: (d) => {
    d.r(3, 5, 9, 8, d.steel);
    d.r(3, 3, 2, 3, d.steel);
    d.r(6, 2, 2, 4, d.steel);
    d.r(9, 3, 2, 3, d.steel);
    d.r(3, 12, 9, 2, d.c);
    d.r(4, 7, 7, 1, d.wh);
  },
  feather: (d) => {
    d.l(3, 14, 12, 2, d.wh);
    d.l(5, 11, 11, 3, d.c);
    d.l(5, 9, 10, 2, d.c);
    d.l(7, 12, 13, 4, d.lt);
  },
  plate: (d) => {
    d.r(3, 3, 10, 10, d.steel);
    d.r(3, 3, 10, 2, d.wh);
    d.r(7, 5, 2, 8, d.c);
  },
  eye: (d) => {
    d.l(2, 8, 5, 5, d.c);
    d.l(5, 5, 11, 5, d.c);
    d.l(11, 5, 14, 8, d.c);
    d.l(2, 8, 5, 11, d.c);
    d.l(5, 11, 11, 11, d.c);
    d.l(11, 11, 14, 8, d.c);
    d.o(8, 8, 2, d.lt, true);
    d.p(8, 8, '#1a1a22');
  },
  quiver: (d) => {
    d.r(5, 6, 6, 9, d.wood);
    d.l(6, 6, 4, 1, d.steel);
    d.l(8, 6, 8, 1, d.steel);
    d.l(10, 6, 12, 1, d.steel);
    d.p(4, 1, d.c);
    d.p(8, 1, d.c);
    d.p(12, 1, d.c);
  },
  crystal: (d) => {
    d.l(8, 1, 12, 6, d.c);
    d.l(12, 6, 8, 15, d.c);
    d.l(8, 15, 4, 6, d.c);
    d.l(4, 6, 8, 1, d.c);
    d.r(6, 5, 4, 6, d.lt);
    d.p(7, 4, d.wh);
  },
  moss: (d) => {
    d.r(2, 10, 12, 4, '#6a5a4a');
    d.r(2, 8, 12, 3, d.c);
    d.p(4, 7, d.lt);
    d.p(9, 6, d.lt);
    d.p(12, 7, d.lt);
  },
  magnet: (d) => {
    d.r(3, 3, 3, 10, '#ff4a4a');
    d.r(10, 3, 3, 10, '#4a7aff');
    d.r(3, 3, 10, 3, d.steel);
    d.r(3, 12, 3, 2, d.wh);
    d.r(10, 12, 3, 2, d.wh);
  },
  clover: (d) => {
    d.o(5, 5, 2, d.c, true);
    d.o(11, 5, 2, d.c, true);
    d.o(5, 10, 2, d.c, true);
    d.o(11, 10, 2, d.c, true);
    d.l(8, 8, 9, 15, d.dk);
    d.p(5, 4, d.lt);
  },
  idol: (d) => {
    d.r(5, 2, 6, 5, d.c);
    d.r(4, 7, 8, 6, d.c);
    d.r(3, 13, 10, 2, d.dk);
    d.p(6, 4, '#1a1a22');
    d.p(9, 4, '#1a1a22');
    d.r(5, 8, 2, 2, d.lt);
  },
  fang: (d) => {
    d.l(4, 2, 7, 14, d.wh);
    d.l(5, 2, 8, 12, d.wh);
    d.l(9, 2, 11, 9, d.wh);
    d.r(3, 1, 10, 2, d.c);
    d.p(7, 14, d.c);
  },
  banner: (d) => {
    d.l(3, 1, 3, 15, d.wood);
    d.r(4, 2, 9, 7, d.c);
    d.l(4, 9, 8, 12, d.c);
    d.l(12, 9, 8, 12, d.c);
    d.r(7, 4, 3, 3, d.gold);
  },
  phoenix: (d) => {
    d.l(8, 3, 8, 12, d.c);
    d.l(2, 4, 8, 8, d.lt);
    d.l(14, 4, 8, 8, d.lt);
    d.l(8, 12, 5, 15, d.c);
    d.l(8, 12, 11, 15, d.c);
    d.p(8, 2, '#fff27a');
  },
  // ---- meta
  dice: (d) => {
    d.r(3, 3, 10, 10, d.wh);
    d.p(5, 5, '#1a1a22');
    d.p(10, 5, '#1a1a22');
    d.p(7, 8, '#1a1a22');
    d.p(5, 10, '#1a1a22');
    d.p(10, 10, '#1a1a22');
  },
  skip: (d) => {
    d.l(3, 3, 8, 8, d.c);
    d.l(8, 8, 3, 13, d.c);
    d.l(8, 3, 13, 8, d.c);
    d.l(13, 8, 8, 13, d.c);
  },
  banish: (d) => {
    d.o(8, 8, 6, d.c, false);
    d.l(4, 4, 12, 12, d.c);
  },
  coin: (d) => {
    d.o(8, 8, 5, '#ffd23d', true);
    d.o(8, 8, 3, '#ffe88a', false);
    d.r(7, 6, 2, 4, '#c8961a');
  },
};

