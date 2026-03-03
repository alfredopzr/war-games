import type { Unit, DirectiveType } from '@hexwar/engine';
import { UNIT_STATS } from '@hexwar/engine';
import { PLAYER_COLORS, UNIT_LABELS } from './constants';

const DIRECTIVE_ICONS: Record<DirectiveType, string> = {
  'advance': '\u25B2',   // ▲
  'hold': '\u25A0',      // ■
  'flank-left': '\u25C4', // ◄
  'flank-right': '\u25BA', // ►
  'scout': '\u25CF',     // ●
  'support': '\u25C6',   // ◆
};

/** Draw a small directive indicator above the unit circle. */
function drawDirectiveIndicator(
  ctx: CanvasRenderingContext2D,
  directive: DirectiveType,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  const icon = DIRECTIVE_ICONS[directive];
  ctx.fillStyle = 'rgba(200, 200, 220, 0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(icon, centerX, centerY - radius - 2);
}

/** Draw a unit as a colored circle with letter label, HP pips, and directive icon. */
export function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  centerX: number,
  centerY: number,
  isDamaged = false,
): void {
  const colors = PLAYER_COLORS[unit.owner];
  const radius = 16;

  // Damage flash: draw a red glow behind the unit
  if (isDamaged) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 60, 60, 0.5)';
    ctx.fill();
  }

  // Unit circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = isDamaged ? '#aa2222' : colors.fill;
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

  // Directive indicator above
  drawDirectiveIndicator(ctx, unit.directive, centerX, centerY, radius);

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
