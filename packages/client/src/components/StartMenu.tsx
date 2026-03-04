import { useState, type ReactElement } from 'react';
import { createGame } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';
import { networkManager } from '../network/network-manager';

function Lobby(): ReactElement {
  const lobbyState = useGameStore((s) => s.lobbyState);
  const roomId = useGameStore((s) => s.roomId);
  const setLobbyState = useGameStore((s) => s.setLobbyState);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = (): void => {
    setLobbyState('creating');
    setGameMode('online');
    networkManager.connect();
    networkManager.createRoom();
  };

  const handleJoin = (): void => {
    if (joinCode.length !== 6) return;
    setGameMode('online');
    networkManager.connect();
    networkManager.joinRoom(joinCode);
  };

  const handleCancel = (): void => {
    networkManager.leaveRoom();
    useGameStore.getState().resetGame();
  };

  const handleBack = (): void => {
    setLobbyState(null);
  };

  if (lobbyState === 'creating') {
    return (
      <div className="lobby-overlay">
        <div className="lobby">
          <h2 className="lobby-title">Creating Room</h2>
          <p className="lobby-status">Creating room...</p>
        </div>
      </div>
    );
  }

  if (lobbyState === 'waiting') {
    return (
      <div className="lobby-overlay">
        <div className="lobby">
          <h2 className="lobby-title">Waiting for Opponent</h2>
          <p className="lobby-status">Share this code with your opponent:</p>
          <div className="lobby-room-code">{roomId ?? '------'}</div>
          <p className="lobby-status">Waiting for opponent...</p>
          <div className="lobby-actions">
            <button className="start-menu-button" onClick={handleCancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (lobbyState === 'joining') {
    return (
      <div className="lobby-overlay">
        <div className="lobby">
          <h2 className="lobby-title">Join Room</h2>
          <input
            className="lobby-input"
            type="text"
            maxLength={6}
            placeholder="ABCDEF"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <div className="lobby-actions">
            <button
              className="start-menu-button"
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              type="button"
            >
              Join
            </button>
            <button className="start-menu-button" onClick={handleBack} type="button">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // lobbyState === 'menu'
  return (
    <div className="lobby-overlay">
      <div className="lobby">
        <h2 className="lobby-title">Online Play</h2>
        <div className="lobby-actions">
          <button className="start-menu-button" onClick={handleCreate} type="button">
            Create Room
          </button>
          <button className="start-menu-button" onClick={() => setLobbyState('joining')} type="button">
            Join Room
          </button>
          <button className="start-menu-button" onClick={handleBack} type="button">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function StartMenu(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const setGameState = useGameStore((s) => s.setGameState);
  const startBuildTimer = useGameStore((s) => s.startBuildTimer);
  const lobbyState = useGameStore((s) => s.lobbyState);
  const [showHelp, setShowHelp] = useState(false);

  if (gameState) return null;
  if (lobbyState) return <Lobby />;

  const startGame = (mode: 'hotseat' | 'vsAI'): void => {
    setGameMode(mode);
    const state = createGame(42);
    setGameState(state);
    startBuildTimer();
  };

  return (
    <div className="start-menu-overlay">
      <div className="start-menu">
        <h1 className="start-menu-title">HexWar</h1>
        <p className="start-menu-subtitle">Hex-based tactical strategy</p>

        <div className="start-menu-summary">
          <p>Deploy your army, assign battle directives, and capture the central objective.</p>
          <p>Best of 3 rounds. First to win 2 rounds wins the match.</p>
        </div>

        <button
          className="start-menu-help-toggle"
          onClick={() => setShowHelp(!showHelp)}
          type="button"
        >
          {showHelp ? 'Hide' : 'Show'} How to Play
        </button>

        {showHelp && (
          <div className="start-menu-help">
            <div className="help-section">
              <h3>Game Flow</h3>
              <ol className="help-list">
                <li><strong>Build Phase</strong> (90s) — Buy units and place them in your deployment zone. Assign directives to every unit to control their autonomous behavior in battle.</li>
                <li><strong>Battle Phase</strong> — Take turns. Units act automatically on their directives. Spend up to 4 Command Points (CP) per turn to override specific units with direct orders.</li>
                <li><strong>Round End</strong> — A round ends by holding the objective for 2 turns (while controlling 2 cities), eliminating all enemies, or after 8 turns per side.</li>
              </ol>
            </div>

            <div className="help-section">
              <h3>Win Condition</h3>
              <p>Best of 3 rounds — first to win 2 rounds wins the match.</p>
              <p>Win a round by:</p>
              <ul className="help-list">
                <li><strong>King of the Hill</strong> — Hold the golden central hex for 2 consecutive turns <em>and</em> control at least 2 city hexes. The turn counter only ticks when you have both.</li>
                <li><strong>Elimination</strong> — Destroy all enemy units.</li>
                <li><strong>Turn Limit</strong> — After 8 turns per side, tiebreaker: objective control → proximity → total HP.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Units</h3>
              <div className="help-unit-table">
                <div className="help-unit-header">
                  <span>Unit</span><span>Cost</span><span>HP</span><span>ATK</span><span>DEF</span><span>Move</span><span>Range</span><span>Vision</span>
                </div>
                <div className="help-unit-row">
                  <span>Infantry</span><span>100g</span><span>3</span><span>2</span><span>2</span><span>3</span><span>1</span><span>3</span>
                </div>
                <div className="help-unit-row">
                  <span>Tank</span><span>250g</span><span>4</span><span>4</span><span>3</span><span>4</span><span>1</span><span>3</span>
                </div>
                <div className="help-unit-row">
                  <span>Artillery</span><span>200g</span><span>2</span><span>5</span><span>1</span><span>2</span><span>2-3</span><span>3</span>
                </div>
                <div className="help-unit-row">
                  <span>Recon</span><span>100g</span><span>2</span><span>1</span><span>1</span><span>5</span><span>1</span><span>6</span>
                </div>
              </div>
              <p className="help-note">Artillery cannot fire at adjacent hexes (min range 2). Tanks and artillery cannot enter mountains.</p>
            </div>

            <div className="help-section">
              <h3>Type Advantages</h3>
              <div className="help-type-grid">
                <div className="help-type-row"><strong>Infantry</strong> — effective vs Artillery (1.2×), weak vs Tanks (0.5×)</div>
                <div className="help-type-row"><strong>Tank</strong> — crushes Infantry &amp; Recon (1.5×), weak vs nothing</div>
                <div className="help-type-row"><strong>Artillery</strong> — hits everything hard (1.3×), fragile (DEF 1)</div>
                <div className="help-type-row"><strong>Recon</strong> — counters Artillery (1.5×), terrible vs Tanks (0.3×)</div>
              </div>
            </div>

            <div className="help-section">
              <h3>Directives</h3>
              <div className="help-directives">
                <div><strong>Advance</strong> — Push toward objective or target, attack enemies en route</div>
                <div><strong>Hold</strong> — Move to target, then dig in (+1 DEF). Attacks enemies in range</div>
                <div><strong>Flank Left / Right</strong> — Arc around the target from the side</div>
                <div><strong>Scout</strong> — Reconnoiter target area, retreat from adjacent foes</div>
                <div><strong>Support</strong> — Follow and heal a target friendly unit</div>
                <div><strong>Hunt</strong> — Pursue and destroy a specific enemy unit</div>
                <div><strong>Capture</strong> — Move to a city, occupy it, then hold position</div>
              </div>
            </div>

            <div className="help-section">
              <h3>Economy Between Rounds</h3>
              <div className="help-economy">
                <div><strong>Base income</strong> — 500g per round</div>
                <div><strong>City bonus</strong> — +100g per city held at round end</div>
                <div><strong>Kill bonus</strong> — +25g per enemy unit destroyed</div>
                <div><strong>Round win bonus</strong> — +150g</div>
                <div><strong>Catch-up bonus</strong> — +200g if you lost the last round</div>
                <div><strong>Carryover</strong> — 50% of unspent gold carries over</div>
                <div><strong>Maintenance</strong> — −20% of surviving unit costs each round</div>
              </div>
              <p className="help-note">Surviving units carry into the next round and cannot be removed during build.</p>
            </div>

            <div className="help-section">
              <h3>Terrain</h3>
              <div className="help-terrain-legend">
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="plains" />
                  <span><strong>Plains</strong> — Normal movement, no bonuses</span>
                </div>
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="forest" />
                  <span><strong>Forest</strong> — Slow (2× move cost), +defense, hides units from distant enemies</span>
                </div>
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="mountain" />
                  <span><strong>Mountain</strong> — Infantry only, +defense, +2 vision, blocks line of sight</span>
                </div>
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="city" />
                  <span><strong>City</strong> — Normal movement, +defense, earns +100g/round — required for KotH win</span>
                </div>
              </div>
            </div>

            <div className="help-section">
              <h3>Controls</h3>
              <div className="help-controls">
                <div><strong>Left click</strong> — Select unit / place unit / issue commands</div>
                <div><strong>Right click</strong> — Remove a placed unit during build phase</div>
              </div>
            </div>

            <div className="help-section">
              <h3>Map Layout</h3>
              <p>Player 1 (blue) deploys on the <strong>top</strong> 2 rows. Player 2 (red) deploys on the <strong>bottom</strong> 2 rows. The golden objective hex is in the center. Both deployment zones are highlighted during the build phase.</p>
            </div>
          </div>
        )}

        <div className="start-menu-actions">
          <button className="start-menu-button" onClick={() => startGame('hotseat')} type="button">
            Hot-Seat
          </button>
          <button className="start-menu-button" onClick={() => startGame('vsAI')} type="button">
            vs AI
          </button>
          <button className="start-menu-button" onClick={() => useGameStore.getState().setLobbyState('menu')} type="button">
            Online
          </button>
        </div>
      </div>
    </div>
  );
}
