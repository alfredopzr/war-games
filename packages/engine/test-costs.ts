import { createGame } from './src/game-state';
import { computeMovementCostField } from './src/pathfinding';
import { hexToKey, cubeDistance } from './src/hex';
import { resetUnitIdCounter } from './src/units';

for (let seed = 100; seed < 120; seed++) {
  resetUnitIdCounter();
  const state = createGame(seed);
  const obj = state.map.centralObjective;
  const objKey = hexToKey(obj);
  
  // Compute movement cost field from objective outward for infantry
  const costField = computeMovementCostField(
    obj, state.map.terrain, 'infantry', new Set(), undefined, 
    state.map.modifiers, state.map.elevation
  );
  
  // Average cost from each deploy zone to objective
  let p1Total = 0, p1Count = 0;
  for (const h of state.map.player1Deployment) {
    const cost = costField.get(hexToKey(h));
    if (cost !== undefined) { p1Total += cost; p1Count++; }
  }
  let p2Total = 0, p2Count = 0;
  for (const h of state.map.player2Deployment) {
    const cost = costField.get(hexToKey(h));
    if (cost !== undefined) { p2Total += cost; p2Count++; }
  }
  
  const p1Avg = p1Count > 0 ? p1Total / p1Count : -1;
  const p2Avg = p2Count > 0 ? p2Total / p2Count : -1;
  console.log(`seed=${seed}  p1_path_cost=${p1Avg.toFixed(1)}  p2_path_cost=${p2Avg.toFixed(1)}  diff=${(p1Avg - p2Avg).toFixed(1)}  p1_cheaper=${p1Avg < p2Avg}`);
}
