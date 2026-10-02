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
        ...current,
        x: previous.x + (current.x - previous.x) * alpha,
        y: previous.y + (current.y - previous.y) * alpha,
        dx: current.x - previous.x,
        dy: current.y - previous.y,
      };
    });

    return {
      ...this.current,
      chickens: this.current.chickens?.map(c => {
        const previous = this.previous?.chickens?.find(p => p.id === c.id && p.shelterId === c.shelterId);
        if (!previous || Math.hypot(previous.x - c.x, previous.y - c.y) > 64) return c;
        return { ...c, x: previous.x + (c.x - previous.x) * alpha, y: previous.y + (c.y - previous.y) * alpha };
      }),
      tick: this.current.tick,
      villagers,
      buildings: this.current.buildings,
      crops: this.current.crops,
      resources: this.current.resources,
      housingCapacity: this.current.housingCapacity,
      clock: this.current.clock,
      chronicleSeq: this.current.chronicleSeq,
      unlocked: this.current.unlocked,
      winterWarning: this.current.winterWarning,
      completedObjectives: this.current.completedObjectives,
    };
  }
}
