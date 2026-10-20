/*
 * HOW MANY TIMES A GENERATION A RESOLUTION'S ACTION MAY BE TAKEN (Turmoil
 * Redux — Manufacturing Run RX37: «you can use this action twice this
 * generation; players with at least 2 Influence can use it 3 times»).
 *
 * A law whose action is not once a generation declares its count as DATA,
 * beside `action` / `actionBill`: the base, and the threshold of influence
 * that raises it. ONE function turns the declaration and a seat's influence
 * into the count everybody reads — the action's own `usesPerGeneration` (the
 * server's limit, read LIVE at the use: a seat that becomes chairman in the
 * middle of a generation gains the third use at once), the vote panel's «for
 * you» line, the inspector, «Ваши эффекты» and the stand. Computed twice it
 * would print «3 times» beside a limit of 2; computed here it cannot.
 *
 * A law with no declaration is taken once a generation — the family's rule
 * («Эффект принятой резолюции … действие — 1 раз за поколение, если карта не
 * говорит иначе», the rulebook p.6).
 */

export type ResolutionActionUses = {
  /** The printed count, for every seat. */
  base: number;
  /** The printed threshold: a seat with at least `influence` takes the action `uses` times instead. */
  atInfluence?: {influence: number, uses: number};
};

/** The family's rule for a law that declares nothing. */
export const DEFAULT_ACTION_USES = 1;

/** The count for a seat with `influence` — the ONE reading of the declaration. */
export function actionUsesFor(uses: ResolutionActionUses | undefined, influence: number): number {
  if (uses === undefined) {
    return DEFAULT_ACTION_USES;
  }
  const raised = uses.atInfluence;
  if (raised !== undefined && Math.max(0, influence) >= raised.influence) {
    return Math.max(0, raised.uses);
  }
  return Math.max(0, uses.base);
}

/**
 * Where a seat STANDS against the threshold — what a «for you» reading prints:
 * the count it takes now, and how much influence it still lacks for the
 * raised count (0 on the line or past it; undefined when the law has no
 * threshold at all).
 */
export type ActionUsesStanding = {
  uses: number;
  /** The seat is on the raised count. */
  raised: boolean;
  /** Influence still missing to reach the raised count (undefined: no threshold printed). */
  short: number | undefined;
};

export function actionUsesStanding(uses: ResolutionActionUses | undefined, influence: number): ActionUsesStanding {
  const count = actionUsesFor(uses, influence);
  const threshold = uses?.atInfluence;
  if (threshold === undefined) {
    return {uses: count, raised: false, short: undefined};
  }
  const short = Math.max(0, threshold.influence - Math.max(0, influence));
  return {uses: count, raised: short === 0, short};
}

/** A declaration the family can read: a positive whole base, and a threshold that RAISES it. */
export function actionUsesDeclared(uses: ResolutionActionUses): boolean {
  if (!Number.isInteger(uses.base) || uses.base < 1) {
    return false;
  }
  const raised = uses.atInfluence;
  return raised === undefined ||
    (Number.isInteger(raised.influence) && raised.influence >= 1 && Number.isInteger(raised.uses) && raised.uses > uses.base);
}
