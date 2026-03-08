import type { PlayerId, UnitType } from '@hexwar/engine';
import { getPalette, type FactionId } from './palette';

export type Faction = FactionId;

export const PLAYER_FACTION: Record<PlayerId, Faction> = {
  player1: 'iron-collective',
  player2: 'caravaner',
};

export function getPlayerColor(
  unitOwner: PlayerId,
  _observingPlayer: PlayerId,
): { path: number; tracer: number } {
  const p = getPalette();
  const key = unitOwner === 'player1' ? 'p1' : 'p2';
  return { path: p.player[key].path, tracer: p.player[key].path };
}

export const UNIT_LABELS: Record<string, string> = {
  infantry: 'I',
  tank: 'T',
  artillery: 'A',
  recon: 'R',
  engineer: 'E',
};

// ---------------------------------------------------------------------------
// 3D Model System
// ---------------------------------------------------------------------------

export type AnimAction = 'idle' | 'move' | 'attack' | 'melee' | 'hit' | 'death' | 'climb';

interface ModelEntry {
  readonly glbPath: string;
  readonly clipMap?: Partial<Record<AnimAction, string[]>>;
}

export const MODEL_MANIFEST: Partial<Record<Faction, Record<UnitType, ModelEntry>>> = {
  'iron-collective': {
    infantry: {
      glbPath: '/models/highdef/infantry_engineer.glb',
      clipMap: {
        idle:   ['Idle_02'],
        move:   ['Walking', 'Running'],
        attack: ['Run_and_Shoot', 'Walk_Forward_While_Shooting', 'Side_Shot'],
        melee:  ['Spartan_Kick', 'Weapon_Combo_2'],
        hit:    ['Hit_Reaction_1'],
        death:  ['Dead', 'dying_backwards', 'Shot_in_the_Back_and_Fall'],
        climb:  ['climbing_up_wall'],
      },
    },
    tank:      { glbPath: '/models/highdef/tank_engineer.glb' },
    artillery: { glbPath: '/models/highdef/artillery_engineer.glb' },
    recon:     { glbPath: '/models/highdef/scout_engineer.glb' },
    engineer:  { glbPath: '/models/highdef/engineer_engineer.glb' },
  },
  caravaner: {
    infantry: {
      glbPath: '/models/highdef/infantry_caravaner.glb',
      clipMap: {
        idle:   ['Idle_8'],
        move:   ['Walking', 'Running'],
        attack: ['Run_and_Shoot', 'Side_Shot', 'ForwardLeft_Run_Fight', 'Walk_Fight_Back'],
        melee:  ['High_Kick', 'Right_Upper_Hook_from_Guard'],
        hit:    ['Hit_Reaction_1', 'Hit_Reaction_to_Waist', 'Hit_in_Back_While_Running'],
        death:  ['Shot_and_Fall_Backward'],
        climb:  ['climbing_up_wall'],
      },
    },
    tank:      { glbPath: '/models/highdef/tank_caravaner.glb' },
    artillery: { glbPath: '/models/highdef/artillery_caravaner.glb' },
    recon:     { glbPath: '/models/highdef/scout_caravaner.glb' },
    engineer:  { glbPath: '/models/highdef/engineer_caravaner.glb' },
  },
};
