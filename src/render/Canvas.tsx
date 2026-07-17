import { useEffect, useRef, useState } from 'react';
import { SnapshotBuffer } from '../state/snapshot';
import { advanceDemoTime, transport } from '../state/transport';
import type { TerrainSnapshot, TickSnapshot } from '../state/types';
import { drawVillagers } from './drawEntities';
import { drawTerrain } from './drawTerrain';

const TICK_MS = 50;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const errorRef = useRef<string | null>(null);
  const tickRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas 2D is unavailable');
      return;
    }

    const buffer = new SnapshotBuffer();
    let terrain: TerrainSnapshot | null = null;
    let terrainLayer: HTMLCanvasElement | null = null;
    let rendered: TickSnapshot | null = null;
    let frame = 0;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const fail = (message: string) => {
      errorRef.current = message;
      setError(message);
    };

    const draw = (now: number) => {
      if (terrain && terrainLayer) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(terrainLayer, 0, 0);
        rendered = buffer.interpolate(now, TICK_MS);
        if (rendered) drawVillagers(ctx, rendered.villagers);
      }
    };

    const animate = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(animate);
    };

    const initialize = async () => {
      try {
        const loadedTerrain = await transport.getTerrain();
        if (cancelled) return;
        terrain = loadedTerrain;
        canvas.width = terrain.width * terrain.tileSize;
        canvas.height = terrain.height * terrain.tileSize;
        terrainLayer = document.createElement('canvas');
        terrainLayer.width = canvas.width;
        terrainLayer.height = canvas.height;
        const terrainContext = terrainLayer.getContext('2d');
        if (!terrainContext) throw new Error('Offscreen Canvas 2D is unavailable');
        drawTerrain(terrainContext, terrain);
        const stopListening = await transport.listenToTicks((snapshot) => {
          buffer.push(snapshot, performance.now());
          tickRef.current = snapshot.tick;
          setTick(snapshot.tick);
        });
        if (cancelled) {
          stopListening();
          return;
        }
        unlisten = stopListening;
        frame = requestAnimationFrame(animate);
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        fail(message);
      }
    };

    window.advanceTime = (ms) => {
      advanceDemoTime(ms);
      draw(performance.now() + Math.max(0, ms));
    };
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'origin top-left; x right; y down; world pixels',
      mode: transport.mode,
      tick: rendered?.tick ?? tickRef.current,
      terrain: terrain ? { width: terrain.width, height: terrain.height, tileSize: terrain.tileSize } : null,
      villagers: rendered?.villagers ?? [],
      error: errorRef.current,
    });

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f') return;
      if (document.fullscreenElement) await document.exitFullscreen();
      else await canvas.requestFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    void initialize();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      unlisten?.();
      window.removeEventListener('keydown', onKeyDown);
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, []);

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-[#111914]">
      <canvas ref={canvasRef} aria-label="Village simulation" className="h-full w-full object-contain [image-rendering:pixelated]" />
      <span className="absolute bottom-3 right-3 bg-black/55 px-2 py-1 text-xs text-white/70">Tick {tick}</span>
      {error && <p role="alert" className="absolute inset-x-4 top-4 bg-red-950/90 p-3 text-sm text-red-100">{error}</p>}
    </section>
  );
}
