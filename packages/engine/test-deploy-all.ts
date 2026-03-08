import { createGame } from './src/game-state';
import { resetUnitIdCounter } from './src/units';
import { cubeDistance } from './src/hex';

for (let seed = 100; seed < 110; seed++) {
  resetUnitIdCounter();
  const state = createGame(seed);
  const obj = state.map.centralObjective;
  
  const p1d = state.map.player1Deployment.slice(0, 8).map(h => cubeDistance(h, obj));
  const p2d = state.map.player2Deployment.slice(0, 8).map(h => cubeDistance(h, obj));
  const p1avg = p1d.reduce((a,b)=>a+b,0)/p1d.length;
  const p2avg = p2d.reduce((a,b)=>a+b,0)/p2d.length;
  const p1min = Math.min(...p1d);
  const p2min = Math.min(...p2d);
  console.log(`seed=${seed} p1_avg=${p1avg.toFixed(1)} p2_avg=${p2avg.toFixed(1)} p1_min=${p1min} p2_min=${p2min} gap=${(p2avg-p1avg).toFixed(1)}`);
}
