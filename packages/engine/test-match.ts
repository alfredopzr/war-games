import { runMatch } from './src/ai-harness';
console.log('Running match...');
const result = runMatch(100);
console.log('Winner:', result.winner);
console.log('Rounds:', result.rounds.length);
