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
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {PlayedTargetPreviewSection, PlayedTargetResourceContext} from './consolePlayedTargetModel';

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

/** The step's per-target resource delta, when it has one. */
function stepAmountOf(input: SelectCardModel): number | undefined {
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
  // A resource step over the target's live count — `current → resulting`.
  const amount = stepAmountOf(input);
  const model = input.cards.find((c) => c.name === name);
  if (amount !== undefined && amount !== 0 && model?.resources !== undefined) {
    out.push({
      key: 'res',
      title: 'Target card',
      entity: 'target',
      impacts: [{
        label: 'Resources on this card',
        from: model.resources,
        to: Math.max(0, model.resources + amount),
      }],
    });
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
  input: SelectCardModel,
  cardResource: string | undefined,
  card: CardModel,
): PlayedTargetResourceContext | undefined {
  const amount = stepAmountOf(input);
  if (amount === undefined || amount === 0 || card.resources === undefined) {
    return undefined;
  }
  return {icon: cardResource ?? 'resource', count: card.resources};
}
