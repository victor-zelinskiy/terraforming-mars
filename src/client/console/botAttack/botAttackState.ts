/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MARSBOT ATTACK's one piece of mutable state: the ABORT signal.
 *
 * The attack modal plays a short commit beat and then sends its answer. If the
 * server REFUSES that answer (a stale target, an invalid run id, a network
 * failure), the beat must be undone and the choice must become editable again —
 * a sealed commit row over a prompt the server is still asking is exactly the
 * dead end this fork's surfaces are audited for.
 *
 * It rides the SAME mechanism every other committing console surface uses: the
 * response path in `WaitingFor.fetchPlayerInput` calls the family's `abort…()`
 * on both the rejected-response and the network-failure branch, next to
 * `abortConsoleActionCommit` / `abortPlayedHero` / `abortStdProjectCommit`.
 * Module-level so it survives the App-level `playerkey` reset epoch.
 */
import {reactive} from 'vue';

export const botAttackState = reactive({
  /**
   * Bumped on every refusal. A NONCE rather than a boolean: the modal's
   * rollback is an EDGE («the answer you sent did not happen»), and a boolean
   * would need a second writer to clear it — which is how a latch that only
   * one side clears ends up stuck.
   */
  abortNonce: 0,
});

/** The submitted answer was refused — roll the commit beat back. */
export function abortBotAttackCommit(): void {
  botAttackState.abortNonce++;
}

/** Test hook — module state is bundle-shared in mochapack. */
export function resetBotAttackStateForTest(): void {
  botAttackState.abortNonce = 0;
}
