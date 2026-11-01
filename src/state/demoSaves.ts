import { sortSaves, validateSaveName } from './saves';
import type { SaveInfo, SaveKind, SaveSummary } from './types';

const AUTOSAVE_PREFIX = 'autosave-';

/** In-memory mirror of src-tauri/src/saves.rs for the browser-demo transport. */
export class DemoSaveStore {
  private readonly entries = new Map<string, { info: SaveInfo; state: string }>();
  private nextId = 1;

  constructor(private readonly now: () => number = () => Date.now()) {}

  list(): SaveInfo[] {
    return sortSaves([...this.entries.values()].map((entry) => ({ ...entry.info })));
  }

  save(id: string | null, rawName: string, state: string, summary: SaveSummary): SaveInfo {
    const name = this.checkName(rawName);
    if (id != null) {
      if (id.startsWith(AUTOSAVE_PREFIX)) throw new Error('autosaves cannot be overwritten');
      if (!this.entries.has(id)) throw new Error('save not found');
    }
    return this.put(id ?? `s-${this.nextId++}`, name, 'manual', state, summary);
  }

  writeAutosave(slot: number, state: string, summary: SaveSummary): void {
    this.put(`${AUTOSAVE_PREFIX}${slot}`, `Autosave ${slot}`, 'autosave', state, summary);
  }

  read(id: string): string {
    return this.entry(id).state;
  }

  rename(id: string, rawName: string): SaveInfo {
    if (id.startsWith(AUTOSAVE_PREFIX)) throw new Error('autosaves cannot be renamed');
    const name = this.checkName(rawName);
    const entry = this.entry(id);
    entry.info = { ...entry.info, name };
    return { ...entry.info };
  }

  delete(id: string): void {
    if (!this.entries.delete(id)) throw new Error('save not found');
  }

  private entry(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error('save not found');
    return entry;
  }

  private checkName(raw: string): string {
    const check = validateSaveName(raw);
    if (!check.ok) throw new Error(check.error);
    return check.name;
  }

  private put(id: string, name: string, kind: SaveKind, state: string, summary: SaveSummary): SaveInfo {
    const info: SaveInfo = { id, name, kind, savedAt: this.now(), ...summary };
    this.entries.set(id, { info, state });
    return { ...info };
  }
}
