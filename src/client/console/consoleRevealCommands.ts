/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DRAWN-REVEAL COMMAND CONTRACT — one pure builder, every host.
 *
 * A drawn batch is presented in two places now: the standalone full-bleed
 * overlay (a draw the player did not open a workspace for — a tile bonus, a
 * colony payout, an opponent-triggered effect) and EMBEDDED inside the
 * workspace that claimed it (consoleWorkspaceOutcome). Both drive the SAME
 * component with the SAME input handler, so they must offer the same buttons —
 * a player who learns «B = взять все» in one host and finds B doing something
 * else in the other has been taught a lie by the interface.
 *
 * The contract used to live as a hard-coded array inside ConsoleShell.commands.
 * That is precisely the shape the console rules forbid for pending copy
 * (consoleTaskSummary's «never hardcode a pending label at a call site»), and
 * the second host would have had to hand-copy it — the same drift that produced
 * four diverged admission gates before consolePromptAdmission.
 *
 * PURE: no DOM, no reactive reads. The hosts pass what they know.
 */
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import type {BonusDiscardStep} from '@/client/console/colonyTrade/colonyBonusDiscardStep';

export type DrawnRevealCommandCtx = {
  /**
   * The payout's MANDATORY closing step (Pluto's «draw N, discard N»), when the
   * batch has one. `ready` flips A from «взять карту» to that step and removes
   * the take-all exit — the step cannot be skipped.
   */
  closer?: BonusDiscardStep;
  /** The batch names an inspectable CARD source → L3 opens it. */
  hasCardSource: boolean;
  /** The conditional search discarded at least one card → R3 opens the pile. */
  hasDiscards: boolean;
  /**
   * EMBEDDED hosts drop L3. The source card is the workspace's standing hero —
   * already on screen, one X away — so advertising a second way to reach it
   * spends a scarce bar slot on a no-op. (X still inspects the focused card in
   * both hosts; only this redundant entry differs.)
   */
  embedded?: boolean;
};

/**
 * The command run for a DRAWN reveal. A is «take», or the closing step once
 * everything has been taken; B is the take-all shortcut and NEVER an exit —
 * a draw is not cancellable, and offering «назад» would promise otherwise.
 */
export function drawnRevealCommandRun(ctx: DrawnRevealCommandCtx): Array<ConsoleCommand> {
  const cmds: Array<ConsoleCommand> = [];
  const closerReady = ctx.closer?.ready === true;
  cmds.push({control: 'confirm', label: closerReady ? (ctx.closer?.label ?? 'Take card') : 'Take card'});
  cmds.push({control: 'secondary', label: 'Inspect'});
  if (ctx.hasCardSource && ctx.embedded !== true) {
    cmds.push({control: 'stickL', label: 'Source'});
  }
  if (ctx.hasDiscards) {
    cmds.push({control: 'stickR', label: 'Discarded pile'});
  }
  if (!closerReady) {
    cmds.push({control: 'back', label: 'Take all cards'});
  }
  return cmds;
}
