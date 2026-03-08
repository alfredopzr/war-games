import { generateMap, mulberry32, hexToKey, cubeDistance } from './src/index';

for (let seed = 100; seed < 120; seed++) {
  const map = generateMap(seed);
  // Check path cost from deploy zones to center
  const obj = map.centralObjective;
  const p1Dists = map.player1Deployment.map(h => cubeDistance(h, obj));
  const p2Dists = map.player2Deployment.map(h => cubeDistance(h, obj));
  const p1Min = Math.min(...p1Dists);
  const p2Min = Math.min(...p2Dists);
  const p1Avg = p1Dists.reduce((a,b) => a+b, 0) / p1Dists.length;
  const p2Avg = p2Dists.reduce((a,b) => a+b, 0) / p2Dists.length;
  console.log(`seed=${seed}  p1_min=${p1Min}  p2_min=${p2Min}  p1_avg=${p1Avg.toFixed(1)}  p2_avg=${p2Avg.toFixed(1)}  diff=${(p2Min - p1Min)}`);
}
