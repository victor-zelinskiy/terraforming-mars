/*
 * THE QUIET REWARD (final polish D): a resolution with no immediate step for
 * this seat still GAVE the seat something — the passive effect that now stands
 * for every player, or the action the seat may take from «Действия карт» while
 * the card is enacted. Every surface that reads «what this card pays» says
 * WHICH with the same kicker (one glossary — invariant 13): the vote panel's
 * reading before the vote, the sitting's REWARD stage after the enactment and
 * its closing card. Never an empty stage, never «Без награды» over a card that
 * changed the game, and never a number the record did not pay (a passive's
 * numbers are the forecast's, read where the forecast lives). Pure: the
 * resolution's own declaration text.
 */
export type QuietRewardKind = 'passive' | 'action';

/** English i18n keys — the kicker each kind prints, everywhere it is printed. */
export const QUIET_REWARD_KICKER: Readonly<Record<QuietRewardKind, string>> = {
  passive: 'Effect while enacted',
  action: 'Action while enacted',
};

export type QuietRewardPose = {
  kind: QuietRewardKind;
  /** The declaration (an English i18n key). */
  text: string;
  /** The kicker (an English i18n key) — `QUIET_REWARD_KICKER[kind]`. */
  kicker: string;
};

export function quietRewardPoseOf(resolution: {text: {passive?: string, action?: string}} | undefined): QuietRewardPose | undefined {
  if (resolution === undefined) {
    return undefined;
  }
  if (resolution.text.passive !== undefined && resolution.text.passive !== '') {
    return {kind: 'passive', text: resolution.text.passive, kicker: QUIET_REWARD_KICKER.passive};
  }
  if (resolution.text.action !== undefined && resolution.text.action !== '') {
    return {kind: 'action', text: resolution.text.action, kicker: QUIET_REWARD_KICKER.action};
  }
  return undefined;
}
