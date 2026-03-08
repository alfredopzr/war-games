import { createGame, placeUnit, startBattlePhase, checkRoundEnd, scoreRound } from './src/game-state';
import { aiBuildPhase, aiBattlePhase } from './src/ai';
import { resolveTurn } from './src/resolution-pipeline';
import { createCommandPool } from './src/commands';
import { mulberry32 } from './src/rng';
import { resetUnitIdCounter } from './src/units';
import { COMBAT_RNG_MIN, COMBAT_RNG_RANGE } from './src/combat';

function runSwappedMatch(seed: number): string | null {
  resetUnitIdCounter();
  const rng = mulberry32(seed);
  const combatRng = (): number => COMBAT_RNG_MIN + rng() * COMBAT_RNG_RANGE;
  
  const state = createGame(seed);
  
  // SWAP deploy zones
  const temp = state.map.player1Deployment;
  state.map.player1Deployment = state.map.player2Deployment;
  state.map.player2Deployment = temp;
  
  const MAX_TURNS = 50;
  
  while (state.phase !== 'game-over') {
    const buildSeed = Math.floor(rng() * 0x7fffffff);
    const p1BuildRng = mulberry32(buildSeed);
    const p2BuildRng = mulberry32(buildSeed);
    
    const p1Actions = aiBuildPhase(state, 'player1', p1BuildRng);
    for (const action of p1Actions) {
      placeUnit(state, 'player1', action.unitType, action.position,
        action.movementDirective, action.attackDirective, 
        action.specialtyModifier, action.directiveTarget);
    }
    const p2Actions = aiBuildPhase(state, 'player2', p2BuildRng);
    for (const action of p2Actions) {
      placeUnit(state, 'player2', action.unitType, action.position,
        action.movementDirective, action.attackDirective,
        action.specialtyModifier, action.directiveTarget);
    }
    startBattlePhase(state);
    
    let roundTurns = 0;
    while (state.phase === 'battle') {
      roundTurns++;
      if (roundTurns > MAX_TURNS) break;
      
      const p1Cmds = aiBattlePhase(state, 'player1');
      const p2Cmds = aiBattlePhase(state, 'player2');
      state.round.commandPools = { player1: createCommandPool(), player2: createCommandPool() };
      resolveTurn(state, p1Cmds, p2Cmds, combatRng);
      
      const roundEnd = checkRoundEnd(state);
      if (roundEnd.roundOver) {
        scoreRound(state, roundEnd.winner);
        break;
      }
      state.round.turnNumber++;
    }
    if (roundTurns > MAX_TURNS) break;
  }
  
  return state.winner;
}

let p1w = 0, p2w = 0, d = 0;
for (let seed = 100; seed < 120; seed++) {
  const winner = runSwappedMatch(seed);
  if (winner === 'player1') p1w++;
  else if (winner === 'player2') p2w++;
  else d++;
  process.stdout.write(`seed ${seed}: ${winner ?? 'draw'}\n`);
}
console.log(`\nSWAPPED deploy zones: P1=${p1w} P2=${p2w} Draw=${d}`);
