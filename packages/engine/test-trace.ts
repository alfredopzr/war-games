import { runMatch } from './src/ai-harness';
const result = runMatch(100, true);
console.log('Winner:', result.winner);
// Check round results
for (const r of result.roundResults) {
  console.log(`Round ${r.roundNumber}: winner=${r.roundWinner}, p1units=${r.p1UnitsEnd}, p2units=${r.p2UnitsEnd}, p1kills=${r.p1Kills}, p2kills=${r.p2Kills}`);
}
