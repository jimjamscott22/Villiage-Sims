import { useEffect, useRef, useState } from 'react';
import { SnapshotBuffer } from '../state/snapshot';
import { advanceDemoTime, transport } from '../state/transport';
import type { BuildingDef, Catalog, TerrainSnapshot, TickSnapshot } from '../state/types';
import { Camera } from './camera';
import { drawBuildings, drawCrops, drawVillagers } from './drawEntities';
import { drawGhost } from './drawGhost';
import { drawTerrain } from './drawTerrain';

const TICK_MS = 50;
const VIEWPORT_DEBOUNCE_MS = 100;
const EDGE_SCROLL_MARGIN = 24;
const EDGE_SCROLL_SPEED = 6;
const CLICK_DRAG_THRESHOLD = 6;

interface CanvasProps {
  catalog: Catalog | null;
  selectedKind: string | null;
  selectedCrop: string | null;
  rotation: number;
  selectedBuildingId: number | null;
  onRotationChange: (rotation: number) => void;
  onCancelBuild: () => void;
  onSelectBuilding: (id: number | null) => void;
  onSnapshot: (snapshot: TickSnapshot) => void;
}

function rotatedFootprint(def: BuildingDef, rotation: number): [number, number] {
  const [w, h] = def.footprint;
  return rotation % 2 === 0 ? [w, h] : [h, w];
}

function cropPlantValid(
  snapshot: TickSnapshot,
  catalog: Catalog,
  x: number,
  y: number,
): boolean {
  if (snapshot.crops.some((crop) => crop.x === x && crop.y === y)) return false;
  return snapshot.buildings.some((building) => {
    const def = catalog.buildings[building.kind];
    if (!def || def.id !== 'farm' || building.state !== 2) return false;
    const [fw, fh] = rotatedFootprint(def, building.rot);
    return x >= building.x && y >= building.y && x < building.x + fw && y < building.y + fh;
  });
}

