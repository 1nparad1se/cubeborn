import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { ContinentIO, RGBAImage } from './data';

/** Node reader of the continent files (tests and tools): the same files the game fetches. */
export function nodeIO(dir: string): ContinentIO {
  return {
    json: async (p) => JSON.parse(readFileSync(join(dir, p), 'utf8')),
    bin: async (p) => {
      const b = readFileSync(join(dir, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    },
    image: async (p) => decodeRGB8(readFileSync(join(dir, p))),
  };
}

/** Minimal PNG decoder for 8-bit RGB / RGBA (the continent atlases and maps), returned as RGBA. */
export function decodeRGB8(buf: Buffer): RGBAImage {
  let o = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('only 8-bit PNG');
      ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const ch = ct === 2 ? 3 : ct === 6 ? 4 : ct === 0 ? 1 : 0;
  if (!ch) throw new Error('unsupported PNG colour type ' + ct);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0;
      const b = y ? px[dst - stride + x] : 0;
      const c = x >= ch && y ? px[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + x] = v & 255;
    }
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ch === 1) out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i];
    else for (let k = 0; k < 3; k++) out[i * 4 + k] = px[i * ch + k];
    out[i * 4 + 3] = ch === 4 ? px[i * 4 + 3] : 255;
  }
  return { w, h, data: out };
}
