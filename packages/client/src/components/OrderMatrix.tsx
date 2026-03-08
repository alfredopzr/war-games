import { useState, useEffect, useCallback, type ReactElement } from 'react';
import type { MovementDirective, AttackDirective, SpecialtyModifier, UnitType } from '@hexwar/engine';
import { BEHAVIOR_NAMES } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

const MOVEMENTS: readonly MovementDirective[] = ['advance', 'flank-left', 'flank-right', 'patrol', 'hold'];
const ATTACKS: readonly AttackDirective[] = ['shoot-on-sight', 'skirmish', 'retreat-on-contact', 'hunt', 'ignore'];
const SPECIALTIES: readonly (SpecialtyModifier | null)[] = [null, 'support', 'sniper'];

const MOVEMENT_LABELS: Record<MovementDirective, string> = {
  advance: 'Advance',
  'flank-left': 'Flank L',
  'flank-right': 'Flank R',
  patrol: 'Patrol',
  hold: 'Hold',
};

const ATTACK_LABELS: Record<AttackDirective, string> = {
  'shoot-on-sight': 'Shoot on Sight',
  skirmish: 'Skirmish',
  'retreat-on-contact': 'Retreat',
  hunt: 'Hunt',
  ignore: 'Ignore',
};

const SPECIALTY_LABELS: Record<string, string> = {
  '': 'None',
  support: 'Support',
  sniper: 'Sniper',
};

const HUNT_TARGET_OPTIONS: readonly (UnitType | null)[] = [null, 'infantry', 'tank', 'artillery', 'recon', 'engineer'];
const HUNT_TARGET_LABELS: Record<string, string> = {
  '': 'Any',
  infantry: 'Infantry',
  tank: 'Tank',
  artillery: 'Artillery',
  recon: 'Recon',
  engineer: 'Engineer',
};

interface OrderMatrixProps {
  onSelect?: (movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null) => void;
  onBothConfirmed?: () => void;
}

export function OrderMatrix({ onSelect, onBothConfirmed }: OrderMatrixProps): ReactElement | null {
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const setUnitDirectives = useGameStore((s) => s.setUnitDirectives);

  const [movementPicked, setMovementPicked] = useState(false);
  const [attackPicked, setAttackPicked] = useState(false);

  const currentMovement = selectedUnit?.movementDirective ?? 'advance';
  const currentAttack = selectedUnit?.attackDirective ?? 'ignore';
  const currentSpecialty = selectedUnit?.specialtyModifier ?? null;
  const currentPatrolRadius = selectedUnit?.patrolRadius ?? 3;
  const currentHuntPriority = selectedUnit?.huntPriorityType ?? null;

  // Reset when unit changes
  useEffect(() => {
    setMovementPicked(false);
    setAttackPicked(false);
  }, [selectedUnit?.id]);

  const apply = useCallback(
    (movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null): void => {
      if (!selectedUnit) return;
      if (onSelect) {
        onSelect(movement, attack, specialty);
      } else {
        setUnitDirectives(selectedUnit.id, movement, attack, specialty);
      }
    },
    [selectedUnit, setUnitDirectives, onSelect],
  );

  const pickMovement = useCallback(
    (mov: MovementDirective): void => {
      setMovementPicked(true);
      apply(mov, currentAttack, currentSpecialty);
      if (attackPicked && onBothConfirmed) onBothConfirmed();
    },
    [apply, currentAttack, currentSpecialty, attackPicked, onBothConfirmed],
  );

  const pickAttack = useCallback(
    (atk: AttackDirective): void => {
      setAttackPicked(true);
      apply(currentMovement, atk, currentSpecialty);
      if (movementPicked && onBothConfirmed) onBothConfirmed();
    },
    [apply, currentMovement, currentSpecialty, movementPicked, onBothConfirmed],
  );

  const setPatrolRadius = useCallback(
    (radius: number): void => {
      if (!selectedUnit) return;
      const store = useGameStore.getState();
      const player = store.gameState?.players[store.currentPlayerView];
      const unit = player?.units.find((u) => u.id === selectedUnit.id);
      if (unit) {
        unit.patrolRadius = radius;
        useGameStore.setState({
          gameState: { ...store.gameState! },
          selectedUnit: { ...selectedUnit, patrolRadius: radius },
        });
      }
    },
    [selectedUnit],
  );

  const setHuntPriority = useCallback(
    (priority: UnitType | null): void => {
      if (!selectedUnit) return;
      const store = useGameStore.getState();
      const player = store.gameState?.players[store.currentPlayerView];
      const unit = player?.units.find((u) => u.id === selectedUnit.id);
      if (unit) {
        unit.huntPriorityType = priority ?? undefined;
        useGameStore.setState({
          gameState: { ...store.gameState! },
          selectedUnit: { ...selectedUnit, huntPriorityType: priority ?? undefined },
        });
      }
    },
    [selectedUnit],
  );

  if (!selectedUnit) return null;

  const bothPicked = movementPicked && attackPicked;
  const orderName = bothPicked ? BEHAVIOR_NAMES[currentMovement][currentAttack] : '—';

  return (
    <div className="order-composer">
      <div className="order-columns">
        <div className="order-col">
          <div className="order-col-label">Movement</div>
          {MOVEMENTS.map((mov) => (
            <button
              key={mov}
              className={`order-btn ${movementPicked && mov === currentMovement ? 'active' : ''}`}
              onClick={() => pickMovement(mov)}
              type="button"
            >
              {MOVEMENT_LABELS[mov]}
            </button>
          ))}
        </div>
        <div className="order-col">
          <div className="order-col-label">Rules of Engagement</div>
          {ATTACKS.map((atk) => (
            <button
              key={atk}
              className={`order-btn ${attackPicked && atk === currentAttack ? 'active' : ''}`}
              onClick={() => pickAttack(atk)}
              type="button"
            >
              {ATTACK_LABELS[atk]}
            </button>
          ))}
        </div>
      </div>

      <div className="order-result">
        <div className="order-result-label">Order</div>
        <div className="order-result-name">{orderName}</div>
      </div>

      {currentMovement === 'patrol' && (
        <div className="order-modifier">
          <div className="order-modifier-label">Patrol Radius: {currentPatrolRadius}</div>
          <input
            type="range"
            className="order-slider"
            min={2}
            max={5}
            step={1}
            value={currentPatrolRadius}
            onChange={(e) => setPatrolRadius(Number(e.target.value))}
          />
          <div className="order-slider-ticks">
            <span>2</span><span>3</span><span>4</span><span>5</span>
          </div>
        </div>
      )}

      {currentAttack === 'hunt' && (
        <div className="order-modifier">
          <div className="order-modifier-label">Priority Target</div>
          <div className="order-modifier-pills">
            {HUNT_TARGET_OPTIONS.map((opt) => {
              const key = opt ?? '';
              return (
                <button
                  key={key}
                  className={`specialty-pill ${(opt ?? null) === currentHuntPriority ? 'active' : ''}`}
                  onClick={() => setHuntPriority(opt)}
                  type="button"
                >
                  {HUNT_TARGET_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="order-specialty">
        {SPECIALTIES.map((spec) => {
          const key = spec ?? '';
          const locked = spec !== null;
          return (
            <button
              key={key}
              className={`specialty-pill ${spec === currentSpecialty ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => { if (!locked) apply(currentMovement, currentAttack, spec); }}
              disabled={locked}
              type="button"
            >
              {SPECIALTY_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
