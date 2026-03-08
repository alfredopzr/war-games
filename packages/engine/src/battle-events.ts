// =============================================================================
// HexWar — Battle Event Formatter
// =============================================================================
// Pure function that converts structured BattleEvent into human-readable text.
// =============================================================================

import type { BattleEvent, PlayerId } from './types';

function pl(player: PlayerId): string {
  return player === 'player1' ? 'P1' : 'P2';
}

function unitLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'move':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} moved to (${event.to.q},${event.to.r})`;

    case 'damage':
      return `${pl(event.actingPlayer)} ${unitLabel(event.attackerType)} dealt ${event.damage} damage to ${unitLabel(event.defenderType)} (${event.defenderHpAfter} HP left)`;

    case 'kill':
      return `${pl(event.actingPlayer)} ${unitLabel(event.attackerType)} destroyed ${unitLabel(event.defenderType)}`;

    case 'capture':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} captured a city`;

    case 'recapture':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} recaptured a city from ${pl(event.previousOwner)}`;

    case 'capture-damage':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} took ${event.captureCost} damage capturing a city (${event.hpAfter} HP left)`;

    case 'capture-death':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} died capturing a city`;

    case 'objective-change': {
      if (event.newOccupier === null) {
        return `${pl(event.previousOccupier!)} lost control of the objective`;
      }
      return `${pl(event.newOccupier)} seized the objective`;
    }

    case 'koth-progress':
      return `${pl(event.occupier)} holds objective (${event.turnsHeld}/2 turns)`;

    case 'round-end': {
      const winnerLabel = event.winner ? pl(event.winner) : 'No one';
      const reasonLabel = event.reason === 'king-of-the-hill' ? 'King of the Hill'
        : event.reason === 'elimination' ? 'Elimination' : 'Turn Limit';
      return `${winnerLabel} wins the round (${reasonLabel})`;
    }

    case 'game-end':
      return `${pl(event.winner)} wins the game!`;

    case 'heal':
      return `${pl(event.actingPlayer)} ${unitLabel(event.healerType)} healed ${unitLabel(event.targetType)} +${event.healAmount} HP (${event.targetHpAfter} HP)`;

    case 'intercept': {
      const responseLabel = event.defenderResponse === 'engage' ? ' (stopped)'
        : event.defenderResponse === 'skirmish' ? ' (returned fire)'
        : event.defenderResponse === 'flee' ? ' (fled)'
        : '';
      return `${unitLabel(event.attackerType)} intercepted ${unitLabel(event.defenderType)} for ${event.damage} damage${responseLabel}`;
    }

    case 'counter':
      return `${unitLabel(event.attackerType)} counter-fired at ${unitLabel(event.defenderType)} for ${event.damage} damage`;

    case 'melee':
      return `${unitLabel(event.unitAType)} engaged ${unitLabel(event.unitBType)} in melee`;

    case 'reveal':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} revealed ${event.hexes.length} hexes`;

    case 'building-built':
      return `${pl(event.actingPlayer)} ${unitLabel(event.unitType)} built ${event.buildingType} (${event.cost}g)`;

    case 'mine-triggered':
      return `${unitLabel(event.triggeredByUnitType)} triggered mines for ${event.damage} damage (${event.unitHpAfter} HP left)`;

    case 'mortar-fire':
      return `Mortar fired at ${unitLabel(event.targetUnitType)} for ${event.damage} damage (${event.targetHpAfter} HP left)`;

    case 'building-destroyed':
      return `${pl(event.actingPlayer)} ${unitLabel(event.attackerType)} destroyed ${pl(event.buildingOwner)}'s ${event.buildingType}`;
  }
}
