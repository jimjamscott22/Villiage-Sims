import { useEffect, useRef, useState } from 'react';
import { SnapshotBuffer } from '../state/snapshot';
import { advanceDemoTime, transport } from '../state/transport';
import type { BuildingDef, Catalog, TerrainSnapshot, TickSnapshot } from '../state/types';
import { Camera } from './camera';
import type { Atlas } from './atlas';
import { ART_SCALE, drawCell, loadAtlas } from './atlas';
import { drawBuildings, drawCrops, drawVillagers } from './drawEntities';
import { drawGhost } from './drawGhost';
import { drawTerrain } from './drawTerrain';
import { hoverTargetAt, type HoverTarget } from './hover';
import { formatPerfOverlay, PerfTracker, perfEnabledFromSearch } from './perfStats';
import type { Facing } from './scene';
import { atlasHasEntities, buildDrawListWithStats, paintScene } from './scene';
import {
  terrainBlitRect,
  TileSpatialIndex,
  visibleTileBounds,
} from './spatial';
import type { ShorelineTile, TerrainProp } from './tilemap';
import { bakeTerrain, shorelineTiles, terrainProps } from './tilemap';

const TICK_MS = 50;
const FOAM_TICKS_PER_FRAME = 8;
const FOAM_FRAMES = 3;
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
  selectedVillagerId: number | null;
  onRotationChange: (rotation: number) => void;
  onCancelBuild: () => void;
  onSelectBuilding: (id: number | null) => void;
  onSelectVillager: (id: number | null) => void;
  onSnapshot: (snapshot: TickSnapshot) => void;
  /** `nonce` increments on every focus request so clicking the same tile twice
   * in a row still produces a new object identity and re-runs the focus effect
   * below — React bails out of re-renders on `Object.is(prev, next)`, and a
   * plain `[number, number]` tuple would compare equal by reference reuse. */
  focusTile: { tile: [number, number]; nonce: number } | null;
}

