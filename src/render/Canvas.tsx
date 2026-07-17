import { useEffect, useRef, useState } from 'react';
import { SnapshotBuffer } from '../state/snapshot';
import { advanceDemoTime, transport } from '../state/transport';
import type { TerrainSnapshot, TickSnapshot } from '../state/types';
import { Camera } from './camera';
import { drawVillagers } from './drawEntities';
import { drawTerrain } from './drawTerrain';

const TICK_MS = 50;
const VIEWPORT_DEBOUNCE_MS = 100;
const EDGE_SCROLL_MARGIN = 24;
const EDGE_SCROLL_SPEED = 6;

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
    const camera = new Camera();
    let terrain: TerrainSnapshot | null = null;
    let terrainLayer: HTMLCanvasElement | null = null;
    let worldWidth = 0;
    let worldHeight = 0;
    let rendered: TickSnapshot | null = null;
    let frame = 0;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let viewportTimer: number | null = null;
    let viewWidth = 0;
    let viewHeight = 0;
    let dpr = window.devicePixelRatio || 1;
    let dragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;
    let cameraCentered = false;

    const fail = (message: string) => {
      errorRef.current = message;
      setError(message);
    };

    const scheduleViewportSync = () => {
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => {
        const rect = camera.visibleWorldRect(viewWidth, viewHeight);
        void transport.setViewport(rect.x, rect.y, rect.w, rect.h);
      }, VIEWPORT_DEBOUNCE_MS);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = window.devicePixelRatio || 1;
      viewWidth = parent.clientWidth;
      viewHeight = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(viewWidth * dpr));
      canvas.height = Math.max(1, Math.floor(viewHeight * dpr));
      canvas.style.width = `${viewWidth}px`;
      canvas.style.height = `${viewHeight}px`;
      if (terrain && worldWidth > 0 && !cameraCentered) {
        camera.fitWorld(worldWidth, worldHeight, viewWidth, viewHeight);
        cameraCentered = true;
        scheduleViewportSync();
      }
    };

    const draw = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!terrain || !terrainLayer) return;

      if (pointerInside && !dragging) {
        let dx = 0;
        let dy = 0;
        if (pointerX < EDGE_SCROLL_MARGIN) dx = EDGE_SCROLL_SPEED;
        else if (pointerX > viewWidth - EDGE_SCROLL_MARGIN) dx = -EDGE_SCROLL_SPEED;
        if (pointerY < EDGE_SCROLL_MARGIN) dy = EDGE_SCROLL_SPEED;
        else if (pointerY > viewHeight - EDGE_SCROLL_MARGIN) dy = -EDGE_SCROLL_SPEED;
        if (dx !== 0 || dy !== 0) {
          camera.panBy(dx, dy);
          scheduleViewportSync();
        }
      }

      camera.applyTransform(ctx, dpr);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrainLayer, 0, 0);
      rendered = buffer.interpolate(now, TICK_MS);
      if (rendered) drawVillagers(ctx, rendered.villagers, camera.zoom);
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
        worldWidth = terrain.width * terrain.tileSize;
        worldHeight = terrain.height * terrain.tileSize;
        terrainLayer = document.createElement('canvas');
        terrainLayer.width = worldWidth;
        terrainLayer.height = worldHeight;
        const terrainContext = terrainLayer.getContext('2d');
        if (!terrainContext) throw new Error('Offscreen Canvas 2D is unavailable');
        drawTerrain(terrainContext, terrain);
        resize();
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
    window.render_game_to_text = () =>
      JSON.stringify({
        coordinateSystem: 'origin top-left; x right; y down; world pixels',
        mode: transport.mode,
        tick: rendered?.tick ?? tickRef.current,
        terrain: terrain
          ? { width: terrain.width, height: terrain.height, tileSize: terrain.tileSize }
          : null,
        camera: {
          x: camera.x,
          y: camera.y,
          zoom: camera.zoom,
          viewWidth,
          viewHeight,
        },
        villagers: rendered?.villagers ?? [],
        error: errorRef.current,
      });

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f') return;
      if (document.fullscreenElement) await document.exitFullscreen();
      else await canvas.requestFullscreen();
    };

    const onPointerDown = (event: PointerEvent) => {
      // Middle-button pan (spec). Also allow left-drag so trackpads can navigate in M2.
      if (event.button !== 1 && event.button !== 0) return;
      dragging = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerInside = true;
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      if (!dragging) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      camera.panBy(dx, dy);
      scheduleViewportSync();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      scheduleViewportSync();
    };

    const onPointerLeave = () => {
      pointerInside = false;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const sx = event.clientX - bounds.left;
      const sy = event.clientY - bounds.top;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      camera.zoomAt(sx, sy, camera.zoom * factor);
      scheduleViewportSync();
    };

    const onContextMenu = (event: Event) => event.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    void initialize();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      unlisten?.();
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, []);

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-[#0b151c]">
      <canvas
        ref={canvasRef}
        aria-label="Village simulation"
        className="h-full w-full touch-none [image-rendering:pixelated]"
      />
      <span className="pointer-events-none absolute bottom-3 right-3 bg-black/55 px-2 py-1 text-xs text-white/70">
        Tick {tick} · drag to pan · scroll to zoom
      </span>
      {error && (
        <p role="alert" className="absolute inset-x-4 top-4 bg-red-950/90 p-3 text-sm text-red-100">
          {error}
        </p>
      )}
    </section>
  );
}
