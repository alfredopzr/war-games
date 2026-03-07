import { io as socketIo, Socket } from 'socket.io-client';
import { deserializeGameState, calculateVisibility } from '@hexwar/engine';
import type {
  PlayerId,
  UnitType,
  CubeCoord,
  MovementDirective,
  AttackDirective,
  SpecialtyModifier,
  Command,
  SerializableGameState,
  Unit,
  BattleEvent,
} from '@hexwar/engine';
import { useGameStore } from '../store/game-store';
import { startReveal } from '../renderer/reveal-sequencer';

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class NetworkManager {
  private socket: Socket | null = null;

  connect(serverUrl: string = DEFAULT_SERVER_URL): void {
    if (this.socket?.connected) return;

    this.socket = socketIo(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    this.setupListeners();

    // Try to reconnect if we have stored credentials
    const storedToken = sessionStorage.getItem('hexwar-reconnect-token');
    const storedRoom = sessionStorage.getItem('hexwar-room-id');
    if (storedToken && storedRoom) {
      this.socket.emit('reconnect-attempt', {
        roomId: storedRoom,
        reconnectToken: storedToken,
      });
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    sessionStorage.removeItem('hexwar-reconnect-token');
    sessionStorage.removeItem('hexwar-room-id');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ---------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------

  createRoom(): void {
    this.socket?.emit('create-room');
  }

  joinRoom(roomId: string): void {
    this.socket?.emit('join-room', { roomId: roomId.toUpperCase() });
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
    this.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Build Phase
  // ---------------------------------------------------------------------------

  placeUnit(unitType: UnitType, position: CubeCoord, movementDirective: MovementDirective, attackDirective: AttackDirective, specialtyModifier: SpecialtyModifier | null): void {
    this.socket?.emit('place-unit', { unitType, position, movementDirective, attackDirective, specialtyModifier });
  }

  removeUnit(unitId: string): void {
    this.socket?.emit('remove-unit', { unitId });
  }

  setDirective(unitId: string, movementDirective: MovementDirective, attackDirective: AttackDirective, specialtyModifier: SpecialtyModifier | null): void {
    this.socket?.emit('set-directive', { unitId, movementDirective, attackDirective, specialtyModifier });
  }

  confirmBuild(): void {
    this.socket?.emit('confirm-build');
  }

  // ---------------------------------------------------------------------------
  // Battle Phase
  // ---------------------------------------------------------------------------

  submitCommands(commands: Command[]): void {
    this.socket?.emit('submit-commands', { commands });
  }

  // ---------------------------------------------------------------------------
  // Internal — Socket Event Listeners
  // ---------------------------------------------------------------------------

  private setupListeners(): void {
    if (!this.socket) return;
    const store = useGameStore.getState;

    // -- Room lifecycle -------------------------------------------------------

    this.socket.on(
      'room-created',
      (data: { roomId: string; playerId: PlayerId; reconnectToken: string }) => {
        sessionStorage.setItem('hexwar-reconnect-token', data.reconnectToken);
        sessionStorage.setItem('hexwar-room-id', data.roomId);

        const s = store();
        s.setRoomId(data.roomId);
        s.setMyPlayerId(data.playerId);
        s.setLobbyState('waiting');
      },
    );

    this.socket.on(
      'room-joined',
      (data: { roomId: string; playerId: PlayerId; reconnectToken: string }) => {
        sessionStorage.setItem('hexwar-reconnect-token', data.reconnectToken);
        sessionStorage.setItem('hexwar-room-id', data.roomId);

        const s = store();
        s.setRoomId(data.roomId);
        s.setMyPlayerId(data.playerId);
      },
    );

    this.socket.on('opponent-joined', () => {
      store().setOpponentConnected(true);
    });

    this.socket.on('opponent-left', () => {
      store().setOpponentConnected(false);
    });

    this.socket.on('room-error', (data: { message: string }) => {
      store().showToast(data.message);
      if (data.message.includes('does not exist') || data.message.includes('not found')) {
        sessionStorage.removeItem('hexwar-reconnect-token');
        sessionStorage.removeItem('hexwar-room-id');
      }
      const s = store();
      if (s.lobbyState === 'joining' || s.lobbyState === 'creating') {
        s.setLobbyState('menu');
      }
    });

    // -- Game start -----------------------------------------------------------

    this.socket.on(
      'game-start',
      (data: {
        state: SerializableGameState;
        playerId: PlayerId;
        commandsSubmitted?: boolean;
        opponentCommandsSubmitted?: boolean;
      }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        s.setGameState(gameState);
        s.setMyPlayerId(data.playerId);
        s.setCurrentPlayerView(data.playerId);
        s.setCommandsSubmitted(data.commandsSubmitted ?? false);
        s.setOpponentCommandsSubmitted(data.opponentCommandsSubmitted ?? false);
        if (data.commandsSubmitted) {
          s.setWaitingForServer(true);
        }
        s.startBuildTimer();
      },
    );

    // -- State sync -----------------------------------------------------------

    this.socket.on('state-update', (data: { state: SerializableGameState }) => {
      const gameState = deserializeGameState(data.state);
      store().setGameState(gameState);
    });

    this.socket.on('build-confirmed', (data: { playerId: PlayerId }) => {
      // Suppress unused-variable lint — playerId identifies who confirmed but
      // we only need to flag that the opponent has locked in.
      void data.playerId;
      store().setOpponentBuildConfirmed(true);
    });

    this.socket.on('battle-start', (data: { state: SerializableGameState }) => {
      const gameState = deserializeGameState(data.state);
      const s = store();
      s.stopBuildTimer();
      s.setGameState(gameState);
      s.setCommandsSubmitted(false);
      s.setOpponentCommandsSubmitted(false);
    });

    // -- Simultaneous submission acknowledgments ------------------------------

    this.socket.on('commands-received', () => {
      const s = store();
      s.setCommandsSubmitted(true);
      s.setWaitingForServer(true);
    });

    this.socket.on('opponent-commands-received', () => {
      store().setOpponentCommandsSubmitted(true);
    });

    // -- Turn resolution ------------------------------------------------------

    this.socket.on(
      'turn-result',
      (data: {
        state: SerializableGameState;
        events: BattleEvent[];
      }) => {
        const newState = deserializeGameState(data.state);
        const s = store();
        const currentState = s.gameState;
        const myPlayer = useGameStore.getState().myPlayerId ?? 'player1';

        // Battle log (immediate)
        if (data.events.length > 0) {
          const turn = newState.round.turnNumber;
          const entries = data.events.map((e) => ({ turn, event: e }));
          s.addBattleLogEntries(entries);
        }

        s.setWaitingForServer(false);
        s.setCommandsSubmitted(false);
        s.setOpponentCommandsSubmitted(false);

        const applyState = (): void => {
          useGameStore.getState().setGameState(newState);
        };

        if (data.events.length > 0 && currentState) {
          // Track intermediate positions for progressive fog clearing
          const replayPositions = new Map<string, CubeCoord>();
          for (const pid of ['player1', 'player2'] as PlayerId[]) {
            for (const unit of currentState.players[pid].units) {
              if (unit.owner === myPlayer) {
                replayPositions.set(unit.id, { ...unit.position });
              }
            }
          }

          // Store pre-reveal positions for planning path persistence
          const preRevealPositions = new Map<string, CubeCoord>();
          for (const pid of ['player1', 'player2'] as PlayerId[]) {
            for (const unit of currentState.players[pid].units) {
              preRevealPositions.set(unit.id, { ...unit.position });
            }
          }
          s.setPreRevealUnitPositions(preRevealPositions);

          s.setReplayPlaying(true);
          startReveal(data.events, newState.map.elevation, myPlayer, {
            onComplete: () => {
              useGameStore.getState().setReplayPlaying(false);
              useGameStore.getState().setPreRevealUnitPositions(null);
              applyState();
            },
            onUnitArrived: (unitId: string, to: CubeCoord) => {
              if (!replayPositions.has(unitId)) return;
              replayPositions.set(unitId, to);
              const syntheticUnits: Unit[] = [];
              for (const [id, pos] of replayPositions) {
                const orig = currentState.players[myPlayer].units.find((u: Unit) => u.id === id);
                if (orig) {
                  syntheticUnits.push({ ...orig, position: pos });
                }
              }
              const vis = calculateVisibility(syntheticUnits, newState.map.terrain, newState.map.elevation, newState.unitStats);
              useGameStore.getState().setVisibleHexes(vis);
              const prevExplored = useGameStore.getState().exploredHexes;
              const merged = new Set(prevExplored);
              for (const k of vis) merged.add(k);
              if (merged.size !== prevExplored.size) {
                useGameStore.setState({ exploredHexes: merged });
              }
            },
            onPhaseStart: (phase: number) => {
              console.log(`[REVEAL:ONLINE] Phase ${phase}`);
            },
          });
        } else {
          applyState();
        }
      },
    );

    // -- Round / game end -----------------------------------------------------

    this.socket.on(
      'round-end',
      (data: {
        winner: PlayerId | null;
        reason: string;
        state: SerializableGameState;
        events: BattleEvent[];
      }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        const currentState = s.gameState;
        const myPlayer = useGameStore.getState().myPlayerId ?? 'player1';

        s.setWaitingForServer(false);
        s.setCommandsSubmitted(false);
        s.setOpponentCommandsSubmitted(false);
        s.setOpponentBuildConfirmed(false);

        if (data.events.length > 0) {
          const turn = gameState.round.turnNumber;
          s.addBattleLogEntries(data.events.map((e) => ({ turn, event: e })));
        }

        const applyRoundEnd = (): void => {
          useGameStore.getState().setGameState(gameState);
          useGameStore.getState().showRoundResultScreen(data.winner, data.reason);
        };

        if (data.events.length > 0 && currentState) {
          const replayPositions = new Map<string, CubeCoord>();
          const preRevealPositions = new Map<string, CubeCoord>();
          for (const pid of ['player1', 'player2'] as PlayerId[]) {
            for (const unit of currentState.players[pid].units) {
              preRevealPositions.set(unit.id, { ...unit.position });
              if (unit.owner === myPlayer) {
                replayPositions.set(unit.id, { ...unit.position });
              }
            }
          }
          s.setPreRevealUnitPositions(preRevealPositions);
          s.setReplayPlaying(true);

          startReveal(data.events, gameState.map.elevation, myPlayer, {
            onComplete: () => {
              useGameStore.getState().setReplayPlaying(false);
              useGameStore.getState().setPreRevealUnitPositions(null);
              applyRoundEnd();
            },
            onUnitArrived: (unitId: string, to: CubeCoord) => {
              if (!replayPositions.has(unitId)) return;
              replayPositions.set(unitId, to);
              const syntheticUnits: Unit[] = [];
              for (const [id, pos] of replayPositions) {
                const orig = currentState.players[myPlayer].units.find((u: Unit) => u.id === id);
                if (orig) syntheticUnits.push({ ...orig, position: pos });
              }
              const vis = calculateVisibility(syntheticUnits, gameState.map.terrain, gameState.map.elevation, gameState.unitStats);
              useGameStore.getState().setVisibleHexes(vis);
              const prevExplored = useGameStore.getState().exploredHexes;
              const merged = new Set(prevExplored);
              for (const k of vis) merged.add(k);
              if (merged.size !== prevExplored.size) {
                useGameStore.setState({ exploredHexes: merged });
              }
            },
          });
        } else {
          applyRoundEnd();
        }
      },
    );

    this.socket.on(
      'game-over',
      (data: {
        winner: PlayerId;
        state: SerializableGameState;
        events: BattleEvent[];
      }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        const currentState = s.gameState;
        const myPlayer = useGameStore.getState().myPlayerId ?? 'player1';

        s.setWaitingForServer(false);

        if (data.events.length > 0) {
          const turn = gameState.round.turnNumber;
          s.addBattleLogEntries(data.events.map((e) => ({ turn, event: e })));
        }

        const applyGameOver = (): void => {
          useGameStore.getState().setGameState(gameState);
        };

        if (data.events.length > 0 && currentState) {
          const replayPositions = new Map<string, CubeCoord>();
          const preRevealPositions = new Map<string, CubeCoord>();
          for (const pid of ['player1', 'player2'] as PlayerId[]) {
            for (const unit of currentState.players[pid].units) {
              preRevealPositions.set(unit.id, { ...unit.position });
              if (unit.owner === myPlayer) {
                replayPositions.set(unit.id, { ...unit.position });
              }
            }
          }
          s.setPreRevealUnitPositions(preRevealPositions);
          s.setReplayPlaying(true);

          startReveal(data.events, gameState.map.elevation, myPlayer, {
            onComplete: () => {
              useGameStore.getState().setReplayPlaying(false);
              useGameStore.getState().setPreRevealUnitPositions(null);
              applyGameOver();
            },
            onUnitArrived: (unitId: string, to: CubeCoord) => {
              if (!replayPositions.has(unitId)) return;
              replayPositions.set(unitId, to);
              const syntheticUnits: Unit[] = [];
              for (const [id, pos] of replayPositions) {
                const orig = currentState.players[myPlayer].units.find((u: Unit) => u.id === id);
                if (orig) syntheticUnits.push({ ...orig, position: pos });
              }
              const vis = calculateVisibility(syntheticUnits, gameState.map.terrain, gameState.map.elevation, gameState.unitStats);
              useGameStore.getState().setVisibleHexes(vis);
              const prevExplored = useGameStore.getState().exploredHexes;
              const merged = new Set(prevExplored);
              for (const k of vis) merged.add(k);
              if (merged.size !== prevExplored.size) {
                useGameStore.setState({ exploredHexes: merged });
              }
            },
          });
        } else {
          applyGameOver();
        }
      },
    );

    // -- Timers ---------------------------------------------------------------

    this.socket.on(
      'timer-sync',
      (data: { phase: 'build' | 'turn'; remaining: number }) => {
        if (data.phase === 'build') {
          store().setBuildTimeRemaining(data.remaining);
        }
      },
    );

    // -- Connection status ----------------------------------------------------

    this.socket.on(
      'opponent-disconnected',
      (data: { reconnectDeadline: number }) => {
        void data.reconnectDeadline;
        store().setOpponentConnected(false);
        store().showToast('Opponent disconnected — waiting for reconnection...');
      },
    );

    this.socket.on('opponent-reconnected', () => {
      store().setOpponentConnected(true);
      store().showToast('Opponent reconnected');
    });

    this.socket.on(
      'forfeit',
      (data: { winner: PlayerId; reason: string }) => {
        void data.winner;
        const s = store();
        s.showToast(
          `Game over — ${data.reason === 'disconnect' ? 'opponent timed out' : 'opponent left'}`,
        );
        s.setWaitingForServer(false);
      },
    );
  }
}

export const networkManager = new NetworkManager();
