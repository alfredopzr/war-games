import * as THREE from 'three';
import type { CubeCoord, Unit, Command, GameState, AttackDirective } from '@hexwar/engine';
import {
  hexToKey, hexWorldVertices, findPath, hexesInRadius,
  cubeDistance, getMoveCost, computeFlankWaypoint,
} from '@hexwar/engine';
import { cachedHexToWorld } from './render-cache';
import { getThreeContext } from './three-scene';
import { getPalette } from './palette';

// ---------------------------------------------------------------------------
// Selection highlights — Three.js outlines + fills
// ---------------------------------------------------------------------------

let selectionGroup: THREE.Group | null = null;

// ---------------------------------------------------------------------------
// Trajectory cache — avoids recomputing flank simulation on every hover
// ---------------------------------------------------------------------------

const vizCache = new Map<string, CubeCoord[]>();
let lastGameStateRef: GameState | null = null;

function vizCacheKey(unit: Unit): string {
  const tgt = unit.directiveTarget;
  const tgtKey = tgt.hex ? hexToKey(tgt.hex) : (tgt.unitId ?? tgt.type);
  return `${unit.id}|${hexToKey(unit.position)}|${unit.movementDirective}|${unit.attackDirective}|${tgtKey}`;
}

// ---------------------------------------------------------------------------
// Hex outline + fill primitives
// ---------------------------------------------------------------------------

function createHexOutline(
  hex: CubeCoord,
  elevation: number,
  color: number,
  alpha: number,
  yOffset: number,
): THREE.LineLoop {
  const verts = hexWorldVertices(hex, elevation);
  const points = verts.map((v) => new THREE.Vector3(v.x, v.y + yOffset, v.z));
  points.push(points[0]!.clone());
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 2;
  return line;
}

