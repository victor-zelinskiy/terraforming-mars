/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CONTEXTUAL PREVIEW for a played-card target — the ONE builder, shared by
 * every host of the embedded selector.
 *
 * WHY IT LIVES HERE. The selector component contains no game knowledge by
 * design: it renders a model and reports focus. The knowledge of what CHOOSING
 * a candidate would do belongs to whoever raised the prompt — and there are now
 * two of those (the card-play composer and the blue-action composer), with a
 * third (any future workspace) already implied. Written twice, the two would
 * have drifted the first time a new step shape appeared, and the player would
 * have got a different explanation of the same mechanic depending on which
 * screen they came from.
 *
 * IT READS THE SERVER, IT DOES NOT DERIVE. Both shapes come straight off the
 * authoritative `ActionPreviewStep`:
 *
 *  · `copyProductionBox[card]` — what a copy-production step would copy
 *    (Robotic Workforce, Cyberia Systems, and anything that opts in);
 *  · the step's resource delta over the candidate's live count — what an
 *    add/remove-resource step would do TO the target, as the honest
 *    `current → resulting` this fork requires before any confirm.
 *
 * NOTHING KEYS ON A CARD NAME. A card the console has no data for yields no
 * sections, and the rail then shows the candidate's identity alone rather than
 * inventing a claim — which is also how a brand-new card is covered the day the
 * server starts sending its numbers.
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys).
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {PlayedTargetImpact, PlayedTargetPreviewSection, PlayedTargetResourceContext} from './consolePlayedTargetModel';

/**
 * The server's marker for «this amount lands ON THE CHOSEN CARD», set by
 * `actionPreviews.cardResourceGain` / `cardResourceCost`.
 *
 * Reading `note` as a discriminator is the established pattern here, not a text
 * sniff: it is a typed field the SERVER authors, and the copied-production fold
 * already keys on its sibling `note: 'production'`. What it buys is the whole
 * `optionInput` family — «Обстрел кометами», «Права на астероиды», AstroDrill,
 * «Биопечать» and the rest — which carry no per-step `amount` at all (the delta
 * lives in the BRANCH's effects, because the target is a branch option rather
 * than a step) and therefore had nothing to say in the status rail but a name.
 */
const ON_CARD_NOTE = 'to a card';

/** The per-candidate delta a branch's own effects imply, if any. */
function onCardDeltaOf(effects: ReadonlyArray<ActionEffect> | undefined): {icon: string, amount: number} | undefined {
  const hit = (effects ?? []).find((e) => e.note === ON_CARD_NOTE && e.amount !== 0);
  if (hit === undefined) {
    return undefined;
  }
  return {icon: hit.icon, amount: hit.direction === 'cost' ? -hit.amount : hit.amount};
}

/** The production resources a copy-production box can carry, in chip order. */
const STANDARD_PROD_KEYS = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;

/**
 * PRODUCTION labels, not bare resource names. The quick readings drop their
 * section titles (the rail is one line, the summary is one row), so «БУДЕТ
 * СКОПИРОВАНО» no longer supplies the word «производство» — the impact has to
 * carry its own meaning or it reads as a stock gain. The Result chip states the
 * same fact the other way round (`0 → 1 производство`, no resource name), so the
 * two are complements rather than two wordings of one line.
 */
const PROD_LABEL: Record<string, string> = {
  megacredits: 'M€ production', steel: 'Steel production', titanium: 'Titanium production',
  plants: 'Plant production', energy: 'Energy production', heat: 'Heat production',
};

/**
 * The step's per-target resource delta.
 *
 * IT RIDES THE STEP. The server puts no `amount` on a `SelectCardModel`, so
 * reading it off the input returned `undefined` for every pre-collected family
 * and the whole reading fell through to the branch's effect chip. That fallback
 * covers «добавьте N на карту» (a `to a card` gain), but NOT a step whose effect
 * is stated on the SOURCE card — Predators says «+1 животное НА ЭТОЙ КАРТЕ», so
 * nothing described the target at all, and the one screen whose entire job is
 * comparing targets showed each candidate's name and nothing else.
 *
 * The input is still consulted second: a host may pre-stamp the model, and
 * silently ignoring that would trade one dead path for another.
 */
function stepAmountOf(step: ActionPreviewStep | undefined, input: SelectCardModel): number | undefined {
  if (step !== undefined && step.kind === 'input' && step.amount !== undefined) {
    return step.amount;
  }
  return (input as SelectCardModel & {amount?: number}).amount;
}

/**
 * Build the contextual sections for ONE candidate.
 *
 * `step` is the authoritative `ActionPreviewStep` the choice came from (the
 * host knows which branch it is walking); `input` is that step's `SelectCard`
 * model, which carries the live per-candidate resource counts.
 */
