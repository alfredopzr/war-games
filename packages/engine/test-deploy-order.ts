import { createGame } from './src/game-state';
import { resetUnitIdCounter } from './src/units';
import { cubeDistance, hexToKey } from './src/hex';

resetUnitIdCounter();
const state = createGame(100);
const obj = state.map.centralObjective;

console.log('P1 deploy zone (first 10 hexes):');
for (let i = 0; i < Math.min(10, state.map.player1Deployment.length); i++) {
  const h = state.map.player1Deployment[i]!;
  console.log(`  [${i}] (${h.q},${h.r},${h.s}) dist=${cubeDistance(h, obj)} key=${hexToKey(h)}`);
}
console.log('P2 deploy zone (first 10 hexes):');
for (let i = 0; i < Math.min(10, state.map.player2Deployment.length); i++) {
  const h = state.map.player2Deployment[i]!;
  console.log(`  [${i}] (${h.q},${h.r},${h.s}) dist=${cubeDistance(h, obj)} key=${hexToKey(h)}`);
}

// Distances of first 8 hexes (typical army size)
const p1First8 = state.map.player1Deployment.slice(0, 8).map(h => cubeDistance(h, obj));
const p2First8 = state.map.player2Deployment.slice(0, 8).map(h => cubeDistance(h, obj));
console.log(`\nP1 first 8 avg dist: ${(p1First8.reduce((a,b)=>a+b,0)/8).toFixed(1)}, sorted: [${p1First8.sort((a,b)=>a-b).join(', ')}]`);
console.log(`P2 first 8 avg dist: ${(p2First8.reduce((a,b)=>a+b,0)/8).toFixed(1)}, sorted: [${p2First8.sort((a,b)=>a-b).join(', ')}]`);