export function Canvas({
  catalog,
  selectedKind,
  selectedCrop,
  rotation,
  selectedBuildingId,
  onRotationChange,
  onCancelBuild,
  onSelectBuilding,
  onSnapshot,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const errorRef = useRef<string | null>(null);
  const tickRef = useRef(0);
  const selectedKindRef = useRef(selectedKind);
  const selectedCropRef = useRef(selectedCrop);
  const rotationRef = useRef(rotation);
  const catalogRef = useRef(catalog);
  const selectedBuildingIdRef = useRef(selectedBuildingId);
  const onSnapshotRef = useRef(onSnapshot);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  const onRotationChangeRef = useRef(onRotationChange);
  const onCancelBuildRef = useRef(onCancelBuild);

  useEffect(() => {
    selectedKindRef.current = selectedKind;
  }, [selectedKind]);
  useEffect(() => {
    selectedCropRef.current = selectedCrop;
  }, [selectedCrop]);
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);
  useEffect(() => {
    selectedBuildingIdRef.current = selectedBuildingId;
  }, [selectedBuildingId]);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    onSelectBuildingRef.current = onSelectBuilding;
  }, [onSelectBuilding]);
  useEffect(() => {
    onRotationChangeRef.current = onRotationChange;
  }, [onRotationChange]);
  useEffect(() => {
    onCancelBuildRef.current = onCancelBuild;
  }, [onCancelBuild]);

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
    let dragMoved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;
    let cameraCentered = false;
    let hoverTile: [number, number] | null = null;
    let hoverValid = false;
    let lastValidateKey = '';

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

    const tileAtPointer = (): [number, number] | null => {
      if (!terrain) return null;
      const [wx, wy] = camera.screenToWorld(pointerX, pointerY);
      return [Math.floor(wx / terrain.tileSize), Math.floor(wy / terrain.tileSize)];
    };

    const refreshGhost = async () => {
      const kind = selectedKindRef.current;
      const crop = selectedCropRef.current;
      if ((!kind && !crop) || !terrain) {
        hoverTile = null;
        return;
      }
      const tile = tileAtPointer();
      if (!tile) {
        hoverTile = null;
        return;
      }
      hoverTile = tile;
      if (crop) {
        const key = `crop:${crop}:${tile[0]}:${tile[1]}`;
        if (key === lastValidateKey) return;
        lastValidateKey = key;
        const snapshot = rendered ?? buffer.interpolate(performance.now(), TICK_MS);
        const cat = catalogRef.current;
        hoverValid = !!(snapshot && cat && cropPlantValid(snapshot, cat, tile[0], tile[1]));
        return;
      }
      const key = `${kind}:${tile[0]}:${tile[1]}:${rotationRef.current}`;
      if (key === lastValidateKey) return;
      lastValidateKey = key;
      const validity = await transport.validatePlacement(kind!, tile[0], tile[1], rotationRef.current);
      if (key === lastValidateKey) hoverValid = validity.valid;
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
          void refreshGhost();
        }
      }

      camera.applyTransform(ctx, dpr);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrainLayer, 0, 0);
      rendered = buffer.interpolate(now, TICK_MS);
      if (rendered) {
        const footprints = (catalogRef.current?.buildings ?? []).map(
          (building) => building.footprint as [number, number],
        );
        drawBuildings(ctx, rendered.buildings, terrain.tileSize, footprints);
        drawCrops(ctx, rendered.crops ?? [], terrain.tileSize);
        drawVillagers(ctx, rendered.villagers, camera.zoom);
      }

      const kind = selectedKindRef.current;
      const crop = selectedCropRef.current;
      const def = kind ? catalogRef.current?.buildings.find((building) => building.id === kind) : null;
      if (def && hoverTile) {
        drawGhost(
          ctx,
          hoverTile[0],
          hoverTile[1],
          rotatedFootprint(def, rotationRef.current),
          terrain.tileSize,
          hoverValid,
        );
      } else if (crop && hoverTile) {
        drawGhost(ctx, hoverTile[0], hoverTile[1], [1, 1], terrain.tileSize, hoverValid);
      }

      if (rendered && selectedBuildingIdRef.current != null) {
        const selected = rendered.buildings.find((building) => building.id === selectedBuildingIdRef.current);
        if (selected) {
          const footprints = (catalogRef.current?.buildings ?? []).map(
            (building) => building.footprint as [number, number],
          );
          const [fw, fh] = footprints[selected.kind] ?? [1, 1];
          const width = (selected.rot % 2 === 0 ? fw : fh) * terrain.tileSize;
          const height = (selected.rot % 2 === 0 ? fh : fw) * terrain.tileSize;
          ctx.strokeStyle = '#f4c95d';
          ctx.lineWidth = 2 / Math.max(camera.zoom, 0.01);
          ctx.strokeRect(selected.x * terrain.tileSize, selected.y * terrain.tileSize, width, height);
        }
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
          onSnapshotRef.current(snapshot);
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
        buildings: rendered?.buildings ?? [],
        crops: rendered?.crops ?? [],
        clock: rendered?.clock ?? null,
        resources: rendered?.resources ?? null,
        selectedKind: selectedKindRef.current,
        selectedCrop: selectedCropRef.current,
        villagers: rendered?.villagers ?? [],
        error: errorRef.current,
      });

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await canvas.requestFullscreen();
        return;
      }
      if (event.key.toLowerCase() === 'r' && selectedKindRef.current) {
        onRotationChangeRef.current((rotationRef.current + 1) % 4);
        lastValidateKey = '';
        void refreshGhost();
        return;
      }
      if (event.key === 'Escape') {
        onCancelBuildRef.current();
        onSelectBuildingRef.current(null);
        hoverTile = null;
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBuildingIdRef.current != null) {
        event.preventDefault();
        try {
          await transport.demolish(selectedBuildingIdRef.current);
          onSelectBuildingRef.current(null);
        } catch (cause) {
          fail(cause instanceof Error ? cause.message : String(cause));
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && event.button !== 0) return;
      dragging = true;
      dragMoved = false;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerInside = true;
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      void refreshGhost();
      if (!dragging) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      if (
        Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > CLICK_DRAG_THRESHOLD
      ) {
        dragMoved = true;
      }
      // In build/plant mode, only middle-mouse pans; left button is reserved for clicks.
      if (
        event.buttons & 4
        || (event.buttons & 1 && !selectedKindRef.current && !selectedCropRef.current)
      ) {
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        camera.panBy(dx, dy);
        scheduleViewportSync();
      }
    };

    const onPointerUp = async (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      scheduleViewportSync();
      if (event.button !== 0 || dragMoved || !terrain) return;

      const tile = tileAtPointer();
      if (!tile) return;
      const crop = selectedCropRef.current;
      if (crop) {
        try {
          await transport.plantCrop(crop, tile[0], tile[1]);
        } catch (cause) {
          fail(cause instanceof Error ? cause.message : String(cause));
        }
        return;
      }
      const kind = selectedKindRef.current;
      if (kind) {
        try {
          const validity = await transport.validatePlacement(kind, tile[0], tile[1], rotationRef.current);
          if (!validity.valid) return;
          await transport.placeBuilding(kind, tile[0], tile[1], rotationRef.current);
        } catch (cause) {
          fail(cause instanceof Error ? cause.message : String(cause));
        }
        return;
      }

      const snapshot = rendered ?? buffer.interpolate(performance.now(), TICK_MS);
      if (!snapshot) return;
      const hit = snapshot.buildings.find((building) => {
        const def = catalogRef.current?.buildings[building.kind];
        if (!def) return false;
        const [fw, fh] = rotatedFootprint(def, building.rot);
        return tile[0] >= building.x
          && tile[1] >= building.y
          && tile[0] < building.x + fw
          && tile[1] < building.y + fh;
      });
      onSelectBuildingRef.current(hit?.id ?? null);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      hoverTile = null;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const sx = event.clientX - bounds.left;
      const sy = event.clientY - bounds.top;
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      camera.zoomAt(sx, sy, camera.zoom * factor);
      scheduleViewportSync();
      void refreshGhost();
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!terrain) return;
      const bounds = canvas.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      const tile = tileAtPointer();
      if (!tile) return;
      void transport.moveVillagerTo(tile[0], tile[1]).catch((cause) => {
        fail(cause instanceof Error ? cause.message : String(cause));
      });
    };

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
        Tick {tick}
        {selectedKind
          ? ' · build mode'
          : selectedCrop
            ? ' · plant mode'
            : ' · drag to pan · scroll to zoom · right-click to move'}
      </span>
      {error && (
        <p role="alert" className="absolute inset-x-4 top-4 bg-red-950/90 p-3 text-sm text-red-100">
          {error}
        </p>
      )}
    </section>
  );
}
