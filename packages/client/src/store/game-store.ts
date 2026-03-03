import { create } from 'zustand';
import { UNIT_STATS, startBattlePhase } from '@hexwar/engine';
import type { GameState, Unit, CubeCoord, UnitType, DirectiveType, Command, PlayerId } from '@hexwar/engine';

type CommandMode = 'none' | 'move' | 'attack';

interface IncomeBreakdown {
  income: number;
  carryover: number;
  maintenance: number;
  total: number;
}

interface RoundResultData {
  winner: PlayerId | null;
  reason: string;
  p1Income: IncomeBreakdown | null;
  p2Income: IncomeBreakdown | null;
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

  // Build timer
  buildTimeRemaining: number;
  buildTimerInterval: ReturnType<typeof setInterval> | null;

  // Surviving units from previous round (cannot be removed during build)
  survivingUnitIds: Set<string>;

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
  setBuildTimeRemaining: (time: number) => void;
  startBuildTimer: () => void;
  stopBuildTimer: () => void;
  confirmBuild: () => void;
  showRoundResultScreen: (winner: PlayerId | null, reason: string, p1Income?: IncomeBreakdown, p2Income?: IncomeBreakdown) => void;
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
  buildTimeRemaining: 90,
  buildTimerInterval: null,
  survivingUnitIds: new Set<string>(),
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
      // Cannot remove units that survived from the previous round
      if (prev.survivingUnitIds.has(unitId)) return {};
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

  dismissTransition: (): void => {
    const prev = useGameStore.getState();
    const nextPlayer = prev.currentPlayerView === 'player1' ? 'player2' : 'player1';

    set({
      showTransition: false,
      currentPlayerView: nextPlayer,
      selectedUnit: null,
      commandMode: 'none',
    });

    // If still in build phase, start timer for next player
    const current = useGameStore.getState();
    if (current.gameState?.phase === 'build') {
      useGameStore.getState().startBuildTimer();
    }
  },

  setBuildTimeRemaining: (time: number): void => set({ buildTimeRemaining: time }),

  startBuildTimer: (): void => {
    const prev = useGameStore.getState();
    // Clear any existing interval
    if (prev.buildTimerInterval) {
      clearInterval(prev.buildTimerInterval);
    }

    const interval = setInterval(() => {
      const current = useGameStore.getState();
      const next = current.buildTimeRemaining - 1;
      if (next <= 0) {
        clearInterval(current.buildTimerInterval!);
        useGameStore.setState({ buildTimeRemaining: 0, buildTimerInterval: null });
        // Auto-confirm build when timer expires
        useGameStore.getState().confirmBuild();
      } else {
        useGameStore.setState({ buildTimeRemaining: next });
      }
    }, 1000);

    set({ buildTimeRemaining: 90, buildTimerInterval: interval });
  },

  stopBuildTimer: (): void => {
    const prev = useGameStore.getState();
    if (prev.buildTimerInterval) {
      clearInterval(prev.buildTimerInterval);
    }
    set({ buildTimerInterval: null });
  },

  confirmBuild: (): void => {
    const store = useGameStore.getState();
    if (!store.gameState || store.gameState.phase !== 'build') return;

    // Stop the timer
    if (store.buildTimerInterval) {
      clearInterval(store.buildTimerInterval);
    }

    // Auto-assign 'advance' directive to units without one
    const playerUnits = store.gameState.players[store.currentPlayerView].units;
    for (const unit of playerUnits) {
      if (!unit.directive) {
        unit.directive = 'advance';
      }
    }

    // In hot-seat mode: P1 builds first, then show transition for P2
    if (store.currentPlayerView === 'player1') {
      useGameStore.setState({
        buildTimerInterval: null,
        buildTimeRemaining: 90,
        showTransition: true,
        gameState: { ...store.gameState },
        selectedUnit: null,
        placementMode: null,
      });
    } else {
      // P2 done building — start battle phase
      startBattlePhase(store.gameState);
      // Show transition to hand control to P1 for the first battle turn
      useGameStore.setState({
        buildTimerInterval: null,
        buildTimeRemaining: 90,
        gameState: { ...store.gameState },
        selectedUnit: null,
        placementMode: null,
        showTransition: true,
        survivingUnitIds: new Set<string>(),
      });
    }
  },

  showRoundResultScreen: (winner: PlayerId | null, reason: string, p1Income?: IncomeBreakdown, p2Income?: IncomeBreakdown): void =>
    set({
      showRoundResult: true,
      roundResult: { winner, reason, p1Income: p1Income ?? null, p2Income: p2Income ?? null },
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

      // Otherwise transition to next round's build phase
      // Track surviving unit IDs so they cannot be removed during build
      const surviving = new Set<string>();
      for (const player of Object.values(prev.gameState.players)) {
        for (const unit of player.units) {
          surviving.add(unit.id);
        }
      }

      // Reset all stale UI state from the previous round
      return {
        showRoundResult: false,
        roundResult: null,
        showTransition: true,
        // Reset view to player2 so dismissTransition flips to player1
        currentPlayerView: 'player2',
        // Clear stale battle state
        selectedUnit: null,
        commandMode: 'none',
        placementMode: null,
        pendingCommands: [],
        damagedUnits: new Map<string, number>(),
        lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
        survivingUnitIds: surviving,
      };
    }),

  resetGame: (): void => {
    const prev = useGameStore.getState();
    if (prev.buildTimerInterval) {
      clearInterval(prev.buildTimerInterval);
    }
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
      buildTimeRemaining: 90,
      buildTimerInterval: null,
      survivingUnitIds: new Set<string>(),
      showTransition: false,
      showRoundResult: false,
      roundResult: null,
      showGameOver: false,
    });
  },
}));
