import { runMatch } from '../src/ai-harness';
import { resetUnitIdCounter } from '../src/units';

resetUnitIdCounter();
try {
  const result = runMatch(42, false);
  console.log('winner:', result.winner);
  console.log('rounds:', result.rounds);
  console.log('totalTurns:', result.totalTurns);
  console.log('kills:', result.kills.length);
  console.log('roundResults:', JSON.stringify(result.roundResults));
} catch (e) {
  console.error('ERROR:', e);
}
