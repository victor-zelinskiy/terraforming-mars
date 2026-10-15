/*
 * PROMPT TONE — the ONE answer to «is this decision GOOD or BAD for me?».
 *
 * WHY: one board placement routinely asks the same player several questions in
 * a row. «Philares» on a tile beside an Ares hazard asks a REWARD («gain a
 * standard resource of your choice») and then a PENALTY («lose 1 production»),
 * and the two surfaces looked like the same thing: six resource rows, a cyan
 * frame, A to pick, X to confirm. A player answering the second by the rhythm
 * of the first commits a real loss believing it is a gain. The modal family
 * therefore states a decision's CHARACTER before anything else — in its crest,
 * its emblem, its kicker tag, its consequence footer and its commit verb — and
 * this module is where that character is decided.
 *
 * THREE tones, never more:
 *   gain    — the player receives something (a reward, a bonus, a gift);
 *   loss    — the player gives something up they did not choose to spend
 *             (a hazard penalty, an attack on them, a forced discard);
 *   neutral — a free choice, a price the player chose to pay, an attack the
 *             player AIMS (the victim's prompt is the loss, not the aimer's).
 *
 * STRUCTURAL ONLY (cross-cutting invariant 1): every signal is a server marker
 * or the input's own type — never a title. `Message.message` is rewritten in
 * place by i18n, so a text match would stop matching after the first render.
 *
 * PURE: no Vue, no DOM, no i18n (English KEYS out) — spec'd under the server
 * runner (`tests/console/promptTone.spec.ts`).
 */

import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {OptionMetadata, OrOptionsModel, PlayerInputModel, SelectCardModel, SelectOptionModel, SelectResourceModel} from '@/common/models/PlayerInputModel';

export type PromptTone = 'gain' | 'loss' | 'neutral';

/** WHICH structural signal decided the tone — diagnostics and the guard spec read it. */
export type PromptToneBasis =
  | 'bot-attack'
  | 'production-loss'
  | 'forced-discard'
  | 'reward-mode'
  | 'resource-gain'
  | 'bonus-marker'
  | 'options-gain'
  | 'options-loss'
  | 'aimed-attack'
  | 'none';

export type PromptToneReading = {tone: PromptTone, basis: PromptToneBasis};

const NEUTRAL: PromptToneReading = {tone: 'neutral', basis: 'none'};

/**
 * The tone of ONE option of an `or`, or `undefined` when the option says nothing
 * (no effects declared): an option the client cannot read is never guessed.
 */
function optionTone(option: PlayerInputModel): PromptTone | undefined {
  if (option.type !== 'option') {
    // A nested input carries its own markers (a production loss inside an `or`
    // is still a loss; a resource gain still a gain).
    const nested = promptToneOf(option).tone;
    return nested === 'neutral' ? undefined : nested;
  }
  const meta: OptionMetadata | undefined = (option as SelectOptionModel).metadata;
  const effects: ReadonlyArray<ActionEffect> = meta?.effects ?? [];
  if (effects.length === 0) {
    return undefined;
  }
  const costs = effects.filter((e) => e.direction === 'cost').length;
  if (costs === effects.length) {
    return 'loss';
  }
  if (costs === 0) {
    return 'gain';
  }
  return 'neutral';
}

/**
 * An `or` is a GAIN when every real answer (the decline excluded) only gives,
 * a LOSS when every real answer only takes — anything mixed, unreadable or
 * aimed at another player is a free choice.
 */
function orTone(wf: OrOptionsModel): PromptToneReading {
  const answers = wf.options.filter((o) => (o as SelectOptionModel).metadata?.kind !== 'skip');
  if (answers.length === 0) {
    return NEUTRAL;
  }
  const tones = answers.map(optionTone);
  if (tones.every((t) => t === 'gain')) {
    return {tone: 'gain', basis: 'options-gain'};
  }
  if (tones.every((t) => t === 'loss')) {
    return {tone: 'loss', basis: 'options-loss'};
  }
  return NEUTRAL;
}

