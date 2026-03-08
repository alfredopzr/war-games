import { runBatch } from './src/ai-harness';
console.log('Running 20 matches...');
const result = runBatch({ matchCount: 20, baseSeed: 100 });
console.log('P1 wins:', result.p1Wins);
console.log('P2 wins:', result.p2Wins);
console.log('Draws:', result.draws);
console.log('Total:', result.totalMatches);
