import {ActionEffect, ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {EffectForecast, EffectForecastFact} from '../../common/models/EffectForecastModel';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {CardName} from '../../common/cards/CardName';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {cardPlayPreview} from './cardPlayPreview';
import {effectForecastForPlay} from './effectForecast';

/**
 * THE TABLE'S QUESTIONS, ASKED IN THE COMPOSER (TR51 Influential Discovery — the owner's «strictly pre-select» of
 * 2026-10-12, the player's OWN table included).
 *
 * A play wakes reactions that ASK the player something — Olympus Conference («remove a science to draw, or add
 * one»), Mars University (discard a card to draw one), Pharmacy Union (turn it face down for 3 TR), Viral Enhancers,
 * Splice, Recyclon. The forecast has always NAMED them before the press (an `asks` fact, the «?» chip); the question
 * itself used to arrive as a separate prompt AFTER the press — an answer the player knew before pressing, asked once
 * the move was already made.
 *
 * Now a reacting card hands its `asks` fact the SAME prompt its live hook defers (`EffectForecastFact.preselect`,
 * built by one builder in the card file through `forecast.tableQuestion`), and this pass gives the play's preview
 * those questions as ordinary STEPS — after the card's own, on every branch — so the composer collects them with the
 * card's own choices and the batch posts them in the play's ONE POST. Their order in the batch is not the live
 * queue's (Olympus asks ahead of the card's own choice, Mars University between the choice and its target) and need
 * not be: the replay lands an answer on the prompt ADDRESSED to it (`deferredInputBatch` — the addressee steps
 * forward).
 *
 * ONE honesty rule lives here, because it needs the whole play: a question that picks a card FROM THE HAND is not
 * pre-selectable when something in the same play may DRAW a card before it — the card's own draw, or an earlier
 * reaction's draw option (Olympus's «remove to draw», a first Mars University): the card the player might discard
 * does not exist yet. Such a fact keeps no step and says so in its note — an honest follow-up, named.
 */
export const HIDDEN_DRAW_NOTE = 'Asked after this play: a card it draws may be the one to discard';

const drawsCards = (effects: ReadonlyArray<ActionEffect> | undefined): boolean =>
  (effects ?? []).some((e) => e.direction === 'gain' && e.icon === 'cards');

/** Does an input tree hold an option that draws a card (its metadata's chips)? */
function inputDraws(input: PlayerInputModel): boolean {
  const meta = (input as {metadata?: {effects?: ReadonlyArray<ActionEffect>}}).metadata;
  if (drawsCards(meta?.effects)) {
    return true;
  }
  const options = (input as {options?: ReadonlyArray<PlayerInputModel>}).options ?? [];
  return options.some((o) => inputDraws(o));
}

/** Does an input tree hold a pick of a card FROM THE HAND (a discard)? */
function inputPicksFromHand(input: PlayerInputModel): boolean {
  if ((input as {discardPrompt?: unknown}).discardPrompt !== undefined) {
    return true;
  }
  const options = (input as {options?: ReadonlyArray<PlayerInputModel>}).options ?? [];
  return options.some((o) => inputPicksFromHand(o));
}

/** Does the PLAY itself draw (a branch's own result chips — a draw, a search, a look)? */
function playDraws(preview: ActionPreview): boolean {
  return preview.branches.some((b) => drawsCards(b.effects));
}

/** Can this reaction draw a card before a later question (its own chips, or a draw option of its question)? */
function factDraws(fact: EffectForecastFact): boolean {
  return drawsCards(fact.effects) || (fact.alternatives ?? []).some((a) => drawsCards(a.effects)) ||
    (fact.preselect?.kind === 'input' && inputDraws(fact.preselect.input));
}

/** Is `earlier` asked (or paid) before `later` in the live queue? Unknown order counts as «may be before». */
function before(earlier: EffectForecastFact, later: EffectForecastFact): boolean {
  return earlier.sequence === undefined || later.sequence === undefined || earlier.sequence <= later.sequence;
}

/**
 * The play's preview with its table's questions as steps, and the forecast with each fact's verdict — a step
 * (`preselect` kept) or an honest follow-up (`preselect` dropped, the note naming why). Pure: a new preview and a new
 * forecast; nothing else is touched.
 */
export function withTableQuestions(preview: ActionPreview, forecast: EffectForecast): {preview: ActionPreview, forecast: EffectForecast} {
  const facts = forecast.facts;
  if (!facts.some((f) => f.preselect !== undefined)) {
    return {preview, forecast};
  }
  const draws = playDraws(preview);
  const verdicts: Array<EffectForecastFact> = facts.map((fact) => {
    const step = fact.preselect;
    if (step === undefined || step.kind !== 'input' || !inputPicksFromHand(step.input)) {
      return fact;
    }
    const hidden = draws || facts.some((other) => other !== fact && factDraws(other) && before(other, fact) &&
      // a reaction listed AFTER this one with the same priority is behind it in the queue
      !(other.sequence !== undefined && other.sequence === fact.sequence && facts.indexOf(other) > facts.indexOf(fact)));
    if (!hidden) {
      return fact;
    }
    const honest: EffectForecastFact = {...fact, note: HIDDEN_DRAW_NOTE};
    delete honest.preselect;
    return honest;
  });
  const steps: Array<ActionPreviewStep> = [];
  for (const fact of verdicts) {
    if (fact.preselect !== undefined) {
      steps.push(fact.preselect.kind === 'input' ? {...fact.preselect, reaction: {card: fact.source.name as CardName, fact: fact.id}} : fact.preselect);
    }
  }
  const branches: Array<ActionPreviewBranch> = preview.branches.map((b) => ({...b, steps: [...b.steps, ...steps]}));
  return {preview: {...preview, branches}, forecast: {...forecast, facts: verdicts}};
}

/**
 * THE PLAY'S PREVIEW AS THE COMPOSER RECEIVES IT — the card's own preview, the table's forecast, and the table's
 * questions as steps. ONE function for the route (`routes/CardPlayPreview.ts`) and for the replay guard
 * (`cardPlayReplayCoverage`), so the guard replays exactly the batch a composer would post.
 */
export function playPreviewWithTableQuestions(player: IPlayer, card: ICard): ActionPreview {
  const base = cardPlayPreview(player, card);
  const {preview, forecast} = withTableQuestions(base, effectForecastForPlay(player, card, base));
  return {...preview, forecast};
}
