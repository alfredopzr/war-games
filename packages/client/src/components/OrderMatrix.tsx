import { useCallback, type ReactElement } from 'react';
import type { MovementDirective, AttackDirective, SpecialtyModifier } from '@hexwar/engine';
import { BEHAVIOR_NAMES } from '@hexwar/engine';
import { useGameStore } from '../store/game-store';

const MOVEMENTS: readonly MovementDirective[] = ['advance', 'flank-left', 'flank-right', 'scout', 'hold'];
const ATTACKS: readonly AttackDirective[] = ['shoot-on-sight', 'skirmish', 'retreat-on-contact', 'hunt', 'ignore'];
const SPECIALTIES: readonly (SpecialtyModifier | null)[] = [null, 'support', 'engineer', 'sniper'];

const MOVEMENT_LABELS: Record<MovementDirective, string> = {
  advance: 'Advance',
  'flank-left': 'Flank L',
  'flank-right': 'Flank R',
  scout: 'Patrol',
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
  engineer: 'Engineer',
  sniper: 'Sniper',
};

interface OrderMatrixProps {
  onSelect?: (movement: MovementDirective, attack: AttackDirective, specialty: SpecialtyModifier | null) => void;
}

export function OrderMatrix({ onSelect }: OrderMatrixProps): ReactElement | null {
  const selectedUnit = useGameStore((s) => s.selectedUnit);
  const setUnitDirectives = useGameStore((s) => s.setUnitDirectives);

  const currentMovement = selectedUnit?.movementDirective ?? 'advance';
  const currentAttack = selectedUnit?.attackDirective ?? 'ignore';
  const currentSpecialty = selectedUnit?.specialtyModifier ?? null;

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

  if (!selectedUnit) return null;

  const orderName = BEHAVIOR_NAMES[currentMovement][currentAttack];

  return (
    <div className="order-composer">
      <div className="order-columns">
        <div className="order-col">
          <div className="order-col-label">Movement</div>
          {MOVEMENTS.map((mov) => (
            <button
              key={mov}
              className={`order-btn ${mov === currentMovement ? 'active' : ''}`}
              onClick={() => apply(mov, currentAttack, currentSpecialty)}
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
              className={`order-btn ${atk === currentAttack ? 'active' : ''}`}
              onClick={() => apply(currentMovement, atk, currentSpecialty)}
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
