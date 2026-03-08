import { runMatch } from './src/ai-harness';
import { generateMap } from './src/map-gen';

// Monkey-patch generateMap to swap deploy zones
const origGenerateMap = generateMap;
const mapGenModule = await import('./src/map-gen');
const origFn = mapGenModule.generateMap;

// We can't easily monkey-patch, but we CAN modify the game state after creation.
// Let's patch the ai-harness flow by modifying createGame.
import { createGame } from './src/game-state';
const gameStateModule = await import('./src/game-state');
const origCreateGame = gameStateModule.createGame;

// @ts-ignore
gameStateModule.createGame = function(...args: any[]) {
  const state = origCreateGame.apply(null, args);
  // Swap deploy zones
  const temp = state.map.player1Deployment;
  state.map.player1Deployment = state.map.player2Deployment;
  state.map.player2Deployment = temp;
  return state;
};

// Run the same 20 seeds
let p1w = 0, p2w = 0, d = 0;
for (let seed = 100; seed < 120; seed++) {
  const result = runMatch(seed);
  if (result.winner === 'player1') p1w++;
  else if (result.winner === 'player2') p2w++;
  else d++;
}
console.log(`With SWAPPED deploy zones: P1=${p1w} P2=${p2w} Draw=${d}`);
