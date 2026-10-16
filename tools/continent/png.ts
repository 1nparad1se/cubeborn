import { deflateSync } from 'node:zlib';
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Uint8Array) {
  const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
}
/** Encode a PNG. channels: 1 (gray) or 3 (rgb); bitDepth 8 or 16 (16 only for gray). */
export function encodePNG(w: number, h: number, data: Uint8Array | Uint16Array, channels: 1 | 3, bitDepth: 8 | 16): Buffer {
  const bpp = channels * (bitDepth / 8); const row = w * bpp; const raw = Buffer.alloc((row + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (row + 1)] = 0;
    for (let x = 0; x < w * channels; x++) {
      const v = data[y * w * channels + x]; const o = y * (row + 1) + 1 + x * (bitDepth / 8);
      if (bitDepth === 16) { raw[o] = v >> 8; raw[o + 1] = v & 255; } else raw[o] = v;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = bitDepth; ihdr[9] = channels === 1 ? 0 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]);
}
