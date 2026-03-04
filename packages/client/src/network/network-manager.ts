import { io as socketIo, Socket } from 'socket.io-client';
import { deserializeGameState } from '@hexwar/engine';
import type {
  PlayerId,
  UnitType,
  CubeCoord,
  DirectiveType,
  Command,
  SerializableGameState,
} from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

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

  placeUnit(unitType: UnitType, position: CubeCoord, directive: DirectiveType): void {
    this.socket?.emit('place-unit', { unitType, position, directive });
  }

  removeUnit(unitId: string): void {
    this.socket?.emit('remove-unit', { unitId });
  }

  setDirective(unitId: string, directive: DirectiveType): void {
    this.socket?.emit('set-directive', { unitId, directive });
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
      (data: { state: SerializableGameState; playerId: PlayerId }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        s.setGameState(gameState);
        s.setMyPlayerId(data.playerId);
        s.setCurrentPlayerView(data.playerId);
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
    });

    // -- Turn resolution ------------------------------------------------------

    this.socket.on(
      'turn-result',
      (data: {
        state: SerializableGameState;
        events: Array<{ type: string; actingPlayer: PlayerId; message: string }>;
      }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        s.setGameState(gameState);
        s.setWaitingForServer(false);

        if (data.events.length > 0) {
          const entries = data.events.map((e) => ({
            turn: gameState.round.turnNumber,
            player: e.actingPlayer,
            type: e.type as 'kill' | 'damage' | 'capture' | 'recapture',
            message: e.message,
          }));
          s.addBattleLogEntries(entries);
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
      }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        s.setGameState(gameState);
        s.setWaitingForServer(false);
        s.setOpponentBuildConfirmed(false);
        s.showToast(
          data.winner
            ? `Round won by ${data.winner === 'player1' ? 'P1' : 'P2'}`
            : 'Round draw',
        );
      },
    );

    this.socket.on(
      'game-over',
      (data: { winner: PlayerId; state: SerializableGameState }) => {
        const gameState = deserializeGameState(data.state);
        const s = store();
        s.setGameState(gameState);
        s.setWaitingForServer(false);
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
