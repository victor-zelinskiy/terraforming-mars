/*
 * PRELUDE RISK — the ONE presentation of the server's order-aware verdict.
 *
 * The defect this exists to make unexpressible: the deployment used to show
 * «Сначала разыграйте другой пролог» over a command bar reading «A —
 * Подтвердить». Two true sentences, one screen, opposite meanings — the player
 * reads the advice, presses the button it seems to offer, and burns the card.
 *
 * So the badge, the risk title, the risk body and THE VERB ON THE BUTTON are
 * derived together, from one value, in one place. A wording that says «wait»
 * can no longer sit beside a verb that says «go», because the verb comes out of
 * the same function as the wording.
 *
 * PURE and key-based (the English text IS the i18n key — see the localization
 * rules); nothing here reads game state or re-derives a rule.
 */
import {CardName} from '@/common/cards/CardName';
import {PreludeNeed, PreludeOutlook} from '@/common/cards/PreludeOutlook';

/**
 * How loudly the situation should read. Not a severity ladder — `guaranteed` is
 * the CALMEST of the three (the player is one ordinary press away from having
 * everything), and `final` is the only one that is actually a loss.
 */
export type PreludeRiskTone = 'guaranteed' | 'possible' | 'final';

export type PreludeRisk = {
  tone: PreludeRiskTone;
  /** The at-a-glance queue badge (i18n key). */
  badge: string;
  /** The risk stage's heading (i18n key). */
  title: string;
  /** …its body (i18n key) and the values its `${n}` slots take. */
  body: string;
  bodyParams: ReadonlyArray<string>;
  /**
   * The verb of the press that COMMITS. It always names the loss — «Подтвердить»
   * and «Нажмите ещё раз» are banned here by construction, because this is the
   * only place the label can come from.
   */
  commitLabel: string;
  /** Every prelude that could still change this, in server order. */
  enablers: ReadonlyArray<CardName>;
};

/** The commit verb of a HOLD (the safe default) vs. a plain second press. */
export const PRELUDE_RISK_HOLD_LABEL = 'Play with no effect';
export const PRELUDE_RISK_PRESS_LABEL = 'Play anyway';

/** The heading of a FINAL verdict — one per declared `need`, plus the honest
 *  general one for a card that declared none. i18n keys. */
function preludeNoEffectTitle(need: PreludeNeed | undefined): string {
  switch (need) {
  case 'playedPrelude': return 'Nothing to repeat yet';
  case 'playableCard': return 'No available project right now';
  default: return 'Nothing can meet its condition';
  }
}

/**
 * The verdict → what the player reads and what the button says.
 *
 * `translatedEnabler` renders a CardName for the copy (the caller owns
 * translation, so this module stays pure and testable). It is asked for only
 * when exactly ONE enabler exists: with several, singling one out would be the
 * UI choosing for the player, so the copy stays deliberately general.
 *
 * Returns `undefined` for a prelude that can simply be played — there is no
 * risk to describe and no gate to arm.
 */
export function preludeRisk(
  outlook: PreludeOutlook | undefined,
  translateCard: (name: CardName) => string,
  options: {hold: boolean} = {hold: true},
): PreludeRisk | undefined {
  if (outlook === undefined || outlook.state === 'playable') {
    return undefined;
  }
  const commitLabel = options.hold ? PRELUDE_RISK_HOLD_LABEL : PRELUDE_RISK_PRESS_LABEL;
  const enablers = outlook.state === 'deferred' ? outlook.enablers : [];
  const only = enablers.length === 1 ? translateCard(enablers[0]) : undefined;

  if (outlook.state === 'noEffect') {
    // Nothing left can change this. The heading still names WHAT is missing
    // (the player is looking at a card, not at an error), and the body is the
    // one honest sentence: playing it costs the effect.
    //
    // A `noEffect` with NO declared `need` is the third case, and it must not
    // borrow either named one: a card that never claimed the ORDER could save
    // it is blocked by something the table cannot produce (Boom Town wants a
    // board cell with a steel/titanium bonus, Strategic Base Planning wants
    // 3 M€) — «нет доступного проекта» would point the player at their hand,
    // which is not where the blocker is.
    return {
      tone: 'final',
      badge: 'Effect will not happen',
      title: preludeNoEffectTitle(outlook.need),
      body: outlook.need === 'playableCard' ?
        'None of your projects is a legal target right now. Playing this prelude will lose its effect.' :
        'Nothing left to play can create what this effect needs. Playing this prelude will lose its effect.',
      bodyParams: [],
      commitLabel,
      enablers: [],
    };
  }

  if (outlook.certainty === 'guaranteed') {
    // The ORDER fix. This is advice, not an error: one ordinary press on the
    // other card and this one is whole again.
    return {
      tone: 'guaranteed',
      badge: 'Another prelude first',
      title: 'Nothing to repeat yet',
      body: only !== undefined ?
        'Play ${0} first. Playing this prelude now will play the card with no effect.' :
        'Play any of your other preludes first. Playing this one now will play the card with no effect.',
      bodyParams: only !== undefined ? [only] : [],
      commitLabel,
      enablers,
    };
  }

  // POSSIBLE — a draw MAY open a target. The copy must not promise it; «может»
  // is doing real work in both sentences and neither says the draw will help.
  return {
    tone: 'possible',
    badge: 'No target yet',
    title: 'No available project right now',
    body: only !== undefined ?
      '${0} may add cards to your hand. Play it first to keep this effect usable.' :
      'One of your remaining preludes may open an available target. Playing this card now will lose its effect.',
    bodyParams: only !== undefined ? [only] : [],
    commitLabel,
    enablers,
  };
}

/**
 * The ordinary (un-armed) queue badge for a prelude — `undefined` when there is
 * nothing to warn about. Same source as the risk copy, so the badge and the
 * stage can never describe different situations.
 */
export function preludeBadge(outlook: PreludeOutlook | undefined): string | undefined {
  return preludeRisk(outlook, (n) => n)?.badge;
}

/**
 * Is this prelude's effect ENABLED BY the focused one's outlook? Drives the
 * gentle amber tie between «this card is waiting» and «this card is what it is
 * waiting for» — every enabler equally, never an arbitrary favourite.
 */
export function isPreludeEnabler(
  outlook: PreludeOutlook | undefined, name: CardName): boolean {
  return outlook?.state === 'deferred' && outlook.enablers.includes(name);
}

/**
 * …and what that tie SAYS. It must not over-promise either: a card that
 * creates the condition outright («сначала этот») is a different statement from
 * one that merely MIGHT open a target, and the certainty that separates them is
 * the same one the risk copy uses.
 */
export function preludeEnablerBadge(outlook: PreludeOutlook | undefined): string | undefined {
  if (outlook?.state !== 'deferred') {
    return undefined;
  }
  return outlook.certainty === 'guaranteed' ? 'Play this one first' : 'Enables the waiting prelude';
}
