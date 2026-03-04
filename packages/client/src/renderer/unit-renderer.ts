import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { hexToKey, UNIT_STATS } from '@hexwar/engine';
import type { GameState, CubeCoord, Unit, UnitType, PlayerId, DirectiveType } from '@hexwar/engine';
import { unitLayer } from './layers';
import { hexToPixel } from './hex-render';
import { HEX_SIZE, PLAYER_COLORS, UNIT_LABELS } from './constants';
import { drawHpBar } from './hp-bar';
import { useGameStore } from '../store/game-store';

// ---------------------------------------------------------------------------
// Directive indicator symbols
// ---------------------------------------------------------------------------

const DIRECTIVE_ICONS: Record<DirectiveType, string> = {
  'advance': '\u25B2',    // ▲
  'hold': '\u25A0',       // ■
  'flank-left': '\u25C4', // ◄
  'flank-right': '\u25BA', // ►
  'scout': '\u25CF',      // ●
  'support': '\u25C6',    // ◆
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function getEnemyPlayer(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

// Shared text styles (created once, reused)
const labelStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 14,
  fontWeight: 'bold',
  fill: 0xffffff,
});

const directiveStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  fontWeight: 'bold',
  fill: 0xdcdcf0,
});

const checkStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 'bold',
  fill: 0x44ff44,
});

const ghostLabelStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  fontWeight: 'bold',
  fill: 0xaaaaaa,
});

// ---------------------------------------------------------------------------
// Unit drawing
// ---------------------------------------------------------------------------

interface DrawableUnit {
  unit: Unit;
  screenX: number;
  screenY: number;
  isGhost: false;
}

interface DrawableGhost {
  type: UnitType;
  position: CubeCoord;
  screenX: number;
  screenY: number;
  isGhost: true;
}

type Drawable = DrawableUnit | DrawableGhost;

function drawUnit(
  container: Container,
  unit: Unit,
  cx: number,
  cy: number,
  isDamaged: boolean,
  isCommanded: boolean,
): void {
  const g = new Graphics();
  const color = parseColor(PLAYER_COLORS[unit.owner].fill);
  const strokeColor = parseColor(PLAYER_COLORS[unit.owner].stroke);
  const radius = HEX_SIZE * 0.5;

  // Damage flash: red glow behind unit
  if (isDamaged) {
    g.circle(cx, cy, radius + 4);
    g.fill({ color: 0xff3c3c, alpha: 0.5 });
  }

  // Unit circle
  g.circle(cx, cy, radius);
  g.fill({ color, alpha: 1 });
  g.stroke({ color: strokeColor, width: 2 });
  container.addChild(g);

  // Unit type letter
  const label = UNIT_LABELS[unit.type] ?? '?';
  const labelText = new Text({ text: label, style: labelStyle });
  labelText.anchor.set(0.5, 0.5);
  labelText.position.set(cx, cy);
  container.addChild(labelText);

  // Directive indicator above unit
  const icon = DIRECTIVE_ICONS[unit.directive];
  const directiveText = new Text({ text: icon, style: directiveStyle });
  directiveText.anchor.set(0.5, 0.5);
  directiveText.position.set(cx, cy - radius - 10);
  container.addChild(directiveText);

  // HP bar below unit
  const maxHp = UNIT_STATS[unit.type].maxHp;
  const hpG = new Graphics();
  drawHpBar(hpG, cx, cy, unit.hp, maxHp, 28);
  container.addChild(hpG);

  // Commanded checkmark at top-right
  if (isCommanded) {
    const checkText = new Text({ text: '\u2713', style: checkStyle });
    checkText.anchor.set(0.5, 0.5);
    checkText.position.set(cx + radius - 2, cy - radius + 2);
    container.addChild(checkText);
  }
}

function drawGhost(
  container: Container,
  unitType: UnitType,
  cx: number,
  cy: number,
): void {
  const g = new Graphics();
  g.circle(cx, cy, HEX_SIZE * 0.35);
  g.fill({ color: 0x888888, alpha: 0.4 });
  container.addChild(g);

  const label = UNIT_LABELS[unitType] ?? '?';
  const text = new Text({ text: label, style: ghostLabelStyle });
  text.anchor.set(0.5, 0.5);
  text.position.set(cx, cy);
  text.alpha = 0.5;
  container.addChild(text);
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/** Render all units onto unitLayer. */
export function renderUnits(
  state: GameState,
  currentPlayerView: PlayerId,
  visibleHexes: Set<string>,
  lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>,
): void {
  unitLayer.removeChildren();

  const store = useGameStore.getState();
  const pendingCommands = store.pendingCommands;
  const damagedUnits = store.damagedUnits;
  const isBuildPhase = state.phase === 'build';
  const now = Date.now();
  const elevationMap = state.map.elevation;

  // Collect commanded unit IDs from pending commands
  const commandedUnitIds = new Set<string>();
  for (const cmd of pendingCommands) {
    commandedUnitIds.add(cmd.unitId);
  }

  // Collect all drawables
  const drawables: Drawable[] = [];

  const friendly = state.players[currentPlayerView].units;
  for (const unit of friendly) {
    const elev = elevationMap.get(hexToKey(unit.position)) ?? 0;
    const { x, y } = hexToPixel(unit.position, HEX_SIZE, elev);
    drawables.push({ unit, screenX: x, screenY: y, isGhost: false });
  }

  if (!isBuildPhase) {
    const enemyPlayer = getEnemyPlayer(currentPlayerView);
    const enemies = state.players[enemyPlayer].units;
    for (const unit of enemies) {
      const key = hexToKey(unit.position);
      if (visibleHexes.has(key)) {
        const elev = elevationMap.get(key) ?? 0;
        const { x, y } = hexToPixel(unit.position, HEX_SIZE, elev);
        drawables.push({ unit, screenX: x, screenY: y, isGhost: false });
      }
    }

    // Ghost markers for last-known enemies
    for (const [, ghost] of lastKnownEnemies) {
      const ghostKey = hexToKey(ghost.position);
      if (!visibleHexes.has(ghostKey)) {
        const elev = elevationMap.get(ghostKey) ?? 0;
        const { x, y } = hexToPixel(ghost.position, HEX_SIZE, elev);
        drawables.push({ type: ghost.type, position: ghost.position, screenX: x, screenY: y, isGhost: true });
      }
    }
  }

  // Sort by screen Y for isometric depth ordering (further down = drawn last = on top)
  drawables.sort((a, b) => a.screenY - b.screenY);

  // Draw each
  for (const d of drawables) {
    const c = new Container();
    if (d.isGhost) {
      drawGhost(c, d.type, d.screenX, d.screenY);
    } else {
      const dmgTimestamp = damagedUnits.get(d.unit.id);
      const isDamaged = dmgTimestamp !== undefined && now - dmgTimestamp < 500;
      const isCommanded = commandedUnitIds.has(d.unit.id);
      drawUnit(c, d.unit, d.screenX, d.screenY, isDamaged, isCommanded);
    }
    unitLayer.addChild(c);
  }
}
