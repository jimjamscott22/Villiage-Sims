import type { ChickenView } from '../state/types';

/** Quiet, synthesized two-note clucks; no downloaded samples or autoplay. */
export class ChickenAudio {
  private context: AudioContext | null = null;
  private seen = new Map<string, number>();
  private lastSound = -Infinity;
  enabled = false;
  async toggle(): Promise<boolean> {
    if (this.enabled) { this.enabled = false; return false; }
    this.context ??= new AudioContext();
    await this.context.resume();
    this.enabled = true;
    return true;
  }
  observe(chickens: ChickenView[]): void {
    for (const c of chickens) {
      const key = `${c.shelterId}:${c.id}`, previous = this.seen.get(key);
      this.seen.set(key, c.soundSeq);
      if (previous == null || previous === c.soundSeq || c.pose === 'sleep') continue;
      const ctx = this.context;
      if (!this.enabled || !ctx || ctx.state !== 'running' || ctx.currentTime - this.lastSound < 1.5) continue;
      this.lastSound = ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const start = ctx.currentTime + i * 0.09, oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(640 - i * 90, start);
        oscillator.frequency.exponentialRampToValueAtTime(230, start + 0.075);
        gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.025, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + 0.1);
      }
    }
  }
  close(): void { this.enabled = false; if (this.context) void this.context.close(); }
}
