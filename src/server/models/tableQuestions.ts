import {ActionEffect, ActionPreview, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {DEFERRABLE_DRAW_NOTE, EffectForecast, EffectForecastFact} from '../../common/models/EffectForecastModel';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {CardName} from '../../common/cards/CardName';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {cardPlayPreview} from './cardPlayPreview';
import {effectForecastForPlay} from './effectForecast';
import {oneShotEffectsOf} from '../cards/armedPlayEffects';

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
 * those questions as ordinary card-level PRE-STEPS — branch-independent: the table answers the PLAY whichever variant
 * the player picks, so its answers are collected once and survive a change of variant — and the batch posts them in
 * the play's ONE POST. Their order in the batch is not the live
 * queue's (Olympus asks ahead of the card's own choice, Mars University between the choice and its target) and need
 * not be: the replay lands an answer on the prompt ADDRESSED to it (`deferredInputBatch` — the addressee steps
 * forward).
 *
 * ONE rule lives here, because it needs the whole play: a question that picks a card FROM THE HAND behind something
 * in the same play that DRAWS a card before it may be answered NOW or AFTER THE DRAW (the owner's decision 2026-10-15,
 * «Конференция на Олимпе» × «Марсианский университет» — `common/models/tableQuestionDeferral.ts`): the card drawn
 * first may be the one worth giving up, so the step stays and names who draws before it. A draw nobody chooses (the
 * card's own, an exact reaction, a question that is itself asked after the press) is `reaction.drawnBefore` — the row
 * may wait from the start. A draw that is an OPTION of an earlier question the composer collects (Olympus's «remove to
 * draw», a first Mars University's own discard-and-draw) is a gate (`reaction.afterDraw`): the row waits for that
 * answer, and may wait for the draw when the answer draws. An unanswered row posts nothing; the live queue asks it
 * after the draw, with the drawn card among the candidates (until 2026-10-15 such a row was a «ДАЛЕЕ» line with no
 * answer before the press at all).
 *
 * The steps stand in the LIVE QUEUE'S order (each fact's `sequence` — Pharmacy Union, Olympus, Mars University): the
 * row that waits for an answer never stands above the question it waits for.
 */
export {DEFERRABLE_DRAW_NOTE};

const drawsCards = (effects: ReadonlyArray<ActionEffect> | undefined): boolean =>
  (effects ?? []).some((e) => e.direction === 'gain' && e.icon === 'cards');

/** How many cards the chips draw in all — `undefined` when a draw chip states no amount. */
function drawCount(effects: ReadonlyArray<ActionEffect> | undefined): number | undefined {
  let total = 0;
  for (const e of effects ?? []) {
    if (e.direction === 'gain' && e.icon === 'cards') {
      if (e.amount === undefined) {
        return undefined;
      }
      total += e.amount;
    }
  }
  return total;
}

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

/**
 * Does the PLAY itself draw (a branch's own result chips — a draw, a search, a look)? `cards` — how many, when every
 * drawing branch draws the same stated count.
 */
function playDraw(preview: ActionPreview): {cards?: number} | undefined {
  const counts = preview.branches.filter((b) => drawsCards(b.effects)).map((b) => drawCount(b.effects));
  if (counts.length === 0) {
    return undefined;
  }
  const [first] = counts;
  return first !== undefined && counts.every((n) => n === first) ? {cards: first} : {};
}

/**
 * Can this reaction draw a card before a later question (its own chips, or a draw option of its question)? A reaction
 * that is SKIPPED (or does not trigger) does nothing at all — its chips name what it would have done (Mars University
 * with an empty hand). A draw into ANOTHER player's hand is not this player's draw.
 */
function factDraws(fact: EffectForecastFact): boolean {
  if (fact.certainty === 'skipped' || fact.certainty === 'no') {
    return false;
  }
  return drawsCards(fact.effects) || (fact.alternatives ?? []).some((a) => drawsCards(a.effects)) ||
    (fact.preselect?.kind === 'input' && inputDraws(fact.preselect.input));
}

/** Is `earlier` asked (or paid) before `later` in the live queue? Unknown order counts as «may be before». */
function before(earlier: EffectForecastFact, later: EffectForecastFact): boolean {
  return earlier.sequence === undefined || later.sequence === undefined || earlier.sequence <= later.sequence;
}

/** What `withTableQuestions` decides for one hand-pick question: who draws before it, whatever the answers. */
type DrawVerdict = {gates: Array<string>, drawnBefore: Array<{card: CardName, cards?: number}>};

/**
 * The play's preview with its table's questions as steps, and the forecast with each fact's verdict — a discard behind
 * a draw keeps its step and learns who draws first (its note names the choice: now, or after the draw). Pure: a new
 * preview and a new forecast; nothing else is touched. `played` — the card being played (the drawer when the play
 * itself draws).
 */
export function withTableQuestions(preview: ActionPreview, forecast: EffectForecast, played?: CardName): {preview: ActionPreview, forecast: EffectForecast} {
  const facts = forecast.facts;
  if (!facts.some((f) => f.preselect !== undefined)) {
    return {preview, forecast};
  }
  const own = playDraw(preview);
  const verdicts: Array<EffectForecastFact> = [];
  const draws = new Map<string, DrawVerdict>();
  facts.forEach((fact, at) => {
    const step = fact.preselect;
    if (step === undefined || step.kind !== 'input' || !inputPicksFromHand(step.input)) {
      verdicts.push(fact);
      return;
    }
    const drawers = facts.filter((other, k) => k !== at && factDraws(other) && other.recipient.kind === 'you' && before(other, fact) &&
      // a reaction listed AFTER this one with the same priority is behind it in the queue
      !(other.sequence !== undefined && other.sequence === fact.sequence && k > at));
    const verdict: DrawVerdict = {gates: [], drawnBefore: []};
    if (own !== undefined && played !== undefined) {
      verdict.drawnBefore.push({card: played, ...(own.cards !== undefined ? {cards: own.cards} : {})});
    }
    for (const other of drawers) {
      if (other.preselect !== undefined && other.preselect.kind === 'input') {
        // A question the composer collects: whether it draws is the player's answer above this one.
        verdict.gates.push(other.id);
      } else {
        // A draw nobody chooses here — an exact reaction, or a question asked after the press.
        const cards = drawCount(other.effects);
        verdict.drawnBefore.push({card: other.source.name as CardName, ...(cards !== undefined && other.certainty === 'exact' ? {cards} : {})});
      }
    }
    if (verdict.gates.length === 0 && verdict.drawnBefore.length === 0) {
      verdicts.push(fact);
      return;
    }
    draws.set(fact.id, verdict);
    verdicts.push(verdict.drawnBefore.length > 0 ? {...fact, note: DEFERRABLE_DRAW_NOTE} : fact);
  });
  const steps: Array<{step: ActionPreviewStep, sequence: number | undefined}> = [];
  for (const fact of verdicts) {
    if (fact.preselect === undefined) {
      continue;
    }
    if (fact.preselect.kind !== 'input') {
      steps.push({step: fact.preselect, sequence: fact.sequence});
      continue;
    }
    const verdict = draws.get(fact.id);
    steps.push({
      step: {
        ...fact.preselect,
        reaction: {
          card: fact.source.name as CardName,
          fact: fact.id,
          ...(verdict !== undefined && verdict.gates.length > 0 ? {afterDraw: verdict.gates} : {}),
          ...(verdict !== undefined && verdict.drawnBefore.length > 0 ? {drawnBefore: verdict.drawnBefore} : {}),
        },
      },
      sequence: fact.sequence,
    });
  }
  // THE LIVE QUEUE'S ORDER (a stable sort, only when every question names its priority): the facts come in the
  // tableau's order, and a university played before the conference would otherwise stand above the answer it waits for.
  if (steps.every((s) => s.sequence !== undefined)) {
    steps.sort((a, b) => (a.sequence as number) - (b.sequence as number));
  }
  return {preview: {...preview, preSteps: [...(preview.preSteps ?? []), ...steps.map((s) => s.step)]}, forecast: {...forecast, facts: verdicts}};
}

/**
 * THE PLAY'S PREVIEW AS THE COMPOSER RECEIVES IT — the card's own preview, the table's forecast, and the table's
 * questions as steps. ONE function for the route (`routes/CardPlayPreview.ts`) and for the replay guard
 * (`cardPlayReplayCoverage`), so the guard replays exactly the batch a composer would post.
 */
export function playPreviewWithTableQuestions(player: IPlayer, card: ICard): ActionPreview {
  const base = cardPlayPreview(player, card);
  const {preview, forecast} = withTableQuestions(base, effectForecastForPlay(player, card, base), card.name);
  // What this play ARMS for the next card (TR49 class) — the card's one-play declarations, named before the press.
  const arms = oneShotEffectsOf(card, player);
  return arms.length > 0 ? {...preview, forecast, arms} : {...preview, forecast};
}
