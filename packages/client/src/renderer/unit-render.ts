import type { Unit } from '@hexwar/engine';
import { UNIT_STATS } from '@hexwar/engine';
import { PLAYER_COLORS, UNIT_LABELS } from './constants';

/** Draw a unit as a colored circle with letter label and HP pips. */
export function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
): void {
  const colors = PLAYER_COLORS[unit.owner];
  const radius = 16;

  // Unit circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Unit label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(UNIT_LABELS[unit.type] ?? '?', centerX, centerY);

  // HP pips below
  const maxHp = UNIT_STATS[unit.type].maxHp;
  const pipSpacing = 6;
  const pipStartX = centerX - ((maxHp - 1) * pipSpacing) / 2;
  for (let i = 0; i < maxHp; i++) {
    ctx.beginPath();
    ctx.arc(pipStartX + i * pipSpacing, centerY + radius + 8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i < unit.hp ? '#4f4' : '#444';
    ctx.fill();
  }
}
