import { createGame, placeUnit, startBattlePhase, checkRoundEnd, scoreRound } from './src/game-state';
import { aiBuildPhase, aiBattlePhase } from './src/ai';
import { resolveTurn } from './src/resolution-pipeline';
import { createCommandPool } from './src/commands';
import { mulberry32 } from './src/rng';
import { resetUnitIdCounter } from './src/units';
import { COMBAT_RNG_MIN, COMBAT_RNG_RANGE } from './src/combat';
import { hexToKey } from './src/hex';

resetUnitIdCounter();
const seed = 101;
const rng = mulberry32(seed);
const combatRng = (): number => COMBAT_RNG_MIN + rng() * COMBAT_RNG_RANGE;
const state = createGame(seed);

// Build phase
const buildSeed = Math.floor(rng() * 0x7fffffff);
const p1Actions = aiBuildPhase(state, 'player1', mulberry32(buildSeed));
for (const a of p1Actions) placeUnit(state, 'player1', a.unitType, a.position, a.movementDirective, a.attackDirective, a.specialtyModifier, a.directiveTarget);
const p2Actions = aiBuildPhase(state, 'player2', mulberry32(buildSeed));
for (const a of p2Actions) placeUnit(state, 'player2', a.unitType, a.position, a.movementDirective, a.attackDirective, a.specialtyModifier, a.directiveTarget);
startBattlePhase(state);

console.log(`P1 units: ${state.players.player1.units.length}, P2 units: ${state.players.player2.units.length}`);
const objKey = hexToKey(state.map.centralObjective);

for (let turn = 1; turn <= 20; turn++) {
  const p1Cmds = aiBattlePhase(state, 'player1');
  const p2Cmds = aiBattlePhase(state, 'player2');
  state.round.commandPools = { player1: createCommandPool(), player2: createCommandPool() };
  resolveTurn(state, p1Cmds, p2Cmds, combatRng);

  // Analyze events
  let p1Dmg = 0, p2Dmg = 0, p1Kills = 0, p2Kills = 0;
  let p1Intercepts = 0, p2Intercepts = 0;
  for (const e of state.pendingEvents) {
    if (e.type === 'damage') {
      if (e.actingPlayer === 'player1') p1Dmg += e.damage;
      else p2Dmg += e.damage;
    }
    if (e.type === 'kill') {
      if (e.actingPlayer === 'player1') p1Kills++;
      else p2Kills++;
    }
    if (e.type === 'intercept') {
      if (e.actingPlayer === 'player1') p1Intercepts++;
      else p2Intercepts++;
    }
  }

  // Check KotH status
  const occ = state.round.objective;
  const p1OnObj = state.players.player1.units.some(u => hexToKey(u.position) === objKey);
  const p2OnObj = state.players.player2.units.some(u => hexToKey(u.position) === objKey);
  
  console.log(`T${turn}: p1alive=${state.players.player1.units.length} p2alive=${state.players.player2.units.length} | dmg p1=${p1Dmg} p2=${p2Dmg} | kills p1=${p1Kills} p2=${p2Kills} | int p1=${p1Intercepts} p2=${p2Intercepts} | obj: occ=${occ.occupiedBy} held=${occ.turnsHeld} p1on=${p1OnObj} p2on=${p2OnObj}`);

  const roundEnd = checkRoundEnd(state);
  if (roundEnd.roundOver) {
    console.log(`Round ends: winner=${roundEnd.winner} reason=${roundEnd.reason}`);
    break;
  }
  state.round.turnNumber++;
}
