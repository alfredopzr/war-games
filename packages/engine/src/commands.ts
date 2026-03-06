import type { Command, CommandPool, MovementDirective, DirectiveTarget } from './types';

export const CP_PER_ROUND = 4;

export function createCommandPool(): CommandPool {
  return {
    remaining: CP_PER_ROUND,
    commandedUnitIds: new Set<string>(),
  };
}

export function spendCommand(pool: CommandPool, command: Command): CommandPool {
  if (pool.remaining <= 0) {
    throw new Error('No command points remaining');
  }

  const unitId = command.unitId;

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
  movementDirective: MovementDirective,
  target: DirectiveTarget,
): void {
  // No directive-specific target validation needed anymore.
  // Capture was removed as a directive, hunt target is validated on Command's DirectiveTarget.
  // Keep function signature for future validation needs.
  void movementDirective;
  void target;
}