interface HoverDisplay extends HoverTarget {
  x: number;
  y: number;
  placeLeft: boolean;
  placeAbove: boolean;
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
  selectedVillagerId,
  onRotationChange,
  onCancelBuild,
  onSelectBuilding,
  onSelectVillager,
  onSnapshot,
  focusTile,
}: CanvasProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef(new Camera());
  const terrainRef = useRef<TerrainSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState<HoverDisplay | null>(null);
  const errorRef = useRef<string | null>(null);
  const tickRef = useRef(0);
  const selectedKindRef = useRef(selectedKind);
  const selectedCropRef = useRef(selectedCrop);
  const rotationRef = useRef(rotation);
  const catalogRef = useRef(catalog);
  const selectedBuildingIdRef = useRef(selectedBuildingId);
  const selectedVillagerIdRef = useRef(selectedVillagerId);
  const onSnapshotRef = useRef(onSnapshot);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  const onSelectVillagerRef = useRef(onSelectVillager);
  const onRotationChangeRef = useRef(onRotationChange);
  const onCancelBuildRef = useRef(onCancelBuild);
  const scheduleViewportSyncRef = useRef<(() => void) | null>(null);
  const syncViewportNowRef = useRef<(() => void) | null>(null);

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
    selectedVillagerIdRef.current = selectedVillagerId;
  }, [selectedVillagerId]);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    onSelectBuildingRef.current = onSelectBuilding;
  }, [onSelectBuilding]);
  useEffect(() => {
    onSelectVillagerRef.current = onSelectVillager;
  }, [onSelectVillager]);
  useEffect(() => {
    onRotationChangeRef.current = onRotationChange;
  }, [onRotationChange]);
  useEffect(() => {
    onCancelBuildRef.current = onCancelBuild;
  }, [onCancelBuild]);

  useEffect(() => {
    if (!focusTile) return;
    const canvas = canvasRef.current;
    const terrain = terrainRef.current;
    if (!canvas || !terrain) return;
    const [tileX, tileY] = focusTile.tile;
    cameraRef.current.centerOnTile(
      tileX,
      tileY,
      terrain.tileSize,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    // Buildings are viewport-culled server-side; without this the sim doesn't
    // know the camera jumped, and the focused building drops out of the next
    // snapshot and renders as empty ground. An explicit focus jump bypasses the
    // pan/zoom debounce so the building doesn't appear only after the debounce
    // interval elapses.
    syncViewportNowRef.current?.();
  }, [focusTile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas 2D is unavailable');
      return;
    }

    const buffer = new SnapshotBuffer();
    const camera = cameraRef.current;
    let terrain: TerrainSnapshot | null = null;
    let terrainLayer: HTMLCanvasElement | null = null;
    let atlas: Atlas | null = null;
    let shoreline: ShorelineTile[] = [];
    let shorelineIndex = new TileSpatialIndex<ShorelineTile>();
    let props: TerrainProp[] = [];
    let propsIndex = new TileSpatialIndex<TerrainProp>();
    const lastFacing = new Map<number, Facing>();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const perfEnabled = perfEnabledFromSearch(window.location.search);
    const perf = new PerfTracker();
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
    let lastDrawListLength = 0;
    let lastPropsDrawn = 0;
    let lastShorelineDrawn = 0;
    let hoveredTarget: HoverTarget | null = null;
    let lastHoverSignature = '';

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
    scheduleViewportSyncRef.current = scheduleViewportSync;

    // Bypasses the debounce for explicit focus jumps (chronicle entry clicks)
    // so the camera doesn't sit on empty ground for VIEWPORT_DEBOUNCE_MS before
    // the sim starts including the focused building. Pan/zoom keep using the
    // debounced path above.
    const syncViewportNow = () => {
      if (viewportTimer !== null) {
        window.clearTimeout(viewportTimer);
        viewportTimer = null;
      }
      const rect = camera.visibleWorldRect(viewWidth, viewHeight);
      void transport.setViewport(rect.x, rect.y, rect.w, rect.h);
    };
    syncViewportNowRef.current = syncViewportNow;

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

    const clearHover = () => {
      hoveredTarget = null;
      if (lastHoverSignature === '') return;
      lastHoverSignature = '';
      setHovered(null);
    };

    const refreshHover = (snapshot: TickSnapshot | null = rendered) => {
      const currentCatalog = catalogRef.current;
      if (
        !pointerInside
        || dragging
        || selectedKindRef.current
        || selectedCropRef.current
        || !terrain
        || !snapshot
        || !currentCatalog
      ) {
        clearHover();
        return;
      }

      const [worldX, worldY] = camera.screenToWorld(pointerX, pointerY);
      const target = hoverTargetAt({
        snapshot,
        catalog: currentCatalog,
        worldX,
        worldY,
        tileSize: terrain.tileSize,
        zoom: camera.zoom,
      });
      if (!target) {
        clearHover();
        return;
      }

      hoveredTarget = target;
      const x = Math.round(pointerX);
      const y = Math.round(pointerY);
      const signature = `${target.kind}:${target.id}:${target.detail}:${x}:${y}`;
      if (signature === lastHoverSignature) return;
      lastHoverSignature = signature;
      setHovered({
        ...target,
        x,
        y,
        placeLeft: x > viewWidth - 210,
        placeAbove: y > viewHeight - 84,
      });
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
      const frameStart = performance.now();
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

      const view = camera.visibleWorldRect(viewWidth, viewHeight);
      const viewTiles = visibleTileBounds(view, terrain.tileSize);

      camera.applyTransform(ctx, dpr);
      ctx.imageSmoothingEnabled = false;
      // Blit only the visible slice of the 4096×4096 terrain layer (spec: source-rect).
      const blit = terrainBlitRect(view, worldWidth, worldHeight);
      if (blit) {
        ctx.drawImage(
          terrainLayer,
          blit.sx,
          blit.sy,
          blit.sw,
          blit.sh,
          blit.sx,
          blit.sy,
          blit.sw,
          blit.sh,
        );
      }

      let shorelineDrawn = 0;
      if (atlas && shoreline.length > 0) {
        const tileSize = terrain.tileSize;
        const frame = reduceMotion
          ? 0
          : Math.floor(tickRef.current / FOAM_TICKS_PER_FRAME) % FOAM_FRAMES;
        shorelineIndex.forEachInBounds(viewTiles, (tile) => {
          shorelineDrawn += 1;
          const dx = tile.x * tileSize;
          const dy = tile.y * tileSize;
          for (const edge of tile.edges) drawCell(ctx, atlas!, edge, dx, dy, frame, ART_SCALE);
        });
      }
      lastShorelineDrawn = shorelineDrawn;

      rendered = buffer.interpolate(now, TICK_MS);
      if (rendered) {
        refreshHover(rendered);
        const catalog = catalogRef.current;
        if (atlas && atlasHasEntities(atlas) && catalog) {
          const { list, propsDrawn } = buildDrawListWithStats({
            snapshot: rendered,
            catalog,
            props,
            propsIndex,
            viewTiles,
            tileSize: terrain.tileSize,
            tick: tickRef.current,
            reduceMotion,
            selectedBuildingId: selectedBuildingIdRef.current,
            selectedVillagerId: selectedVillagerIdRef.current,
            lastFacing,
            atlas,
          });
          lastDrawListLength = list.length;
          lastPropsDrawn = propsDrawn;
          paintScene(ctx, atlas, list);
        } else {
          const footprints = (catalog?.buildings ?? []).map(
            (building) => building.footprint as [number, number],
          );
          drawBuildings(ctx, rendered.buildings, terrain.tileSize, footprints);
          drawCrops(ctx, rendered.crops ?? [], terrain.tileSize);
          drawVillagers(ctx, rendered.villagers, camera.zoom, selectedVillagerIdRef.current);
          if (selectedBuildingIdRef.current != null) {
            const selected = rendered.buildings.find(
              (building) => building.id === selectedBuildingIdRef.current,
            );
            if (selected) {
              const [fw, fh] = footprints[selected.kind] ?? [1, 1];
              const width = (selected.rot % 2 === 0 ? fw : fh) * terrain.tileSize;
              const height = (selected.rot % 2 === 0 ? fh : fw) * terrain.tileSize;
              ctx.strokeStyle = '#f4c95d';
              ctx.lineWidth = 2 / Math.max(camera.zoom, 0.01);
              ctx.strokeRect(
                selected.x * terrain.tileSize,
                selected.y * terrain.tileSize,
                width,
                height,
              );
            }
          }
        }
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

      const frameMs = performance.now() - frameStart;
      perf.setDrawStats({
        drawListLength: lastDrawListLength,
        propsTotal: props.length,
        propsDrawn: lastPropsDrawn,
        shorelineTotal: shoreline.length,
        shorelineDrawn: lastShorelineDrawn,
      });
      perf.recordFrame(now, frameMs);

      if (perfEnabled) {
        const lines = formatPerfOverlay(perf.snapshot());
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        const pad = 8;
        const lineH = 14;
        const boxW = 220;
        const boxH = pad * 2 + lines.length * lineH;
        ctx.fillStyle = 'rgba(12, 18, 12, 0.72)';
        ctx.fillRect(8, 8, boxW, boxH);
        ctx.fillStyle = '#b6f28a';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        for (let i = 0; i < lines.length; i += 1) {
          ctx.fillText(lines[i], 8 + pad, 8 + pad + (i + 1) * lineH - 3);
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
        terrainRef.current = terrain;
        worldWidth = terrain.width * terrain.tileSize;
        worldHeight = terrain.height * terrain.tileSize;
        terrainLayer = document.createElement('canvas');
        terrainLayer.width = worldWidth;
        terrainLayer.height = worldHeight;
        const terrainContext = terrainLayer.getContext('2d');
        if (!terrainContext) throw new Error('Offscreen Canvas 2D is unavailable');
        atlas = await loadAtlas();
        if (cancelled) return;
        if (atlas) {
          bakeTerrain(terrainContext, atlas, terrain);
          shoreline = shorelineTiles(terrain);
          shorelineIndex = new TileSpatialIndex<ShorelineTile>();
          shorelineIndex.build(shoreline);
          props = terrainProps(terrain);
          propsIndex = new TileSpatialIndex<TerrainProp>();
          propsIndex.build(props);
        } else {
          drawTerrain(terrainContext, terrain);
        }
        resize();
        const stopListening = await transport.listenToTicks((snapshot) => {
          buffer.push(snapshot, performance.now());
          tickRef.current = snapshot.tick;
          setTick(snapshot.tick);
          try {
            perf.setSnapshotBytes(JSON.stringify(snapshot).length);
          } catch {
            /* ignore */
          }
          onSnapshotRef.current(snapshot);
        });
        if (cancelled) {
          stopListening();
          return;
        }
        unlisten = stopListening;
        window.__villagePerf = () => perf.snapshot();
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
        art: {
          loaded: atlas != null,
          cells: atlas ? Object.keys(atlas.manifest.cells).length : 0,
        },
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
        hover: hoveredTarget,
        villagers: rendered?.villagers ?? [],
        error: errorRef.current,
        perf: perf.snapshot(),
      });

    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          // Keep overlays (like entity hover tooltips) in the fullscreen subtree.
          await (viewportRef.current ?? canvas).requestFullscreen();
        }
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
        onSelectVillagerRef.current(null);
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
      const bounds = canvas.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      dragging = true;
      dragMoved = false;
      clearHover();
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
      const bounds = canvas.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
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
          if (!validity.valid) {
            fail(validity.reason || 'invalid placement');
            return;
          }
          await transport.placeBuilding(kind, tile[0], tile[1], rotationRef.current);
          errorRef.current = null;
          setError(null);
        } catch (cause) {
          fail(cause instanceof Error ? cause.message : String(cause));
        }
        return;
      }

      const snapshot = rendered ?? buffer.interpolate(performance.now(), TICK_MS);
      if (!snapshot) return;
      const [worldX, worldY] = camera.screenToWorld(pointerX, pointerY);
      const hitRadius = Math.max(16, 22 / Math.max(camera.zoom, 0.01));
      let closestVillager: { id: number; dist: number } | null = null;
      for (const villager of snapshot.villagers) {
        const dist = Math.hypot(villager.x - worldX, villager.y - worldY);
        if (dist <= hitRadius && (closestVillager == null || dist < closestVillager.dist)) {
          closestVillager = { id: villager.id, dist };
        }
      }
      if (closestVillager) {
        onSelectVillagerRef.current(closestVillager.id);
        onSelectBuildingRef.current(null);
        return;
      }
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
      if (hit) onSelectVillagerRef.current(null);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      hoverTile = null;
      clearHover();
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
      void transport.moveVillagerTo(tile[0], tile[1], selectedVillagerIdRef.current).catch((cause) => {
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
      scheduleViewportSyncRef.current = null;
      syncViewportNowRef.current = null;
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
      delete window.__villagePerf;
    };
  }, []);

  return (
    <section ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#0b151c]">
      <canvas
        ref={canvasRef}
        aria-label="Village simulation"
        className={`h-full w-full touch-none [image-rendering:pixelated] ${
          selectedKind || selectedCrop ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />
      {hovered && (
        <div
          role="tooltip"
          data-testid="entity-tooltip"
          data-entity={`${hovered.kind}:${hovered.id}`}
          className="pixel-panel pointer-events-none absolute z-10 min-w-32 max-w-56 px-2 py-1.5 text-xs"
          style={{
            left: hovered.x + (hovered.placeLeft ? -12 : 12),
            top: hovered.y + (hovered.placeAbove ? -12 : 12),
            transform: `translate(${hovered.placeLeft ? '-100%' : '0'}, ${
              hovered.placeAbove ? '-100%' : '0'
            })`,
          }}
        >
          <div className="font-medium text-[#f7f4e9]">{hovered.title}</div>
          <div className="mt-0.5 text-[11px] text-white/60">{hovered.detail}</div>
        </div>
      )}
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
