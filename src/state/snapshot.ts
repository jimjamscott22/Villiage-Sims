import type { TickSnapshot, VillagerView } from './types';

export class SnapshotBuffer {
  private previous: TickSnapshot | null = null;
  private current: TickSnapshot | null = null;
  private currentReceivedAt = 0;

  push(snapshot: TickSnapshot, receivedAt: number): void {
    this.previous = this.current;
    this.current = snapshot;
    this.currentReceivedAt = receivedAt;
  }

  interpolate(now: number, tickMs: number): TickSnapshot | null {
    if (!this.current) return null;
    if (!this.previous) return this.current;

    const alpha = Math.min(Math.max((now - this.currentReceivedAt) / tickMs, 0), 1);
    const previousById = new Map(this.previous.villagers.map((v) => [v.id, v]));
    const villagers = this.current.villagers.map((current): VillagerView => {
      const previous = previousById.get(current.id);
      if (!previous) return current;
      return {
        id: current.id,
        x: previous.x + (current.x - previous.x) * alpha,
        y: previous.y + (current.y - previous.y) * alpha,
      };
    });

    return {
      tick: this.current.tick,
      clock: this.current.clock,
      villagers,
      buildings: this.current.buildings,
      crops: this.current.crops,
      resources: this.current.resources,
      events: this.current.events,
    };
  }
}
