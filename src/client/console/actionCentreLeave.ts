/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ACTION CENTRE IS A VOLUNTARY SURFACE — it leaves when the server's prompt moves off the action menu (a sub-prompt,
 * another player's turn), so its surface never overlaps the one that serves the new prompt. One exception per fact that
 * makes the new prompt THIS workspace's own business: its claimed outcome, a step hosted inside it, a party flow it owes —
 * and (T09, ledger BY — H6) ITS OWN COMMITTED PHRASE.
 *
 * The field report (the owner, Steam Machine, solo against MarsBot): Electro Catapult's workspace «folds early, the card
 * vanishes, the price off the rail flies into nowhere». The action was the turn's SECOND, so its answer handed the turn to
 * the bot — `waitingFor` gone, the prompt «moved off the menu» — and this rule tore the workspace down IN THE SAME FLUSH
 * that resolved the commit: the composer unmounted, its `beforeUnmount` killed the commit's motion (which settled the
 * beat), the shell's dismissal ran at once and flew the price INTO the printed cost icon of a card already leaving. In
 * solo without a bot the action menu always comes back, which is why the T06 stand stayed green.
 *
 * While the ACTION COMMIT owns the surface (its awaiting handoff stands — resolved or not: a resolved one is cleared only
 * by the commit's own fold) the leave is the FOLD's, and the fold leaves only once the surface is clear of its tokens
 * (`surfaceClear`). Pure — the shell hands the facts in.
 */

export type ActionCentreLeaveFacts = {
  /** The card-actions frame is mounted. */
  mounted: boolean,
  /** The new top prompt is still the action menu (a 'first action' → 'next action' change keeps the centre). */
  menu: boolean,
  /** The workspace claimed the outcome the new prompt is — its next stage, hosted here. */
  outcomeClaimed: boolean,
  /** A step stands inside the workspace (a SelectColony follow-up — the colonies hosted around it). */
  nestedStep: boolean,
  /** A party / resolution flow the workspace owes (a law's bill, its closing beat). */
  partyFlowOwed: boolean,
  /**
   * THE ACTION COMMIT STILL OWNS THE SURFACE (BY — H6): its awaiting handoff stands. The commit's own fold closes the
   * workspace — after its tokens have left it (`surfaceClear`) — never this rule in the flush that resolved it.
   */
  commitOwnsSurface: boolean,
};

/** Does the action centre leave on this prompt change? */
export function actionCentreLeavesOnPromptChange(facts: ActionCentreLeaveFacts): boolean {
  return facts.mounted && !facts.menu && !facts.outcomeClaimed && !facts.nestedStep && !facts.partyFlowOwed &&
    !facts.commitOwnsSurface;
}
