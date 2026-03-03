import { create } from 'zustand';
import { UNIT_STATS } from '@hexwar/engine';
import type { GameState, Unit, CubeCoord, UnitType, DirectiveType, Command, PlayerId } from '@hexwar/engine';

type CommandMode = 'none' | 'move' | 'attack';

interface RoundResultData {
  winner: PlayerId | null;
  reason: string;
}

interface GameStore {
  // Core state
  gameState: GameState | null;

  // UI state
  selectedUnit: Unit | null;
  hoveredHex: CubeCoord | null;
  currentPlayerView: PlayerId;
  commandMode: CommandMode;

  // Build phase — placement mode
  placementMode: UnitType | null;

  // Fog of war
  visibleHexes: Set<string>;
  lastKnownEnemies: Map<string, { type: UnitType; position: CubeCoord }>;

  // Pending commands for current turn
  pendingCommands: Command[];

  // Animation state
  damagedUnits: Map<string, number>; // unitId -> timestamp of last damage

  // Turn transition / round result / game over overlays
  showTransition: boolean;
  showRoundResult: boolean;
  roundResult: RoundResultData | null;
  showGameOver: boolean;

  // Actions
  setGameState: (state: GameState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: CubeCoord | null) => void;
  setVisibleHexes: (hexes: Set<string>) => void;
  setCommandMode: (mode: CommandMode) => void;
  enterPlacementMode: (type: UnitType) => void;
  exitPlacementMode: () => void;
  setUnitDirective: (unitId: string, directive: DirectiveType) => void;
  removePlacedUnit: (unitId: string) => void;
  addPendingCommand: (command: Command) => void;
  clearPendingCommands: () => void;
  switchPlayerView: () => void;
  markUnitDamaged: (unitId: string) => void;
  dismissTransition: () => void;
  showRoundResultScreen: (winner: PlayerId | null, reason: string) => void;
  continueToNextRound: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  selectedUnit: null,
  hoveredHex: null,
  currentPlayerView: 'player1',
  commandMode: 'none',
  placementMode: null,
  visibleHexes: new Set<string>(),
  lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
  pendingCommands: [],
  damagedUnits: new Map<string, number>(),
  showTransition: false,
  showRoundResult: false,
  roundResult: null,
  showGameOver: false,

  setGameState: (state: GameState): void => set({ gameState: state }),

  selectUnit: (unit: Unit | null): void => set({ selectedUnit: unit, commandMode: 'none' }),

  setHoveredHex: (hex: CubeCoord | null): void => set({ hoveredHex: hex }),

  setVisibleHexes: (hexes: Set<string>): void => set({ visibleHexes: hexes }),

  setCommandMode: (mode: CommandMode): void => set({ commandMode: mode }),

  enterPlacementMode: (type: UnitType): void =>
    set({ placementMode: type, selectedUnit: null }),

  exitPlacementMode: (): void =>
    set({ placementMode: null }),

  setUnitDirective: (unitId: string, directive: DirectiveType): void =>
    set((prev) => {
      if (!prev.gameState) return {};
      const player = prev.gameState.players[prev.currentPlayerView];
      const unit = player.units.find((u) => u.id === unitId);
      if (!unit) return {};
      unit.directive = directive;
      // Update selectedUnit reference if it matches
      const updatedSelected = prev.selectedUnit?.id === unitId
        ? { ...prev.selectedUnit, directive }
        : prev.selectedUnit;
      return { gameState: { ...prev.gameState }, selectedUnit: updatedSelected };
    }),

  removePlacedUnit: (unitId: string): void =>
    set((prev) => {
      if (!prev.gameState || prev.gameState.phase !== 'build') return {};
      const player = prev.gameState.players[prev.currentPlayerView];
      const unitIndex = player.units.findIndex((u) => u.id === unitId);
      if (unitIndex === -1) return {};
      const unit = player.units[unitIndex]!;
      const stats = UNIT_STATS[unit.type];
      player.resources += stats.cost;
      player.units.splice(unitIndex, 1);
      return {
        gameState: { ...prev.gameState },
        selectedUnit: prev.selectedUnit?.id === unitId ? null : prev.selectedUnit,
      };
    }),

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

  dismissTransition: (): void =>
    set((prev) => ({
      showTransition: false,
      currentPlayerView: prev.currentPlayerView === 'player1' ? 'player2' : 'player1',
      selectedUnit: null,
      commandMode: 'none',
    })),

  showRoundResultScreen: (winner: PlayerId | null, reason: string): void =>
    set({
      showRoundResult: true,
      roundResult: { winner, reason },
    }),

  continueToNextRound: (): void =>
    set((prev) => {
      if (!prev.gameState) return {};

      // If game is over, show game over screen
      if (prev.gameState.phase === 'game-over') {
        return {
          showRoundResult: false,
          roundResult: null,
          showGameOver: true,
        };
      }

      // Otherwise transition to next round — show transition for player 1
      return {
        showRoundResult: false,
        roundResult: null,
        showTransition: true,
        // Reset view to player2 so dismissTransition flips to player1
        currentPlayerView: 'player2',
      };
    }),

  resetGame: (): void =>
    set({
      gameState: null,
      selectedUnit: null,
      hoveredHex: null,
      currentPlayerView: 'player1',
      commandMode: 'none',
      placementMode: null,
      visibleHexes: new Set<string>(),
      lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
      pendingCommands: [],
      damagedUnits: new Map<string, number>(),
      showTransition: false,
      showRoundResult: false,
      roundResult: null,
      showGameOver: false,
    }),
}));
