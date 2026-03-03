import { useState, type ReactElement } from 'react';
import { createGame } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

export function StartMenu(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const vsAI = useGameStore((s) => s.vsAI);
  const setVsAI = useGameStore((s) => s.setVsAI);
  const setGameState = useGameStore((s) => s.setGameState);
  const startBuildTimer = useGameStore((s) => s.startBuildTimer);
  const [showHelp, setShowHelp] = useState(false);

  if (gameState) return null;

  const startGame = (): void => {
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
                <li><strong>Build Phase</strong> (90s) — Buy units and place them in your deployment zone (highlighted area on your side of the map). Assign directives to control how they behave in battle.</li>
                <li><strong>Battle Phase</strong> — Take turns. Each turn your units act automatically based on their directives. Spend up to 3 Command Points (CP) to override specific units with direct orders.</li>
                <li><strong>Round End</strong> — A round ends by holding the central objective for 2 turns, eliminating all enemies, or after 8 turns per side.</li>
              </ol>
            </div>

            <div className="help-section">
              <h3>Objective</h3>
              <p>The golden pulsing hex at the center of the map. Hold it with a unit for 2 consecutive turns to win the round instantly.</p>
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
                  <span><strong>Forest</strong> — Slow (2x cost), +defense, hides units from distant enemies</span>
                </div>
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="mountain" />
                  <span><strong>Mountain</strong> — Infantry only, +defense, +vision, blocks line of sight</span>
                </div>
                <div className="help-terrain-item">
                  <span className="help-terrain-swatch" data-terrain="city" />
                  <span><strong>City</strong> — Normal movement, +defense, earns bonus gold</span>
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
          <label className="start-menu-toggle">
            <input
              type="checkbox"
              checked={vsAI}
              onChange={(e) => setVsAI(e.target.checked)}
            />
            Play vs AI
          </label>
          <button className="start-menu-button" onClick={startGame} type="button">
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
