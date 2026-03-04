import { create } from 'zustand';
import { UNIT_STATS, startBattlePhase, placeUnit, aiBuildPhase } from '@hexwar/engine';
import type { GameState, Unit, CubeCoord, UnitType, DirectiveType, DirectiveTarget, Command, PlayerId } from '@hexwar/engine';
import type { TurnEvent } from '../renderer/replay-sequencer';

export type GameMode = 'hotseat' | 'vsAI' | 'online';
export type LobbyState = 'menu' | 'creating' | 'waiting' | 'joining' | null;

export interface BattleLogEntry {
  turn: number;
  player: PlayerId;
  type: 'kill' | 'capture' | 'recapture' | 'damage';
  message: string;
}

type CommandMode = 'none' | 'move' | 'attack';
type HighlightMode = 'move' | 'attack' | 'none';

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

  // Game mode
  gameMode: GameMode;

  // Online multiplayer state
  roomId: string | null;
  myPlayerId: PlayerId | null;
  opponentConnected: boolean;
  opponentBuildConfirmed: boolean;
  waitingForServer: boolean;
  lobbyState: LobbyState;

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

  // Range highlights
  highlightedHexes: Set<string>;
  highlightMode: HighlightMode;

  // Pending commands for current turn
  pendingCommands: Command[];

  // Animation state
  damagedUnits: Map<string, number>; // unitId -> timestamp of last damage

  // Build timer
  buildTimeRemaining: number;
  buildTimerInterval: ReturnType<typeof setInterval> | null;

  // Surviving units from previous round (cannot be removed during build)
  survivingUnitIds: Set<string>;

  // Battle log
  battleLog: BattleLogEntry[];

  // Target selection mode (for hunt/capture directives)
  targetSelectionMode: boolean;
  targetSelectionDirective: DirectiveType | null;

  // Toast messages
  toastMessage: string | null;

  // Turn replay
  turnReplayEvents: TurnEvent[];
  isReplayPlaying: boolean;

  // Turn transition / round result / game over overlays
  showTransition: boolean;
  showRoundResult: boolean;
  roundResult: RoundResultData | null;
  showGameOver: boolean;

  // Actions
  setGameMode: (mode: GameMode) => void;
  setGameState: (state: GameState) => void;
  setRoomId: (id: string | null) => void;
  setMyPlayerId: (id: PlayerId | null) => void;
  setCurrentPlayerView: (id: PlayerId) => void;
  setOpponentConnected: (connected: boolean) => void;
  setOpponentBuildConfirmed: (confirmed: boolean) => void;
  setWaitingForServer: (waiting: boolean) => void;
  setLobbyState: (state: LobbyState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: CubeCoord | null) => void;
  setVisibleHexes: (hexes: Set<string>) => void;
  setCommandMode: (mode: CommandMode) => void;
  setHighlightedHexes: (hexes: Set<string>, mode: HighlightMode) => void;
  clearHighlightedHexes: () => void;
  enterPlacementMode: (type: UnitType) => void;
  exitPlacementMode: () => void;
  setUnitDirective: (unitId: string, directive: DirectiveType) => void;
  setTargetSelectionMode: (active: boolean, directive?: DirectiveType) => void;
  setUnitDirectiveTarget: (unitId: string, directive: DirectiveType, target: DirectiveTarget) => void;
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
  addBattleLogEntries: (entries: BattleLogEntry[]) => void;
  clearBattleLog: () => void;
  showToast: (msg: string) => void;
  setTurnReplayEvents: (events: TurnEvent[]) => void;
  setReplayPlaying: (playing: boolean) => void;
  showRoundResultScreen: (winner: PlayerId | null, reason: string, p1Income?: IncomeBreakdown, p2Income?: IncomeBreakdown) => void;
  continueToNextRound: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  gameMode: 'hotseat',
  roomId: null,
  myPlayerId: null,
  opponentConnected: false,
  opponentBuildConfirmed: false,
  waitingForServer: false,
  lobbyState: null,
  selectedUnit: null,
  hoveredHex: null,
  currentPlayerView: 'player1',
  commandMode: 'none',
  placementMode: null,
  visibleHexes: new Set<string>(),
  lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
  highlightedHexes: new Set<string>(),
  highlightMode: 'none',
  pendingCommands: [],
  damagedUnits: new Map<string, number>(),
  battleLog: [],
  buildTimeRemaining: 120,
  buildTimerInterval: null,
  survivingUnitIds: new Set<string>(),
  turnReplayEvents: [],
  isReplayPlaying: false,
  targetSelectionMode: false,
  targetSelectionDirective: null,
  toastMessage: null,
  showTransition: false,
  showRoundResult: false,
  roundResult: null,
  showGameOver: false,

  setGameMode: (mode: GameMode): void => set({ gameMode: mode }),

  setGameState: (state: GameState): void => set({ gameState: state }),

  setRoomId: (id: string | null): void => set({ roomId: id }),

  setMyPlayerId: (id: PlayerId | null): void => set({ myPlayerId: id }),

  setCurrentPlayerView: (id: PlayerId): void =>
    set({ currentPlayerView: id, selectedUnit: null, commandMode: 'none' }),

  setOpponentConnected: (connected: boolean): void => set({ opponentConnected: connected }),

  setOpponentBuildConfirmed: (confirmed: boolean): void => set({ opponentBuildConfirmed: confirmed }),

  setWaitingForServer: (waiting: boolean): void => set({ waitingForServer: waiting }),

  setLobbyState: (state: LobbyState): void => set({ lobbyState: state }),

  selectUnit: (unit: Unit | null): void => set({
    selectedUnit: unit,
    commandMode: 'none',
    highlightedHexes: new Set<string>(),
    highlightMode: 'none',
  }),

  setHoveredHex: (hex: CubeCoord | null): void => set({ hoveredHex: hex }),

  setVisibleHexes: (hexes: Set<string>): void => set({ visibleHexes: hexes }),

  setCommandMode: (mode: CommandMode): void => set({ commandMode: mode }),

  setHighlightedHexes: (hexes: Set<string>, mode: HighlightMode): void =>
    set({ highlightedHexes: hexes, highlightMode: mode }),

  clearHighlightedHexes: (): void =>
    set({ highlightedHexes: new Set<string>(), highlightMode: 'none' }),

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

  setTargetSelectionMode: (active: boolean, directive?: DirectiveType): void =>
    set({
      targetSelectionMode: active,
      targetSelectionDirective: directive ?? null,
    }),

  setUnitDirectiveTarget: (unitId: string, directive: DirectiveType, target: DirectiveTarget): void =>
    set((prev) => {
      if (!prev.gameState) return {};
      const player = prev.gameState.players[prev.currentPlayerView];
      const unit = player.units.find((u) => u.id === unitId);
      if (!unit) return {};
      unit.directive = directive;
      unit.directiveTarget = target;
      const updatedSelected = prev.selectedUnit?.id === unitId
        ? { ...prev.selectedUnit, directive, directiveTarget: target }
        : prev.selectedUnit;
      return {
        gameState: { ...prev.gameState },
        selectedUnit: updatedSelected,
        targetSelectionMode: false,
        targetSelectionDirective: null,
      };
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

    set({ buildTimeRemaining: 120, buildTimerInterval: interval });
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

    // Online mode: delegate to server via NetworkManager
    if (store.gameMode === 'online') {
      if (store.buildTimerInterval) {
        clearInterval(store.buildTimerInterval);
      }
      // Dynamic import to avoid circular dependency
      import('../network/network-manager').then(({ networkManager }) => {
        networkManager.confirmBuild();
      });
      useGameStore.setState({
        buildTimerInterval: null,
        placementMode: null,
      });
      return;
    }

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

    if (store.gameMode === 'vsAI' && store.currentPlayerView === 'player1') {
      // VS AI: P1 confirms build, AI immediately builds for P2, then go straight to battle
      const aiPlacements = aiBuildPhase(store.gameState, 'player2');
      for (const p of aiPlacements) {
        try {
          placeUnit(store.gameState, 'player2', p.unitType, p.position, p.directive);
        } catch {
          // skip if placement fails (hex occupied or can't afford)
        }
      }
      startBattlePhase(store.gameState);
      // Go straight to battle as player1 — no P2 transition needed
      useGameStore.setState({
        buildTimerInterval: null,
        buildTimeRemaining: 120,
        gameState: { ...store.gameState },
        selectedUnit: null,
        placementMode: null,
        showTransition: false,
        currentPlayerView: 'player1',
        survivingUnitIds: new Set<string>(),
      });
    } else if (store.currentPlayerView === 'player1') {
      // Hot-seat: P1 builds first, then show transition for P2
      useGameStore.setState({
        buildTimerInterval: null,
        buildTimeRemaining: 120,
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
        buildTimeRemaining: 120,
        gameState: { ...store.gameState },
        selectedUnit: null,
        placementMode: null,
        showTransition: true,
        survivingUnitIds: new Set<string>(),
      });
    }
  },

  addBattleLogEntries: (entries: BattleLogEntry[]): void =>
    set((prev) => ({ battleLog: [...entries, ...prev.battleLog].slice(0, 50) })),

  clearBattleLog: (): void => set({ battleLog: [] }),

  showToast: (msg: string): void => {
    set({ toastMessage: msg });
    setTimeout(() => {
      useGameStore.setState({ toastMessage: null });
    }, 1500);
  },

  setTurnReplayEvents: (events: TurnEvent[]): void => set({ turnReplayEvents: events }),

  setReplayPlaying: (playing: boolean): void => set({ isReplayPlaying: playing }),

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
      gameMode: 'hotseat',
      roomId: null,
      myPlayerId: null,
      opponentConnected: false,
      opponentBuildConfirmed: false,
      waitingForServer: false,
      lobbyState: null,
      selectedUnit: null,
      hoveredHex: null,
      currentPlayerView: 'player1',
      commandMode: 'none',
      placementMode: null,
      visibleHexes: new Set<string>(),
      lastKnownEnemies: new Map<string, { type: UnitType; position: CubeCoord }>(),
      highlightedHexes: new Set<string>(),
      highlightMode: 'none',
      pendingCommands: [],
      damagedUnits: new Map<string, number>(),
      battleLog: [],
      buildTimeRemaining: 120,
      buildTimerInterval: null,
      survivingUnitIds: new Set<string>(),
      turnReplayEvents: [],
      isReplayPlaying: false,
      toastMessage: null,
      targetSelectionMode: false,
      targetSelectionDirective: null,
      showTransition: false,
      showRoundResult: false,
      roundResult: null,
      showGameOver: false,
    });
  },
}));
