import { deflateSync, inflateSync } from 'node:zlib';
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) {
  const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
}
/** Encode a PNG. channels: 1 (gray) or 3 (rgb); bitDepth 8 or 16 (16 only for gray). filter 2 (Up) compresses terrain well. */
export function encodePNG(w: number, h: number, data: Uint8Array | Uint16Array, channels: 1 | 3, bitDepth: 8 | 16, filter: 0 | 2 = 2): Buffer {
  const bpp = channels * (bitDepth / 8); const row = w * bpp; const raw = Buffer.alloc((row + 1) * h);
  const bytes = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * channels; x++) {
    const v = data[y * w * channels + x]; const o = y * row + x * (bitDepth / 8);
    if (bitDepth === 16) { bytes[o] = v >> 8; bytes[o + 1] = v & 255; } else bytes[o] = v;
  }
  for (let y = 0; y < h; y++) {
    raw[y * (row + 1)] = filter;
    for (let i = 0; i < row; i++) { const b = bytes[y * row + i]; raw[y * (row + 1) + 1 + i] = filter === 2 && y > 0 ? (b - bytes[(y - 1) * row + i]) & 255 : b; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = bitDepth; ihdr[9] = channels === 1 ? 0 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
}
/** Decode a non-interlaced gray/rgb PNG (8 or 16 bit) written by any encoder. Returns samples (Uint16 for 16-bit). */
export function decodePNG(buf: Buffer): { w: number; h: number; channels: number; bitDepth: number; data: Uint8Array | Uint16Array } {
  let p = 8; const idat: Buffer[] = []; let w = 0, h = 0, bitDepth = 8, ct = 0;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bitDepth = d[8]; ct = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const channels = ct === 0 ? 1 : ct === 2 ? 3 : ct === 6 ? 4 : ct === 4 ? 2 : 1;
  const bpp = channels * bitDepth / 8, row = w * bpp; const raw = inflateSync(Buffer.concat(idat)); const out = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)];
    for (let i = 0; i < row; i++) {
      const x = raw[y * (row + 1) + 1 + i]; const a = i >= bpp ? out[y * row + i - bpp] : 0; const b = y > 0 ? out[(y - 1) * row + i] : 0; const c = i >= bpp && y > 0 ? out[(y - 1) * row + i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[y * row + i] = v & 255;
    }
  }
  if (bitDepth === 16) { const d16 = new Uint16Array(w * h * channels); for (let i = 0; i < d16.length; i++) d16[i] = (out[i * 2] << 8) | out[i * 2 + 1]; return { w, h, channels, bitDepth, data: d16 }; }
  return { w, h, channels, bitDepth, data: new Uint8Array(out) };
}
