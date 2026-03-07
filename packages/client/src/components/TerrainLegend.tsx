import { useState, type ReactElement } from 'react';
import { useGameStore } from '../store/game-store';

export function TerrainLegend(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const [collapsed, setCollapsed] = useState(false);

  if (!gameState) return null;

  if (collapsed) {
    return (
      <button
        className="terrain-legend-toggle"
        onClick={() => setCollapsed(false)}
        type="button"
        title="Show terrain legend"
      >
        ?
      </button>
    );
  }

  return (
    <div className="terrain-legend">
      <div className="terrain-legend-header">
        <span>Terrain</span>
        <button className="terrain-legend-close" onClick={() => setCollapsed(true)} type="button">
          x
        </button>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="plains" />
        <span>Plains</span>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="forest" />
        <span>Forest (slow, hides units)</span>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="mountain" />
        <span>Mountain (infantry only)</span>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="city" />
        <span>City (+gold)</span>
      </div>
      <div className="terrain-legend-divider" />
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="objective" />
        <span>Objective (hold 2 turns)</span>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="deploy-friendly" />
        <span>Your deploy zone (top/bottom)</span>
      </div>
      <div className="terrain-legend-item">
        <span className="terrain-legend-swatch" data-terrain="deploy-enemy" />
        <span>Enemy deploy zone</span>
      </div>
    </div>
  );
}
