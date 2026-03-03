import type { ObjectiveState, PlayerId } from '@hexwar/engine';
import { drawHex } from './hex-render';

function playerLabel(player: PlayerId): string {
  return player === 'player1' ? 'P1' : 'P2';
}

/**
 * Draw the central objective hex with a pulsing golden glow and occupation status.
 * `time` should be a monotonic timestamp (e.g. from performance.now()) to drive the pulse.
 */
export function drawObjective(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  hexSize: number,
  objective: ObjectiveState,
  time: number,
): void {
  // Pulsing glow effect
  const pulse = 0.3 + 0.2 * Math.sin(time / 400);
  const glowRadius = hexSize * 0.85;

  ctx.save();

  // Outer golden glow
  const gradient = ctx.createRadialGradient(
    centerX, centerY, glowRadius * 0.3,
    centerX, centerY, glowRadius,
  );
  gradient.addColorStop(0, `rgba(255, 215, 0, ${pulse})`);
  gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

  ctx.beginPath();
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Border color depends on occupation
  let borderColor = '#ffd700';
  if (objective.occupiedBy === 'player1') {
    borderColor = '#4488cc';
  } else if (objective.occupiedBy === 'player2') {
    borderColor = '#cc4444';
  }

  // Draw hex border on top of the existing terrain hex
  drawHex(ctx, centerX, centerY, hexSize, 'transparent', borderColor, 2.5);

  // Central star/diamond marker
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#b8960c';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Occupation status text
  if (objective.occupiedBy) {
    const label = `${playerLabel(objective.occupiedBy)}: ${objective.turnsHeld}/2`;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, centerX, centerY + 10);
  }

  ctx.restore();
}
