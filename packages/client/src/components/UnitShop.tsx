import { useCallback, type ReactElement } from 'react';
import { UNIT_STATS } from '@hexwar/engine';
import type { UnitType, UnitStats } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

const UNIT_TYPES: readonly UnitType[] = ['infantry', 'tank', 'artillery', 'recon'] as const;

function unitDisplayName(type: UnitType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function UnitCard({
  type,
  stats,
  canAfford,
  isActive,
  onSelect,
}: {
  type: UnitType;
  stats: UnitStats;
  canAfford: boolean;
  isActive: boolean;
  onSelect: (type: UnitType) => void;
}): ReactElement {
  const className = [
    'unit-card',
    isActive ? 'active' : '',
    !canAfford ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = useCallback((): void => {
    if (canAfford) {
      onSelect(type);
    }
  }, [canAfford, onSelect, type]);

  return (
    <div className={className} onClick={handleClick}>
      <div className="unit-name">{unitDisplayName(type)}</div>
      <div className="unit-cost">{stats.cost}g</div>
      <div className="unit-stats">
        <span>HP {stats.maxHp}</span>
        <span>ATK {stats.atk}</span>
        <span>DEF {stats.def}</span>
        <span>Move {stats.moveRange}</span>
        <span>Range {stats.minAttackRange}-{stats.attackRange}</span>
        <span>Vision {stats.visionRange}</span>
      </div>
    </div>
  );
}

export function UnitShop(): ReactElement | null {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayerView = useGameStore((s) => s.currentPlayerView);
  const placementMode = useGameStore((s) => s.placementMode);
  const enterPlacementMode = useGameStore((s) => s.enterPlacementMode);
  const exitPlacementMode = useGameStore((s) => s.exitPlacementMode);

  const handleSelect = useCallback(
    (type: UnitType): void => {
      if (placementMode === type) {
        exitPlacementMode();
      } else {
        enterPlacementMode(type);
      }
    },
    [placementMode, enterPlacementMode, exitPlacementMode],
  );

  if (!gameState || gameState.phase !== 'build') return null;

  const resources = gameState.players[currentPlayerView].resources;

  const playerSide = currentPlayerView === 'player1' ? 'top' : 'bottom';
  const playerColor = currentPlayerView === 'player1' ? 'blue' : 'red';

  return (
    <div className="unit-shop">
      <h3>DEPLOY UNITS</h3>
      <div className="resources">{resources}g</div>
      <div className="shop-help-tip">
        Select a unit below, then click a <strong>{playerColor}-highlighted</strong> hex on the <strong>{playerSide}</strong> of the map to place it. The <strong>enemy</strong> deploys on the opposite side. Right-click a placed unit to remove it. Click a placed unit to assign a directive.
      </div>
      {UNIT_TYPES.map((type) => {
        const stats = UNIT_STATS[type];
        return (
          <UnitCard
            key={type}
            type={type}
            stats={stats}
            canAfford={resources >= stats.cost}
            isActive={placementMode === type}
            onSelect={handleSelect}
          />
        );
      })}
    </div>
  );
}
