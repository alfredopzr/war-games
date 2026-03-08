import { createHex, hexToKey, CUBE_DIRECTIONS, cubeDistance } from './src/hex';

const R_MINI = 5;
function macroToGame(mc: {q:number,r:number,s:number}) {
  const q = mc.q * (2 * R_MINI + 1) + mc.r * R_MINI;
  const r = mc.q * (-R_MINI) + mc.r * (R_MINI + 1);
  return createHex(q, r);
}

const R_MACRO = 3;
const corners = CUBE_DIRECTIONS.map((dir) => {
  const macroCorner = createHex(dir.q * R_MACRO, dir.r * R_MACRO);
  return macroToGame(macroCorner);
});

const origin = createHex(0, 0);
for (let i = 0; i < corners.length; i++) {
  const c = corners[i]!;
  console.log(`corner ${i}: q=${c.q} r=${c.r} s=${c.s}  dist_to_origin=${cubeDistance(c, origin)}  key=${hexToKey(c)}`);
}

// Check symmetry between corner 0 and corner 3
const c0 = corners[0]!;
const c3 = corners[3]!;
console.log(`\ncorner 0: (${c0.q}, ${c0.r}, ${c0.s})`);
console.log(`corner 3: (${c3.q}, ${c3.r}, ${c3.s})`);
console.log(`Are they exact negatives? q: ${c0.q === -c3.q}, r: ${c0.r === -c3.r}, s: ${c0.s === -c3.s}`);
