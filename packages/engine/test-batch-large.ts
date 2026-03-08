import { runBatch } from './src/ai-harness';
console.log('Running 100 matches...');
const result = runBatch({ matchCount: 100, baseSeed: 100 });
console.log('P1 wins:', result.p1Wins);
console.log('P2 wins:', result.p2Wins);
console.log('Draws:', result.draws);
const total = result.p1Wins + result.p2Wins + result.draws;
console.log(`Total: ${total}`);
console.log(`P1 rate: ${(result.p1Wins/total*100).toFixed(1)}%`);
