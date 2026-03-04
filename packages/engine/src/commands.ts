import type { Command, CommandPool, DirectiveType, DirectiveTarget } from './types';

export const CP_PER_ROUND = 4;

export function createCommandPool(): CommandPool {
  return {
    remaining: CP_PER_ROUND,
    commandedUnitIds: new Set<string>(),
  };
}

function getUnitId(command: Command): string {
  return command.unitId;
}

export function spendCommand(pool: CommandPool, command: Command): CommandPool {
  if (pool.remaining <= 0) {
    throw new Error('No command points remaining');
  }

  const unitId = getUnitId(command);

  if (pool.commandedUnitIds.has(unitId)) {
    throw new Error(`Unit ${unitId} already commanded this turn`);
  }

  const nextCommanded = new Set(pool.commandedUnitIds);
  nextCommanded.add(unitId);

  return {
    remaining: pool.remaining - 1,
    commandedUnitIds: nextCommanded,
  };
}

export function canIssueCommand(pool: CommandPool, unitId: string): boolean {
  return pool.remaining > 0 && !pool.commandedUnitIds.has(unitId);
}

export function validateDirectiveTarget(
  directive: DirectiveType,
  target: DirectiveTarget,
): void {
  if (directive === 'hunt' && target.type !== 'enemy-unit') {
    throw new Error('Hunt directive requires an enemy-unit target');
  }
  if (directive === 'capture' && target.type !== 'city') {
    throw new Error('Capture directive requires a city target');
  }
}
