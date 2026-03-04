import { Graphics } from 'pixi.js';

/** Draw an HP bar below a unit circle at the given center position. */
export function drawHpBar(
  g: Graphics,
  cx: number,
  cy: number,
  currentHp: number,
  maxHp: number,
  barWidth: number,
): void {
  const barHeight = 4;
  const barX = cx - barWidth / 2;
  const barY = cy + 14; // below the unit circle

  // Background
  g.rect(barX, barY, barWidth, barHeight);
  g.fill({ color: 0x333333, alpha: 1 });

  // Fill color based on HP percentage
  const ratio = currentHp / maxHp;
  let fillColor: number;
  if (ratio > 0.6) {
    fillColor = 0x44ff44;
  } else if (ratio > 0.3) {
    fillColor = 0xffcc00;
  } else {
    fillColor = 0xff4444;
  }

  const fillWidth = barWidth * ratio;
  g.rect(barX, barY, fillWidth, barHeight);
  g.fill({ color: fillColor, alpha: 1 });
}
