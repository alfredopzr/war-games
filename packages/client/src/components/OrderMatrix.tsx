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
  scout: 'Scout',
  hold: 'Hold',
};

const ATTACK_LABELS: Record<AttackDirective, string> = {
  'shoot-on-sight': 'Shoot',
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

  const handleCellClick = useCallback(
    (movement: MovementDirective, attack: AttackDirective): void => {
      if (!selectedUnit) return;
      if (onSelect) {
        onSelect(movement, attack, currentSpecialty);
      } else {
        setUnitDirectives(selectedUnit.id, movement, attack, currentSpecialty);
      }
    },
    [selectedUnit, currentSpecialty, setUnitDirectives, onSelect],
  );

  const handleSpecialtyClick = useCallback(
    (specialty: SpecialtyModifier | null): void => {
      if (!selectedUnit) return;
      if (onSelect) {
        onSelect(currentMovement, currentAttack, specialty);
      } else {
        setUnitDirectives(selectedUnit.id, currentMovement, currentAttack, specialty);
      }
    },
    [selectedUnit, currentMovement, currentAttack, setUnitDirectives, onSelect],
  );

  if (!selectedUnit) return null;

  return (
    <div className="order-matrix">
      <table className="order-matrix-table">
        <thead>
          <tr>
            <th />
            {ATTACKS.map((atk) => (
              <th
                key={atk}
                className={atk === currentAttack ? 'col-active' : ''}
              >
                {ATTACK_LABELS[atk]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOVEMENTS.map((mov) => (
            <tr key={mov}>
              <th className={mov === currentMovement ? 'row-active' : ''}>
                {MOVEMENT_LABELS[mov]}
              </th>
              {ATTACKS.map((atk) => {
                const isSelected = mov === currentMovement && atk === currentAttack;
                const isRowActive = mov === currentMovement;
                const isColActive = atk === currentAttack;
                const cls = [
                  'matrix-cell',
                  isSelected ? 'selected' : '',
                  isRowActive ? 'row-highlight' : '',
                  isColActive ? 'col-highlight' : '',
                ].filter(Boolean).join(' ');

                return (
                  <td
                    key={`${mov}-${atk}`}
                    className={cls}
                    onClick={() => handleCellClick(mov, atk)}
                    title={BEHAVIOR_NAMES[mov][atk]}
                  >
                    {BEHAVIOR_NAMES[mov][atk]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="specialty-row">
        {SPECIALTIES.map((spec) => {
          const key = spec ?? '';
          const isActive = currentSpecialty === spec;
          return (
            <button
              key={key}
              className={`specialty-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleSpecialtyClick(spec)}
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