export function playedTargetPreviewFor(
  step: ActionPreviewStep | undefined,
  input: SelectCardModel,
  name: CardName,
  /** The SELECTED branch's own effects — where an `optionInput` target's delta
   *  lives (there is no step to carry it). Omitted by callers that have none. */
  branchEffects?: ReadonlyArray<ActionEffect>,
  /** The branch's authoritative per-candidate VP reading, for the same family. */
  branchVpBox?: Partial<Record<CardName, {from: number, to: number}>>,
): ReadonlyArray<PlayedTargetPreviewSection> {
  const out: Array<PlayedTargetPreviewSection> = [];
  const box = step !== undefined && step.kind === 'input' ? step.copyProductionBox?.[name] : undefined;
  if (box !== undefined) {
    const impacts = STANDARD_PROD_KEYS
      .map((res) => ({res, amount: Number((box as Record<string, number | undefined>)[res] ?? 0)}))
      .filter((u) => u.amount !== 0)
      .map((u) => ({label: PROD_LABEL[u.res], icon: u.res, amount: u.amount}));
    if (impacts.length > 0) {
      out.push({key: 'copy', title: 'Will be copied', entity: 'player', impacts});
      out.push({key: 'src', title: '', entity: 'source', impacts: [], note: 'The source card stays unchanged'});
    }
  }
  // A resource change over the target's live count — `current → resulting`.
  //
  // TWO SOURCES, one reading. A pre-collected STEP carries its own `amount`
  // (Predators and the add-to-card family); a branch OPTION carries it in the
  // branch's effects instead, because there is no step to hang it on. Reading
  // both is what stopped the rail saying nothing but the card's name on every
  // «потратьте X, чтобы добавить Y на карту» action.
  const onCard = onCardDeltaOf(branchEffects);
  const amount = stepAmountOf(step, input) ?? onCard?.amount;
  const model = input.cards.find((c) => c.name === name);
  if (amount !== undefined && amount !== 0 && model !== undefined) {
    // A card with no counter yet reads as 0 — «0 → 1» is the honest statement
    // of what the press does, and it is the whole point of the preview.
    const from = model.resources ?? 0;
    const impacts: Array<PlayedTargetImpact> = [{
      label: 'Resources on this card',
      icon: onCard?.icon ?? (step !== undefined && step.kind === 'input' ? step.cardResource : undefined),
      from,
      to: Math.max(0, from + amount),
    }];
    /**
     * …and the VICTORY POINTS that resource moves.
     *
     * Authoritative and per-candidate: the server evaluated each card's own
     * `victoryPoints` descriptor against ITS OWNER's tableau, including the
     * `per` arithmetic that makes 2 → 3 asteroids often NOT a VP change.
     *
     * PRESENT IS THE CONDITION, movement is NOT. A card that scores per resource
     * earns the line even when this particular move leaves it where it was —
     * «1 ПО за каждую фишку» versus «1 ПО за каждые две, и там чётное число» is
     * the entire comparison when choosing what to take from whom, and dropping
     * the second would make it read exactly like a card that scores nothing.
     * The static reading is marked so it can be stated QUIETLY rather than
     * competing with the ones that move.
     */
    const vp = (step !== undefined && step.kind === 'input' ? step.vpBox?.[name] : undefined) ?? branchVpBox?.[name];
    if (vp !== undefined) {
      // No icon: 'vp' resolves to no sprite in the shared vocabulary, and a
      // broken glyph beside a number is worse than the canonical «ПО» label.
      // No owner name either — the rail already states WHOSE card is focused one
      // segment to the left, and saying it twice on one line is what makes a
      // status line stop being glanceable.
      impacts.push({label: 'VP', from: vp.from, to: vp.to, static: vp.from === vp.to});
    }
    out.push({key: 'res', title: 'Target card', entity: 'target', impacts});
  }
  return out;
}

/**
 * The resource badge a candidate face earns — EXPLICIT, and only when the card's
 * resource is what the step moves.
 *
 * The condition is deliberately the SAME one that produces the
 * `current → resulting` section above: a badge without that reading, or a
 * reading without that badge, would be two different claims about whether the
 * resource matters here. A copy-production step moves no resource, so there is
 * no badge — which is how a gold «0» stopped appearing on every building card
 * without a single card-specific rule.
 */
export function playedTargetResourceFor(
  /** The step's delta — passed EXPLICITLY. It used to be dug out of the input
   *  model, which never carries one, so the badge could not appear anywhere. */
  amount: number | undefined,
  cardResource: string | undefined,
  card: CardModel,
): PlayedTargetResourceContext | undefined {
  if (amount === undefined || amount === 0) {
    return undefined;
  }
  /**
   * ZERO IS A READING, NOT AN ABSENCE — and it is the whole reason `showZero`
   * exists. Once the step moves this resource, every candidate the SERVER
   * offered is by construction a card that can hold it, so «сколько там сейчас»
   * is part of the decision on all of them. An empty card answering with no chip
   * at all says something else entirely — «this card does not take floaters» —
   * which is the opposite of true and the one thing the player would act on.
   *
   * `card.resources` is omitted rather than sent as 0 for an untouched card, so
   * the absent field IS the zero.
   */
  return {icon: cardResource ?? 'resource', count: card.resources ?? 0, showZero: true};
}