function createHexFill(
  hex: CubeCoord,
  elevation: number,
  color: number,
  alpha: number,
  yOffset: number,
): THREE.Mesh {
  const verts = hexWorldVertices(hex, elevation);
  const shape = new THREE.Shape();
  shape.moveTo(verts[0]!.x, verts[0]!.z);
  for (let i = 1; i < 6; i++) {
    shape.lineTo(verts[i]!.x, verts[i]!.z);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: alpha,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.y = cachedHexToWorld(hex, elevation).y + yOffset;
  mesh.renderOrder = 2;
  return mesh;
}

// ---------------------------------------------------------------------------
// Path line primitives
// ---------------------------------------------------------------------------

function createPathLine(
  path: CubeCoord[],
  elevationMap: Map<string, number>,
  color: number,
  alpha: number,
): THREE.Line {
  const points = path.map((hex) => {
    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const world = cachedHexToWorld(hex, elev);
    return new THREE.Vector3(world.x, world.y + 0.15, world.z);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: alpha,
    depthTest: false,
    linewidth: 2,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 3;
  return line;
}

function createDashedPathLine(
  path: CubeCoord[],
  elevationMap: Map<string, number>,
  color: number,
  alpha: number,
  dashSize: number,
  gapSize: number,
): THREE.Line {
  const points = path.map((hex) => {
    const elev = elevationMap.get(hexToKey(hex)) ?? 0;
    const world = cachedHexToWorld(hex, elev);
    return new THREE.Vector3(world.x, world.y + 0.15, world.z);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity: alpha,
    depthTest: false,
    linewidth: 2,
    dashSize,
    gapSize,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  line.renderOrder = 3;
  return line;
}

// ---------------------------------------------------------------------------
// Flank trajectory simulation
// ---------------------------------------------------------------------------

function simulateFlankTrajectory(
  unit: Unit,
  targetHex: CubeCoord,
  side: 'left' | 'right',
  gameState: GameState,
  occupiedKeys: Set<string>,
): CubeCoord[] {
  const trajectory: CubeCoord[] = [unit.position];
  let currentPos = unit.position;
  const terrain = gameState.map.terrain;
  const modifiers = gameState.map.modifiers;
  const elevation = gameState.map.elevation;
  const moveRange = gameState.unitStats[unit.type].moveRange;

  for (let i = 0; i < 50; i++) {
    const waypoint = computeFlankWaypoint(
      currentPos, targetHex, side, gameState.map.mapRadius, terrain,
    );

    if (cubeDistance(currentPos, waypoint) <= 1) break;

    const path = findPath(
      currentPos, waypoint,
      terrain, unit.type, occupiedKeys,
      unit.movementDirective, modifiers, elevation,
    );
    if (!path || path.length <= 1) break;

    // Walk path spending one turn's movement budget (mirrors moveToward)
    let costBudget = moveRange;
    let lastValidIndex = 0;
    for (let j = 1; j < path.length; j++) {
      const prevKey = hexToKey(path[j - 1]!);
      const curKey = hexToKey(path[j]!);
      const terrainType = terrain.get(curKey);
      if (!terrainType) break;
      const stepCost = getMoveCost(
        terrainType, unit.type, unit.movementDirective,
        modifiers.get(curKey),
        elevation.get(prevKey),
        elevation.get(curKey),
      );
      if (stepCost === Infinity) break;
      costBudget -= stepCost;
      if (costBudget < 0) break;
      lastValidIndex = j;
    }

    if (lastValidIndex === 0) break;
    currentPos = path[lastValidIndex]!;
    trajectory.push(currentPos);

    if (cubeDistance(currentPos, targetHex) <= 1) break;
  }

  return trajectory;
}

// ---------------------------------------------------------------------------
// ROE icons — small geometric icons at target hex
// ---------------------------------------------------------------------------

function createCrosshairIcon(
  cx: number, cy: number, cz: number,
  r: number, color: number, alpha: number,
): THREE.LineSegments {
  const pts: number[] = [];

  // Circle (24 segments)
  for (let i = 0; i < 24; i++) {
    const a1 = (i / 24) * Math.PI * 2;
    const a2 = ((i + 1) / 24) * Math.PI * 2;
    pts.push(cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r);
    pts.push(cx + Math.cos(a2) * r, cy, cz + Math.sin(a2) * r);
  }

  // Cross
  pts.push(cx - r * 1.3, cy, cz, cx + r * 1.3, cy, cz);
  pts.push(cx, cy, cz - r * 1.3, cx, cy, cz + r * 1.3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 3;
  return lines;
}

function createChevronIcon(
  cx: number, cy: number, cz: number,
  r: number, color: number, alpha: number,
  direction: 'inward' | 'outward',
): THREE.LineSegments {
  const pts: number[] = [];
  const sign = direction === 'inward' ? 1 : -1;
  const spacing = r * 0.5;

  // Two chevrons
  for (const offset of [-spacing, spacing]) {
    const ox = cx + offset;
    pts.push(ox - r * 0.5 * sign, cy, cz - r * 0.6);
    pts.push(ox + r * 0.5 * sign, cy, cz);
    pts.push(ox + r * 0.5 * sign, cy, cz);
    pts.push(ox - r * 0.5 * sign, cy, cz + r * 0.6);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 3;
  return lines;
}

function createArrowIcon(
  cx: number, cy: number, cz: number,
  r: number, color: number, alpha: number,
): THREE.LineSegments {
  const pts: number[] = [];

  // Triangle pointing forward (+x)
  pts.push(cx + r, cy, cz);
  pts.push(cx - r * 0.6, cy, cz - r * 0.6);

  pts.push(cx - r * 0.6, cy, cz - r * 0.6);
  pts.push(cx - r * 0.6, cy, cz + r * 0.6);

  pts.push(cx - r * 0.6, cy, cz + r * 0.6);
  pts.push(cx + r, cy, cz);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha, depthTest: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 3;
  return lines;
}

function createROEIcon(
  attackDirective: AttackDirective,
  hex: CubeCoord,
  elevation: number,
  alpha: number,
  color: number,
): THREE.LineSegments | null {
  if (attackDirective === 'ignore') return null;

  const world = cachedHexToWorld(hex, elevation);
  const cx = world.x;
  const cy = world.y + 0.25;
  const cz = world.z;
  const r = 1.25;

  switch (attackDirective) {
    case 'shoot-on-sight': return createCrosshairIcon(cx, cy, cz, r, color, alpha);
    case 'skirmish': return createChevronIcon(cx, cy, cz, r, color, alpha, 'inward');
    case 'hunt': return createArrowIcon(cx, cy, cz, r, color, alpha);
    case 'retreat-on-contact': return createChevronIcon(cx, cy, cz, r, color, alpha, 'outward');
  }
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderSelectionHighlights(
  selectedUnit: Unit | null,
  hoveredHex: CubeCoord | null,
  highlightedHexes: Set<string>,
  highlightMode: 'move' | 'attack' | 'none',
  allHexes: CubeCoord[],
  elevationMap: Map<string, number>,
  commandMode: 'none' | 'move' | 'attack',
  pendingCommands: Command[],
  targetSelectionMode?: boolean,
  gameState?: GameState | null,
  currentPlayerView?: string,
  preRevealUnitPositions?: Map<string, CubeCoord> | null,
): void {
  const ctx = getThreeContext();
  if (!ctx) return;

  if (selectionGroup) {
    ctx.scene.remove(selectionGroup);
    selectionGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineLoop || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  selectionGroup = new THREE.Group();
  selectionGroup.name = 'selectionGroup';
  selectionGroup.renderOrder = 2;

  const pal = getPalette();
  const factionColor = currentPlayerView
    ? pal.player[currentPlayerView === 'player1' ? 'p1' : 'p2'].primary
    : pal.player.p1.primary;

  // Invalidate trajectory cache when gameState changes
  if (gameState && gameState !== lastGameStateRef) {
    vizCache.clear();
    lastGameStateRef = gameState;
  }

  // Build set of current friendly unit IDs to prune stale cache entries
  if (gameState && currentPlayerView) {
    const currentIds = new Set(
      gameState.players[currentPlayerView as 'player1' | 'player2'].units.map((u) => u.id),
    );
    for (const key of vizCache.keys()) {
      const unitId = key.split('|')[0]!;
      if (!currentIds.has(unitId)) vizCache.delete(key);
    }
  }

  // Move/attack range
  if (highlightedHexes.size > 0 && highlightMode !== 'none') {
    const color = highlightMode === 'move' ? pal.overlay.moveRange : pal.overlay.attackRange;
    const fillAlpha = highlightMode === 'move' ? 0.08 : 0.1;

    for (const hex of allHexes) {
      const key = hexToKey(hex);
      if (!highlightedHexes.has(key)) continue;
      const elev = elevationMap.get(key) ?? 0;

      selectionGroup.add(createHexFill(hex, elev, color, fillAlpha, 0.005));
      selectionGroup.add(createHexOutline(hex, elev, color, 0.7, 0.006));
    }
  }

  // Redirect commands have no spatial target to highlight
  void pendingCommands;

  // Target selection mode: blue hover + target hex + path
  if (targetSelectionMode && selectedUnit && gameState) {
    // Hovered hex in target mode: bright blue
    if (hoveredHex) {
      const key = hexToKey(hoveredHex);
      const elev = elevationMap.get(key) ?? 0;
      selectionGroup.add(createHexOutline(hoveredHex, elev, factionColor, 0.9, 0.007));
      selectionGroup.add(createHexFill(hoveredHex, elev, factionColor, 0.12, 0.005));
    }
  } else if (hoveredHex) {
    // Normal hover: electric blue in move/attack mode, white otherwise
    const key = hexToKey(hoveredHex);
    const elev = elevationMap.get(key) ?? 0;
    const hoverColor = commandMode === 'move' ? pal.overlay.hoverMove : commandMode === 'attack' ? pal.overlay.hoverAttack : pal.overlay.hoverNeutral;
    const hoverAlpha = commandMode !== 'none' ? 0.8 : 0.6;
    selectionGroup.add(createHexOutline(hoveredHex, elev, hoverColor, hoverAlpha, 0.007));
    if (commandMode === 'move') {
      selectionGroup.add(createHexFill(hoveredHex, elev, pal.overlay.hoverMove, 0.1, 0.005));
    }
  }

  // Directive targets for all friendly units
  if (gameState && currentPlayerView && !targetSelectionMode) {
    const friendlyUnits = gameState.players[currentPlayerView as 'player1' | 'player2'].units;
    const allUnits = [...gameState.players.player1.units, ...gameState.players.player2.units];
    // During reveal, use pre-resolution positions for path computation
    const usePreReveal = preRevealUnitPositions && preRevealUnitPositions.size > 0;
    const occupiedKeys = new Set(allUnits.map((u) => {
      const prePos = usePreReveal ? preRevealUnitPositions!.get(u.id) : null;
      return hexToKey(prePos ?? u.position);
    }));

    for (const unit of friendlyUnits) {
      const target = unit.directiveTarget;
      let targetHex: CubeCoord | null = null;

      if (target.type === 'hex') {
        targetHex = target.hex ?? null;
      } else if (target.type === 'enemy-unit' && 'unitId' in target) {
        const enemyPlayer = unit.owner === 'player1' ? 'player2' : 'player1';
        const enemy = gameState.players[enemyPlayer].units.find((u) => u.id === target.unitId);
        if (enemy) targetHex = enemy.position;
      }

      if (!targetHex || !gameState.map.terrain.has(hexToKey(targetHex))) continue;

      const isSelected = selectedUnit?.id === unit.id;
      const tKey = hexToKey(targetHex);
      const tElev = elevationMap.get(tKey) ?? 0;
      const lineAlpha = isSelected ? 0.9 : 0.4;

      // Blue target highlight — brighter for selected unit
      selectionGroup.add(createHexFill(targetHex, tElev, pal.overlay.directiveTarget, isSelected ? 0.2 : 0.1, 0.005));
      selectionGroup.add(createHexOutline(targetHex, tElev, pal.overlay.directiveTarget, isSelected ? 1.0 : 0.5, 0.008));

      // During reveal, use pre-resolution position as path start
      const pathStart = (usePreReveal ? preRevealUnitPositions!.get(unit.id) : null) ?? unit.position;

      // Directive-specific path visualization
      switch (unit.movementDirective) {
        case 'hold':
          // No path line — unit stays put
          break;

        case 'advance': {
          const path = findPath(
            pathStart, targetHex,
            gameState.map.terrain, unit.type, occupiedKeys,
            unit.movementDirective, gameState.map.modifiers, gameState.map.elevation,
          );
          if (path && path.length > 1) {
            selectionGroup.add(createPathLine(path, elevationMap, factionColor, lineAlpha));
          }
          break;
        }

        case 'flank-left':
        case 'flank-right': {
          const side = unit.movementDirective === 'flank-left' ? 'left' : 'right';
          const cacheKey = vizCacheKey(unit);
          let trajectory = vizCache.get(cacheKey);
          if (!trajectory) {
            // Use a synthetic unit at pre-reveal position for trajectory simulation
            const simUnit = usePreReveal ? { ...unit, position: pathStart } : unit;
            trajectory = simulateFlankTrajectory(simUnit, targetHex, side, gameState, occupiedKeys);
            vizCache.set(cacheKey, trajectory);
          }
          if (trajectory.length > 1) {
            selectionGroup.add(createDashedPathLine(
              trajectory, elevationMap, factionColor, lineAlpha, 0.4, 0.2,
            ));
          }
          break;
        }

        case 'patrol': {
          // Path line to target
          const patrolPath = findPath(
            pathStart, targetHex,
            gameState.map.terrain, unit.type, occupiedKeys,
            unit.movementDirective, gameState.map.modifiers, gameState.map.elevation,
          );
          if (patrolPath && patrolPath.length > 1) {
            selectionGroup.add(createDashedPathLine(
              patrolPath, elevationMap, factionColor, lineAlpha, 0.2, 0.2,
            ));
          }
          // Patrol circle
          const patrolR = unit.patrolRadius ?? 3;
          const patrolHexes = hexesInRadius(targetHex, patrolR);
          for (const patrolHex of patrolHexes) {
            const pKey = hexToKey(patrolHex);
            if (!gameState.map.terrain.has(pKey)) continue;
            if (cubeDistance(targetHex, patrolHex) === patrolR) {
              const pElev = elevationMap.get(pKey) ?? 0;
              selectionGroup.add(createHexOutline(
                patrolHex, pElev, factionColor, isSelected ? 0.6 : 0.3, 0.006,
              ));
            }
          }
          break;
        }
      }

      // ROE icon at target hex
      const roeIcon = createROEIcon(unit.attackDirective, targetHex, tElev, isSelected ? 0.9 : 0.4, factionColor);
      if (roeIcon) {
        selectionGroup.add(roeIcon);
      }
    }
  }

  // Selected unit: beige outline
  if (selectedUnit) {
    const key = hexToKey(selectedUnit.position);
    const elev = elevationMap.get(key) ?? 0;
    selectionGroup.add(createHexOutline(selectedUnit.position, elev, pal.overlay.selectedUnit, 0.9, 0.008));
  }

  ctx.scene.add(selectionGroup);
}
