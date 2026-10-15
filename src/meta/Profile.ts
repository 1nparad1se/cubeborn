import { MAX_CHARS, newChar, type CharSave } from './Characters';
import { loadSave, writeSave, type SaveData } from './Save';

/** Stored state: settings, created characters and the bestiary. */
export class Profile {
  data: SaveData;
  private saveTimer = 0;

  constructor() {
    this.data = loadSave();
  }

  save(): boolean {
    return writeSave(this.data);
  }

  /** Coalesces frequent writes (e.g. settings sliders). */
  saveSoon(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 300);
  }

  // ---------------------------------------------------------------- characters
  get char(): CharSave | null {
    const d = this.data;
    return d.chars.find((c) => c.id === d.activeChar) ?? null;
  }

  /** Characters, most recently played first. */
  get chars(): CharSave[] {
    return [...this.data.chars].sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  selectChar(id: string) {
    if (this.data.chars.some((c) => c.id === id)) {
      this.data.activeChar = id;
      this.save();
    }
  }

  /** Creates a character with its own save slot (existing characters are never touched). */
  createChar(name: string, cls: string): CharSave | null {
    const d = this.data;
    if (d.chars.length >= MAX_CHARS) return null;
    const c = newChar(name, cls);
    while (d.chars.some((x) => x.id === c.id)) c.id += 'x';
    d.chars.push(c);
    d.activeChar = c.id;
    this.save();
    return c;
  }

  deleteChar(id: string) {
    const d = this.data;
    d.chars = d.chars.filter((c) => c.id !== id);
    if (d.activeChar === id) d.activeChar = d.chars[0]?.id ?? null;
    this.save();
  }
}
