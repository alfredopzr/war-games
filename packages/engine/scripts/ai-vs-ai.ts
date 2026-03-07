#!/usr/bin/env tsx
// =============================================================================
// AI vs AI Headless Match Runner — CLI Entry Point
// =============================================================================
// Usage: npx tsx packages/engine/scripts/ai-vs-ai.ts [--matches N] [--seed N]
// =============================================================================

import { runBatch } from '../src/ai-harness';

function parseArgs(argv: string[]): { matches: number; seed: number } {
  let matches = 100;
  let seed = 1;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--matches' && argv[i + 1]) {
      matches = parseInt(argv[i + 1]!, 10);
      if (isNaN(matches) || matches < 1) throw new Error(`Invalid --matches value: ${argv[i + 1]}`);
      i++;
    } else if (arg === '--seed' && argv[i + 1]) {
      seed = parseInt(argv[i + 1]!, 10);
      if (isNaN(seed)) throw new Error(`Invalid --seed value: ${argv[i + 1]}`);
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { matches, seed };
}

const { matches, seed } = parseArgs(process.argv);

console.log(`Running ${matches} AI vs AI matches (base seed: ${seed})...\n`);

const start = performance.now();
runBatch({ matchCount: matches, baseSeed: seed }, true);
const elapsed = ((performance.now() - start) / 1000).toFixed(1);

console.log(`Completed in ${elapsed}s`);
