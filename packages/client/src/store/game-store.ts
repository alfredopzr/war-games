import { create } from 'zustand';
import type { GameState, Unit, CubeCoord, UnitType, Command, PlayerId } from '@hexwar/engine';

interface GameStore {
  // Core state
  gameState: GameState | null;

  // UI state
  selectedUnit: Unit | null;
  hoveredHex: CubeCoord | null;
  currentPlayerView: PlayerId;

  // Fog of war
  visibleHexes: Set<string>;
  lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>;

  // Pending commands for current turn
  pendingCommands: Command[];

  // Actions
  setGameState: (state: GameState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: CubeCoord | null) => void;
  setVisibleHexes: (hexes: Set<string>) => void;
  addPendingCommand: (command: Command) => void;
  clearPendingCommands: () => void;
  switchPlayerView: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  selectedUnit: null,
  hoveredHex: null,
  currentPlayerView: 'player1',
  visibleHexes: new Set<string>(),
  lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
  pendingCommands: [],

  setGameState: (state: GameState): void => set({ gameState: state }),

  selectUnit: (unit: Unit | null): void => set({ selectedUnit: unit }),

  setHoveredHex: (hex: CubeCoord | null): void => set({ hoveredHex: hex }),

  setVisibleHexes: (hexes: Set<string>): void => set({ visibleHexes: hexes }),

  addPendingCommand: (command: Command): void =>
    set((prev) => ({ pendingCommands: [...prev.pendingCommands, command] })),

  clearPendingCommands: (): void => set({ pendingCommands: [] }),

  switchPlayerView: (): void =>
    set((prev) => ({
      currentPlayerView: prev.currentPlayerView === 'player1' ? 'player2' : 'player1',
      selectedUnit: null,
    })),
}));
