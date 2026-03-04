import { Graphics, Text, TextStyle } from 'pixi.js';
import { effectsLayer } from './layers';

// ---------------------------------------------------------------------------
// Active effect types
// ---------------------------------------------------------------------------

interface DamageNumberEffect {
  kind: 'damage-number';
  display: Text;
  speed: number;
  fadeRate: number;
}

interface AttackTracerEffect {
  kind: 'attack-tracer';
  display: Graphics;
  age: number;
  lifetime: number;
}

interface DeathMarkerEffect {
  kind: 'death-marker';
  display: Graphics;
  fadeRate: number;
}

type ActiveEffect = DamageNumberEffect | AttackTracerEffect | DeathMarkerEffect;

const activeEffects: ActiveEffect[] = [];

// ---------------------------------------------------------------------------
// Spawn functions
// ---------------------------------------------------------------------------

/** Spawn a floating damage number that rises and fades. */
export function spawnDamageNumber(x: number, y: number, damage: number): void {
  const style = new TextStyle({
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    fill: 0xff4444,
  });
  const text = new Text({ text: `-${damage}`, style });
  text.anchor.set(0.5, 0.5);
  text.position.set(x, y);
  effectsLayer.addChild(text);

  activeEffects.push({
    kind: 'damage-number',
    display: text,
    speed: 40, // pixels per second (scaled by delta at 60fps)
    fadeRate: 1.5, // alpha per second
  });
}

/** Spawn an attack tracer line between two points that flashes and fades. */
export function spawnAttackTracer(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): void {
  const g = new Graphics();
  g.moveTo(fromX, fromY);
  g.lineTo(toX, toY);
  g.stroke({ color: 0xffff88, width: 2 });
  effectsLayer.addChild(g);

  activeEffects.push({
    kind: 'attack-tracer',
    display: g,
    age: 0,
    lifetime: 24, // ~0.4s at 60fps (in deltaTime units)
  });
}

/** Spawn a death marker (X shape) at a position that fades over time. */
export function spawnDeathMarker(x: number, y: number): void {
  const g = new Graphics();
  const size = 10;
  // Draw an X
  g.moveTo(x - size, y - size);
  g.lineTo(x + size, y + size);
  g.stroke({ color: 0xff2222, width: 3 });
  g.moveTo(x + size, y - size);
  g.lineTo(x - size, y + size);
  g.stroke({ color: 0xff2222, width: 3 });
  effectsLayer.addChild(g);

  activeEffects.push({
    kind: 'death-marker',
    display: g,
    fadeRate: 0.33, // fades over ~3 seconds (alpha per second at 60fps)
  });
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

/** Called every frame — update/remove active effects. delta is in frames (1 = 1/60s). */
export function updateEffects(delta: number): void {
  const dt = delta / 60; // convert frame-delta to seconds

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const effect = activeEffects[i]!;

    switch (effect.kind) {
      case 'damage-number': {
        effect.display.y -= effect.speed * dt;
        effect.display.alpha -= effect.fadeRate * dt;
        if (effect.display.alpha <= 0) {
          effectsLayer.removeChild(effect.display);
          effect.display.destroy();
          activeEffects.splice(i, 1);
        }
        break;
      }
      case 'attack-tracer': {
        effect.age += delta;
        effect.display.alpha = 1 - effect.age / effect.lifetime;
        if (effect.age >= effect.lifetime) {
          effectsLayer.removeChild(effect.display);
          effect.display.destroy();
          activeEffects.splice(i, 1);
        }
        break;
      }
      case 'death-marker': {
        effect.display.alpha -= effect.fadeRate * dt;
        if (effect.display.alpha <= 0) {
          effectsLayer.removeChild(effect.display);
          effect.display.destroy();
          activeEffects.splice(i, 1);
        }
        break;
      }
    }
  }
}

/** Clear all active effects immediately. */
export function clearEffects(): void {
  for (const effect of activeEffects) {
    effectsLayer.removeChild(effect.display);
    effect.display.destroy();
  }
  activeEffects.length = 0;
}
