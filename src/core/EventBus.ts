type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub used to decouple gameplay from audio, UI and meta systems. */
export class EventBus<Events extends Record<string, unknown>> {
  private map = new Map<keyof Events, Set<Handler<any>>>();
  on<K extends keyof Events>(type: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.map.get(type);
    if (set) for (const fn of set) fn(payload);
  }
  clear(): void {
    this.map.clear();
  }
}
