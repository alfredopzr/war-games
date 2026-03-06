import { create } from 'zustand';
import { UNIT_STATS, startBattlePhase, placeUnit, aiBuildPhase } from '@hexwar/engine';
import type { GameState, Unit, CubeCoord, UnitType, MovementDirective, AttackDirective, SpecialtyModifier, DirectiveTarget, Command, PlayerId } from '@hexwar/engine';
import type { TurnEvent } from '../renderer/replay-sequencer';
import { perf } from '../perf-monitor';

export type GameMode = 'vsAI' | 'online';
export type LobbyState = 'menu' | 'creating' | 'waiting' | 'joining' | null;

export interface BattleLogEntry {
  turn: number;
  player: PlayerId;
  type: 'kill' | 'capture' | 'recapture' | 'damage'
    | 'capture-damage' | 'capture-death'
    | 'objective-change' | 'koth-progress'
    | 'round-end' | 'game-end';
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
  commandsSubmitted: boolean;
  opponentCommandsSubmitted: boolean;
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
  exploredHexes: Set<string>;
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

  // Target selection mode (for directive targets: city, hex, enemy unit)
  targetSelectionMode: boolean;

  // Toast messages
  toastMessage: string | null;

  // Turn replay
  turnReplayEvents: TurnEvent[];
  isReplayPlaying: boolean;

  // Debug
  debugFogOff: boolean;

  // Round result / game over overlays
  showRoundResult: boolean;
  roundResult: RoundResultData | null;
  showGameOver: boolean;

  // Actions
  toggleDebugFog: () => void;
  setGameMode: (mode: GameMode) => void;
  setGameState: (state: GameState) => void;
  setRoomId: (id: string | null) => void;
  setMyPlayerId: (id: PlayerId | null) => void;
  setCurrentPlayerView: (id: PlayerId) => void;
  setOpponentConnected: (connected: boolean) => void;
  setOpponentBuildConfirmed: (confirmed: boolean) => void;
  setWaitingForServer: (waiting: boolean) => void;
  setCommandsSubmitted: (submitted: boolean) => void;
  setOpponentCommandsSubmitted: (submitted: boolean) => void;
  setLobbyState: (state: LobbyState) => void;
  selectUnit: (unit: Unit | null) => void;
  setHoveredHex: (hex: CubeCoord | null) => void;
  setVisibleHexes: (hexes: Set<string>) => void;
  setCommandMode: (mode: CommandMode) => void;
  setHighlightedHexes: (hexes: Set<string>, mode: HighlightMode) => void;
  clearHighlightedHexes: () => void;
  enterPlacementMode: (type: UnitType) => void;
  exitPlacementMode: () => void;
  setUnitDirectives: (unitId: string, movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null) => void;
  setTargetSelectionMode: (active: boolean) => void;
  setUnitDirectiveTarget: (unitId: string, target: DirectiveTarget) => void;
  removePlacedUnit: (unitId: string) => void;
  addPendingCommand: (command: Command) => void;
  clearPendingCommands: () => void;
  markUnitDamaged: (unitId: string) => void;
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
  gameMode: 'vsAI',
  roomId: null,
  myPlayerId: null,
  opponentConnected: false,
  opponentBuildConfirmed: false,
  waitingForServer: false,
  commandsSubmitted: false,
  opponentCommandsSubmitted: false,
  lobbyState: null,
  selectedUnit: null,
  hoveredHex: null,
  currentPlayerView: 'player1',
  commandMode: 'none',
  placementMode: null,
  visibleHexes: new Set<string>(),
  exploredHexes: new Set<string>(),
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
  toastMessage: null,
  debugFogOff: false,
  showRoundResult: false,
  roundResult: null,
  showGameOver: false,

  toggleDebugFog: (): void => set((s) => ({ debugFogOff: !s.debugFogOff })),

  setGameMode: (mode: GameMode): void => set({ gameMode: mode }),

  setGameState: (state: GameState): void => set({ gameState: state }),

  setRoomId: (id: string | null): void => set({ roomId: id }),

  setMyPlayerId: (id: PlayerId | null): void => set({ myPlayerId: id }),

  setCurrentPlayerView: (id: PlayerId): void =>
    set({ currentPlayerView: id, selectedUnit: null, commandMode: 'none' }),

