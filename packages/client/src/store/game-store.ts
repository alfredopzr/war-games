import { create } from 'zustand';
import type { GameState, Unit, CubeCoord, UnitType, Command, PlayerId } from '@hexwar/engine';

type CommandMode = 'none' | 'move' | 'attack';

interface GameStore {
  // Core state
  gameState: GameState | null;

  // UI state
  selectedUnit: Unit | null;
  hoveredHex: CubeCoord | null;
  currentPlayerView: PlayerId;
  commandMode: CommandMode;

  // Fog of war
  visibleHexes: Set<string>;
  lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>;

  // Pending commands for current turn
  pendingCommands: Command[];

  // Animation state
  damagedUnits: Map<string, number>; // unitId -> timestamp of last damage

  // Actions
  setGameState: (state: GameState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: CubeCoord | null) => void;
  setVisibleHexes: (hexes: Set<string>) => void;
  setCommandMode: (mode: CommandMode) => void;
  addPendingCommand: (command: Command) => void;
  clearPendingCommands: () => void;
  switchPlayerView: () => void;
  markUnitDamaged: (unitId: string) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  selectedUnit: null,
  hoveredHex: null,
  currentPlayerView: 'player1',
  commandMode: 'none',
  visibleHexes: new Set<string>(),
  lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
  pendingCommands: [],
  damagedUnits: new Map<string, number>(),

  setGameState: (state: GameState): void => set({ gameState: state }),

  selectUnit: (unit: Unit | null): void => set({ selectedUnit: unit, commandMode: 'none' }),

  setHoveredHex: (hex: CubeCoord | null): void => set({ hoveredHex: hex }),

  setVisibleHexes: (hexes: Set<string>): void => set({ visibleHexes: hexes }),

  setCommandMode: (mode: CommandMode): void => set({ commandMode: mode }),

  addPendingCommand: (command: Command): void =>
    set((prev) => ({ pendingCommands: [...prev.pendingCommands, command] })),

  clearPendingCommands: (): void => set({ pendingCommands: [] }),

  switchPlayerView: (): void =>
    set((prev) => ({
      currentPlayerView: prev.currentPlayerView === 'player1' ? 'player2' : 'player1',
      selectedUnit: null,
      commandMode: 'none',
    })),

  markUnitDamaged: (unitId: string): void =>
    set((prev) => {
      const updated = new Map(prev.damagedUnits);
      updated.set(unitId, Date.now());
      return { damagedUnits: updated };
    }),
}));
