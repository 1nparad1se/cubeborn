import { item } from '../rpg/items';
import { SPR_BOW, SPR_SPEAR, SPR_STAFF1H, SPR_STAFF2H, SPR_SWORD, SPR_SWORD2H, SPR_XBOW, armorIcon, shieldFace, spriteCanvas, type Sprite } from '../render/human/sprites';

/** Pixel sprite shown for an item in the inventory (the same pixel art as its 3D model). */
function itemSprite(id: string): Sprite | null {
  const def = item(id);
  if (!def) return null;
  const w = def.weapon?.kind;
  if (w === 'sword1h') return SPR_SWORD;
  if (w === 'sword2h') return SPR_SWORD2H;
  if (w === 'spear') return SPR_SPEAR;
  if (w === 'staff1h') return SPR_STAFF1H;
  if (w === 'staff2h') return SPR_STAFF2H;
  if (w === 'bow') return SPR_BOW;
  if (w === 'crossbow') return SPR_XBOW;
  if (def.slot === 'off') {
    const px: string[] = [];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const fx = x - 3;
        const fy = y - 2;
        px.push(fx >= 0 && fx < 10 && fy >= 0 && fy < 12 ? shieldFace(fx, fy, 10, 12) : '');
      }
    return { n: 16, px };
  }
  if (def.armorSet && def.slot !== 'main') return armorIcon(def.slot as 'head' | 'hands' | 'feet' | 'body', def.armorSet);
  return null;
}

const cache = new Map<string, string>();

/** An <img> of the item icon (pixelated), `size` in CSS pixels. */
export function itemIcon(id: string, scale = 3, size = 40): HTMLElement {
  const key = id + ':' + scale;
  let url = cache.get(key);
  if (!url) {
    const s = itemSprite(id);
    url = s ? spriteCanvas(s, scale).toDataURL() : '';
    cache.set(key, url);
  }
  const img = document.createElement('img');
  img.className = 'item-icon';
  img.src = url;
  img.alt = item(id)?.name ?? '';
  img.draggable = false;
  img.style.width = img.style.height = size + 'px';
  return img;
}
