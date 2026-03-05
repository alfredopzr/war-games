import type { PlayerId, UnitType } from '@hexwar/engine';

export const ASH_EMBER_TERRAIN: Record<string, number> = {
  plains: 0x6A6A58,
  forest: 0x3A4030,
  mountain: 0x505058,
  city: 0x7A6048,
};

export const OBJECTIVE_COLOR = 0xA08A40;
export const FOG_NEVER_SEEN = 0x16160E;

export const PLAYER_COLORS = {
  player1: { fill: '#6a7a5a', stroke: '#4a5a3a', light: '#8a9a7a' },
  player2: { fill: '#8a5a4a', stroke: '#6a3a2a', light: '#aa7a6a' },
} as const;

export const UNIT_LABELS: Record<string, string> = {
  infantry: 'I',
  tank: 'T',
  artillery: 'A',
  recon: 'R',
};

// ---------------------------------------------------------------------------
// 3D Model System
// ---------------------------------------------------------------------------

export type Faction = 'engineer' | 'caravaner';

export const PLAYER_FACTION: Record<PlayerId, Faction> = {
  player1: 'engineer',
  player2: 'caravaner',
};

interface ModelEntry {
  readonly glbPath: string;
}

export const MODEL_MANIFEST: Record<Faction, Record<UnitType, ModelEntry>> = {
  engineer: {
    infantry:  { glbPath: '/models/infantry_engineer.glb' },
    tank:      { glbPath: '/models/tank_engineer.glb' },
    artillery: { glbPath: '/models/artillery_engineer.glb' },
    recon:     { glbPath: '/models/scout_engineer.glb' },
  },
  caravaner: {
    infantry:  { glbPath: '/models/infantry_caravaner.glb' },
    tank:      { glbPath: '/models/tank_caravaner.glb' },
    artillery: { glbPath: '/models/artillery_caravaner.glb' },
    recon:     { glbPath: '/models/scout_caravaner.glb' },
  },
};
