import type { Palette } from './palette';

function numToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export function injectCssPalette(p: Palette): void {
  const root = document.documentElement.style;
  root.setProperty('--player1-primary', p.player.p1.hud);
  root.setProperty('--player2-primary', p.player.p2.hud);
  root.setProperty('--terrain-plains', numToHex(p.terrain.plains));
  root.setProperty('--terrain-forest', numToHex(p.terrain.forest));
  root.setProperty('--terrain-mountain', numToHex(p.terrain.mountain));
  root.setProperty('--terrain-city', numToHex(p.terrain.city));
  root.setProperty('--map-objective', numToHex(p.map.objective));
  root.setProperty('--hp-healthy', p.unit.hpHealthy);
  root.setProperty('--hp-warning', p.unit.hpWarning);
  root.setProperty('--hp-critical', p.unit.hpCritical);
}