  setOpponentConnected: (connected: boolean): void => set({ opponentConnected: connected }),

  setOpponentBuildConfirmed: (confirmed: boolean): void => set({ opponentBuildConfirmed: confirmed }),

  setWaitingForServer: (waiting: boolean): void => set({ waitingForServer: waiting }),

  setCommandsSubmitted: (submitted: boolean): void => set({ commandsSubmitted: submitted }),

  setOpponentCommandsSubmitted: (submitted: boolean): void => set({ opponentCommandsSubmitted: submitted }),

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

  setUnitDirectives: (unitId: string, movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null): void =>
    set((prev) => {
      if (!prev.gameState) return {};
      const player = prev.gameState.players[prev.currentPlayerView];
      const unit = player.units.find((u) => u.id === unitId);
      if (!unit) return {};
      unit.movementDirective = movement;
      unit.attackDirective = attack;
      unit.specialtyModifier = specialty;
      const updatedSelected = prev.selectedUnit?.id === unitId
        ? { ...prev.selectedUnit, movementDirective: movement, attackDirective: attack, specialtyModifier: specialty }
        : prev.selectedUnit;
      return { gameState: { ...prev.gameState }, selectedUnit: updatedSelected };
    }),

  setTargetSelectionMode: (active: boolean): void =>
    set({ targetSelectionMode: active }),

  setUnitDirectiveTarget: (unitId: string, target: DirectiveTarget): void =>
    set((prev) => {
      if (!prev.gameState) return {};
      const player = prev.gameState.players[prev.currentPlayerView];
      const unit = player.units.find((u) => u.id === unitId);
      if (!unit) return {};
      unit.directiveTarget = target;
      const updatedSelected = prev.selectedUnit?.id === unitId
        ? { ...prev.selectedUnit, directiveTarget: target }
        : prev.selectedUnit;
      return {
        gameState: { ...prev.gameState },
        selectedUnit: updatedSelected,
        targetSelectionMode: false,
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

  markUnitDamaged: (unitId: string): void =>
    set((prev) => {
      const updated = new Map(prev.damagedUnits);
      updated.set(unitId, Date.now());
      return { damagedUnits: updated };
    }),

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
    const t0 = performance.now();
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
      perf.logAction('confirmBuild:online', performance.now() - t0);
      return;
    }

    // Stop the timer
    if (store.buildTimerInterval) {
      clearInterval(store.buildTimerInterval);
    }

    // AI builds for P2, then go straight to battle
    const aiPlacements = aiBuildPhase(store.gameState, 'player2');
    console.log(`[AI BUILD] Budget: ${store.gameState.players.player2.resources}g, placing ${aiPlacements.length} units:`);
    for (const p of aiPlacements) {
      console.log(`  ${p.unitType} @ (${p.position.q},${p.position.r}) [${p.movementDirective}/${p.attackDirective}] cost=${p.cost}`);
      try {
        placeUnit(store.gameState, 'player2', p.unitType, p.position, p.movementDirective, p.attackDirective, p.specialtyModifier);
      } catch (e) {
        console.warn(`  FAILED: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`[AI BUILD] P2 units after placement: ${store.gameState.players.player2.units.length}, remaining gold: ${store.gameState.players.player2.resources}g`);
    startBattlePhase(store.gameState);
    useGameStore.setState({
      buildTimerInterval: null,
      buildTimeRemaining: 120,
      gameState: { ...store.gameState },
      selectedUnit: null,
      placementMode: null,
      currentPlayerView: 'player1',
      survivingUnitIds: new Set<string>(),
    });
    perf.logAction('confirmBuild:local', performance.now() - t0);
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
        currentPlayerView: 'player1',
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
      gameMode: 'vsAI',
      roomId: null,
      myPlayerId: null,
      opponentConnected: false,
      opponentBuildConfirmed: false,
      waitingForServer: false,
      commandsSubmitted: false,
      opponentCommandsSubmitted: false,
      lobbyState: null,
      selectedUnit: null,
      hoveredHex: null,
      currentPlayerView: 'player1',
      commandMode: 'none',
      placementMode: null,
      visibleHexes: new Set<string>(),
      exploredHexes: new Set<string>(),
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
      showRoundResult: false,
      roundResult: null,
      showGameOver: false,
    });
  },
}));