/**
 * The tone of a prompt, read off its structural markers in priority order.
 * The order matters only where two markers could disagree: a hostile marker
 * (an attack on the viewer, a forced loss) outranks a context `mode`.
 */
export function promptToneOf(wf: PlayerInputModel | undefined): PromptToneReading {
  if (wf === undefined) {
    return NEUTRAL;
  }
  // ── LOSSES the viewer suffers ──────────────────────────────────────────
  if (wf.botAttackPrompt !== undefined) {
    return {tone: 'loss', basis: 'bot-attack'};
  }
  if (wf.type === 'productionToLose') {
    return {tone: 'loss', basis: 'production-loss'};
  }
  // A discard with nothing bought in exchange is a pure loss; an exchange
  // («discard N to draw N», «discard for M€») is a trade the player weighs.
  if (wf.discardPrompt !== undefined && wf.discardPrompt.exchange === undefined && wf.discardPrompt.min > 0) {
    return {tone: 'loss', basis: 'forced-discard'};
  }
  // ── an attack the viewer AIMS is their own free choice ─────────────────
  if (wf.choiceContext?.mode === 'attack') {
    return {tone: 'neutral', basis: 'aimed-attack'};
  }
  // ── GAINS ──────────────────────────────────────────────────────────────
  if (wf.choiceContext?.mode === 'reward') {
    return {tone: 'gain', basis: 'reward-mode'};
  }
  // `SelectResources` is only ever built as «gain N standard resources»
  // (Philares, the behavior DSL's `standardResource`).
  if (wf.type === 'resources') {
    return {tone: 'gain', basis: 'resource-gain'};
  }
  // …and `SelectResource` says so by its GAIN marker (`amount` — TR54's palette prints it): a pick of the resource
  // that is GIVEN. An unmarked one (a discard, a steal) stays what its other markers make it.
  if (wf.type === 'resource' && (wf as SelectResourceModel).amount !== undefined) {
    return {tone: 'gain', basis: 'resource-gain'};
  }
  if (wf.type === 'card' && (wf as SelectCardModel).resourceGainPrompt !== undefined) {
    return {tone: 'gain', basis: 'resource-gain'};
  }
  if (wf.venusBonusPrompt !== undefined || wf.colonyBonusPrompt !== undefined || wf.deltaBonusPrompt !== undefined) {
    return {tone: 'gain', basis: 'bonus-marker'};
  }
  if (wf.type === 'or') {
    return orTone(wf as OrOptionsModel);
  }
  if (wf.type === 'option') {
    const tone = optionTone(wf);
    return tone === 'gain' ? {tone, basis: 'options-gain'} : tone === 'loss' ? {tone, basis: 'options-loss'} : NEUTRAL;
  }
  return NEUTRAL;
}

/** A NESTED wizard step keeps its own character when it has one, else the decision's. */
export function promptToneWithin(parent: PlayerInputModel | undefined, nested: PlayerInputModel | undefined): PromptTone {
  const own = nested !== undefined ? promptToneOf(nested).tone : 'neutral';
  return own !== 'neutral' ? own : promptToneOf(parent).tone;
}

// ── the words every surface speaks for a tone (English i18n KEYS) ─────────

/** The kicker's TONE TAG — the one word in the same corner of every modal. */
export function promptToneTagKey(tone: PromptTone): string | undefined {
  switch (tone) {
  case 'gain':
    return 'Benefit';
  case 'loss':
    return 'Loss';
  default:
    return undefined;
  }
}

/** The consequence footer's label — what confirming does to the player. */
export function promptOutcomeLabelKey(tone: PromptTone): string {
  switch (tone) {
  case 'gain':
    return 'You will gain';
  case 'loss':
    return 'You will lose';
  default:
    return 'Outcome';
  }
}

/**
 * The COMMIT verb of a toned prompt. A loss is ACCEPTED, never merely
 * «confirmed» — the bar must not say the same word for taking a reward and for
 * giving something up. A gain keeps the surface's own verb (its server label
 * already names the act: «Забрать», «Получить»).
 */
export function promptCommitLabelKey(tone: PromptTone, own: string): string {
  return tone === 'loss' ? 'Accept the loss' : own;
}
