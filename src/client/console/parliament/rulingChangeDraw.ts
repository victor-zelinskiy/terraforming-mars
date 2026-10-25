import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentRulingAnswerModel} from '@/common/models/ParliamentModel';
import {isReduxParty, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {acknowledgeDraw, dismissEvent, drawnCardsState, DrawnCardEntry, markAllTaken, setAcking} from '@/client/components/drawnCards/drawnCardsState';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {RATING_RAIL_KEY, ResourceTransferSpec, TOUCHDOWN_TICK_GAP_MS} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, releasePanelRewardHold, runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {rectOf} from './parliamentFlights';
import {allianceImpulsesSettled} from './allianceImpulse';
import {consoleParliamentUi} from './consoleParliamentFlow';
import {generationSceneRisesIntoSitting} from '@/client/console/generationScene/generationScene';
import {scheduleParliamentBeat} from './parliamentBeat';
import {probeTick} from '@/client/console/probeTick';
import {sittingBaselineOf} from './sittingBaseline';
import {sittingRiseOwed} from './sittingRise';

/*
 * A CARD ANSWERS A CHANGE OF POWER (Turmoil Redux — TR62 Tharsis Alliance: «draw a card when either of those parties
 * becomes ruling»). The server draws at the sitting's ENACTMENT and names the batch `{type: 'ruling-change', cardName,
 * party}` (never the card's name here — the source's TYPE is the contract). The batch arrives with the response that
 * answered the sitting's first gate, while the director still has the Agenda, the support and the enactment to play,
 * so its one honest presentation is the TAIL OF THE ENACTMENT TACT: once the seals have changed places, the card leaves
 * the project deck's pile and lands in the hand dock through the shared intake (`runHandIntake` — the dock's counter
 * ticks on the touchdown), and the batch is consumed (acknowledged) with no reveal over the sitting.
 *
 * THE PARK. While a sitting stands whose enactment has not been told yet, such a batch is presented NOWHERE (the same
 * law and shape as the Agenda card's park: scoped to the batch type it parks, never «the reveal»): the deck-draw scene
 * waits, the reveal queue skips it, it is not a live result-modal. The section OPENS the park when its sitting stands
 * (`openRulingChangePark`) and the enactment's tail CLOSES it with the delivery (`deliverRulingChangeDraws`); a sitting
 * the viewer never watches (a reload past the enactment, a bot-only table) never opens it — the batch then takes the
 * ordinary road (the deck-draw scene and the received-cards reveal). The park is BOUNDED (`PARK_NET_MS`, named): a
 * walk that never reaches the enactment releases the batch to that ordinary road, never to nowhere.
 *
 * A RATING ANSWER (TR63 Eden Alliance: «gain 1 TR when either of those parties becomes ruling») rides the same tail.
 * The server MEASURES every card's answer around its hook into the sitting's summary (`rulingAnswers`: the rating it
 * raised, the cards it drew, the stock the table paid back in the same call — the Greens' M€ for that rating). SEED, in
 * the apply block (`seedRulingChangeAnswers` ← `seedParliamentSittingHolds`): a viewer's NEW rating answer, with the
 * sitting ON SCREEN, holds the rating cell and the table's answer on the rail (`committed − held`); off screen it ticks
 * with the commit. DELIVER, at the enactment's tail: the token is born on the seal of the party that came to power —
 * the cause on the screen — flies to the rating cell and ticks it on the touchdown; the table's answer ticks one beat
 * after (a reaction never before its reason). The hold is named and bounded (`ruling-change-rating-owed`).
 *
 * A PRODUCTION answer (TR64 Promethean Alliance: «gain 2 M€ production when either of those parties becomes ruling») is
 * the same tail with a production token: born on the same seal, landing on the row's PRODUCTION badge, the badge ticking
 * on the touchdown. A card that answers with both rides one group (the rating first, then the production).
 */

/** The park's safety: a sitting that never reaches its enactment tact lets the batch go to the ordinary road. */
const PARK_NET_MS = 30_000;
/** The tail waits at most this long for the alliance's impulse (the seals' own answer to the change comes first). */
const IMPULSE_WAIT_MS = 1_600;

export const rulingChangeDrawState = reactive({
  /** The sitting key whose enactment has not been told yet — the park stands while it is set. */
  owedKey: undefined as string | undefined,
  /** A delivery in flight (the intake is airborne) — the batch stays parked until it lands. */
  delivering: false,
  /**
   * WHAT the delivery in flight is (the band's line for the enactment's tail — «Альянс Тарсиса · карта ·
   * «Марс вперёд» у власти»): the card that answered, the party that came to power, the cards it drew.
   */
  presenting: undefined as {card: CardName, party: ReduxParty, count?: number, tr?: number, production?: number} | undefined,
  /** The viewer's RATING answers owed to the tail (seeded on screen, their rows held) — in the server's order. */
  ratings: [] as Array<RulingRatingOwed>,
});

/** ONE rating / production answer owed to the enactment's tail: its key, the card, the party come to power, the held rows. */
export type RulingRatingOwed = {
  key: string;
  card: CardName;
  party: ReduxParty;
  /** The tokens born on the seal — the rating (`stock` · `rating`), then the production the card raised (`production` · M€). */
  specs: ReadonlyArray<ResourceTransferSpec>;
  /** The table's answer in the same call (the Greens' M€) — held with the rating, released one beat after its touchdown. */
  reactions: ReadonlyArray<ResourceTransferSpec>;
};

/** The structural identity of an answer — the sitting's generation, the card, the party, the seat. */
function rulingAnswerKey(generation: number, answer: ParliamentRulingAnswerModel): string {
  return `${generation}:${answer.player}:${answer.card}:${answer.party}`;
}

/** The answers of the viewer the RESPONSE added (absent from `before`'s summary of the same generation). Pure. */
export function newViewerRulingAnswers(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<{key: string, answer: ParliamentRulingAnswerModel}> {
  const viewer = after.thisPlayer?.color;
  const phase = after.game.parliament?.phase;
  const was = sittingBaselineOf(before, after);
  if (viewer === undefined || phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.summary?.rulingAnswers ?? []).map((a) => rulingAnswerKey(was.generation, a)));
  return (phase.summary?.rulingAnswers ?? [])
    .filter((answer) => answer.player === viewer)
    .map((answer) => ({key: rulingAnswerKey(phase.generation, answer), answer}))
    .filter(({key}) => !known.has(key));
}

/**
 * The rail rows an answer holds: the tokens born on the seal (the rating, then each production step the card raised —
 * positive moves only) and the table's stock answer to the rating (positive moves only). A draw-only answer holds
 * nothing here (its cards ride the intake).
 */
export function ratingAnswerSpecs(answer: ParliamentRulingAnswerModel): {specs: Array<ResourceTransferSpec>, reactions: Array<ResourceTransferSpec>} | undefined {
  if (!isReduxParty(answer.party)) {
    return undefined;
  }
  const specs: Array<ResourceTransferSpec> = [];
  if ((answer.tr ?? 0) > 0) {
    specs.push({channel: 'stock', resource: RATING_RAIL_KEY, amount: answer.tr ?? 0});
  }
  for (const [resource, amount] of Object.entries(answer.production ?? {})) {
    if ((amount ?? 0) > 0) {
      specs.push({channel: 'production', resource, amount: amount ?? 0});
    }
  }
  if (specs.length === 0) {
    return undefined;
  }
  const reactions: Array<ResourceTransferSpec> = Object.entries(answer.stock ?? {})
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resource, amount]) => ({channel: 'stock', resource, amount: amount ?? 0}));
  return {specs, reactions};
}

/** The band's numbers for an owed answer — the rating and the M€ production it carries. */
function presentedAmounts(rating: RulingRatingOwed): {tr?: number, production?: number} {
  const tr = rating.specs.find((s) => s.channel === 'stock' && s.resource === RATING_RAIL_KEY)?.amount;
  const production = rating.specs.filter((s) => s.channel === 'production').reduce((sum, s) => sum + s.amount, 0);
  return {...(tr === undefined ? {} : {tr}), ...(production > 0 ? {production} : {})};
}

/**
 * SEED — the apply block (the SAME synchronous block as the view apply): the viewer's new rating answers are held on
 * the rail while the sitting is ON SCREEN (its stage stands); off screen, or under reduced motion, the counters tick
 * with the commit.
 */
export function seedRulingChangeAnswers(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  // The sitting is over: a rating no stage is telling has nowhere left to be told.
  if (after !== undefined && after.game.parliament?.phase === undefined) {
    releaseOrphanRulingRatings('phase-end');
  }
  if (after === undefined || consoleReducedMotionActive() || !(consoleParliamentUi.stageStanding || generationSceneRisesIntoSitting(after) || sittingRiseOwed())) {
    return;
  }
  for (const {key, answer} of newViewerRulingAnswers(before, after)) {
    const specs = ratingAnswerSpecs(answer);
    if (specs === undefined || rulingChangeDrawState.ratings.some((owed) => owed.key === key)) {
      continue;
    }
    beginPanelRewardHold([...specs.specs, ...specs.reactions]);
    rulingChangeDrawState.ratings.push({key, card: answer.card, party: answer.party, ...specs});
  }
}

/** Release every owed rating at once (the stage ended, the ceiling, a reset) — the counters tick, honestly late. */
export function releaseRulingRatings(why: string): void {
  const owed = rulingChangeDrawState.ratings.splice(0);
  for (const rating of owed) {
    rating.specs.forEach((spec) => releasePanelRewardHold(spec));
    rating.reactions.forEach((spec) => releasePanelRewardHold(spec));
  }
  if (owed.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[ruling-change] released ${owed.length} rating answer(s): ${why}`);
  }
}

/**
 * THE RATING CLAIMS THE FOREGROUND ONLY WHILE ITS CONSUMER STANDS — the sitting's stage (whose enactment's tail
 * delivers it) or the delivery in flight. Seeded while the sitting is merely AHEAD of the seat (the soft gates: the
 * last pass was another seat's, the whole chain arrived by poll / WS, the plate opens the sitting), a blocking claim
 * deadlocked the plate itself — the plate waits for a free foreground, the rating waits for the stage the plate opens
 * (field 2026-10-24 / 25: ~22 s of an empty board, «the foreground claimed to be busy with NOTHING rendered», then
 * «the sitting 9:9 never told its enactment»). The parliament ledger's own law (`parliamentRewardBeat`'s
 * `awaitingStage`): the rows stay held for the walk, the claim stands up with the stage.
 */
export function rulingRatingClaimsForeground(): boolean {
  return rulingChangeDrawState.ratings.length > 0 && (consoleParliamentUi.stageStanding || rulingChangeDrawState.delivering);
}

/**
 * The tail will never be told for these ratings — the sitting is gone (or was re-read past its enactment) and no stage
 * stands to deliver them: the counters tick now, honestly late, never held for a walk that cannot come.
 */
export function releaseOrphanRulingRatings(why: string): void {
  if (!consoleParliamentUi.stageStanding) {
    releaseUntoldRulingRatings(why);
  }
}

/** The stage stands but will not tell the tail again (a re-read, a told enactment): owed ratings tick now — unless in flight. */
export function releaseUntoldRulingRatings(why: string): void {
  // A delivery in flight owns its rows: its touchdowns release them (a second release would double-tick a counter).
  if (!rulingChangeDrawState.delivering) {
    releaseRulingRatings(why);
  }
}

// A rating owed to the tail holds the foreground — the next prompt waits for its own story. Bounded by the registry's
// ceiling, whose `expire` releases the counters honestly.
registerAnimationHoldSupplier('ruling-change-rating-owed', rulingRatingClaimsForeground, {
  diagnose: () => rulingChangeDrawState.ratings.map((owed) => owed.key),
  expire: () => releaseRulingRatings('ceiling'),
});

let net: ReturnType<typeof setTimeout> | undefined;

function clearNet(): void {
  if (net !== undefined) {
    clearTimeout(net);
    net = undefined;
  }
}

/** Is `source` a card's answer to a change of power — the batch type this module presents. */
export function isRulingChangeDraw(source: CardDrawRevealSource | undefined): boolean {
  return source?.type === 'ruling-change';
}

/** THE PARK: a ruling-change batch is presented nowhere while the sitting still owes its enactment tact (or delivers it). */
export function rulingChangeParksReveal(source: CardDrawRevealSource | undefined): boolean {
  return isRulingChangeDraw(source) && (rulingChangeDrawState.owedKey !== undefined || rulingChangeDrawState.delivering);
}

/** The section's sitting stands and its enactment is still to be told (`key` — the sitting's own key). */
export function openRulingChangePark(key: string): void {
  if (rulingChangeDrawState.owedKey === key) {
    return;
  }
  rulingChangeDrawState.owedKey = key;
  clearNet();
  // The one wall clock here is a NET over a sitting that never tells its enactment (a bound, never a beat).
  net = setTimeout(() => releaseUntoldPark(key), PARK_NET_MS);
}

/** The net fired: the sitting never told its enactment — the batch takes the ordinary road, named. */
function releaseUntoldPark(key: string): void {
  net = undefined;
  if (rulingChangeDrawState.owedKey === key && !rulingChangeDrawState.delivering) {
    console.warn(`[ruling-change-draw] the sitting ${key} never told its enactment — the batch takes the ordinary road`);
    rulingChangeDrawState.owedKey = undefined;
    // …and a rating owed to that same tail, with no stage to tell it, ticks with the batch.
    releaseOrphanRulingRatings('untold');
  }
}

/** The park lets go with nothing delivered (the sitting left, the game switched): the ordinary road takes the batch. */
export function closeRulingChangePark(): void {
  clearNet();
  rulingChangeDrawState.owedKey = undefined;
}

/** The batches the delivery owes: the viewer's own ruling-change draws still standing. */
function owedBatches(): Array<DrawnCardEntry> {
  return drawnCardsState.events.filter((e) => isRulingChangeDraw(e.source) && !e.dismissed && !e.acking && e.cards.length > 0);
}

/**
 * THE ENACTMENT'S TAIL: every owed ruling-change batch leaves the project deck's pile for the hand dock (face down —
 * a card off the deck; the dock shows what it is the frame it lands), the batch is consumed on the intake's commit and
 * acknowledged; then the park closes. Resolves when the last card has LANDED (the walk goes on from the touchdown, so
 * the reward page never opens over a card still in the air). Nothing owed — the park simply closes.
 */
export async function deliverRulingChangeDraws(viewId: string): Promise<void> {
  clearNet();
  const batches = owedBatches();
  if (batches.length === 0 && rulingChangeDrawState.ratings.length === 0) {
    rulingChangeDrawState.owedKey = undefined;
    return;
  }
  rulingChangeDrawState.delivering = true;
  rulingChangeDrawState.owedKey = undefined;
  // THE ORDER OF THE TAIL: the seals change places → the alliance's impulse (a road the new government opened) → the
  // card. Two objects never move at once; the wait is bounded and the batch stays parked through it.
  await allianceImpulsesSettled(IMPULSE_WAIT_MS, probeTick);
  try {
    for (const batch of batches) {
      const pile = rectOf(document.querySelector('.con-deckstack__pile'));
      const source = batch.source;
      rulingChangeDrawState.presenting = source?.type === 'ruling-change' && isReduxParty(source.party) ?
        {card: source.cardName, party: source.party, count: batch.cards.length} : undefined;
      setAcking(batch.id, true);
      await runHandIntake(batch.cards.map((card) => ({name: card.name, back: true, ...(pile === undefined ? {} : {rect: pile})})), {
        commit: () => {
          markAllTaken(batch.id);
          dismissEvent(batch.id);
        },
      });
      acknowledgeDraw(viewId, batch.id);
    }
    for (const rating of rulingChangeDrawState.ratings.slice()) {
      rulingChangeDrawState.presenting = {card: rating.card, party: rating.party, ...presentedAmounts(rating)};
      await deliverRating(rating);
    }
  } finally {
    rulingChangeDrawState.delivering = false;
    rulingChangeDrawState.presenting = undefined;
  }
}

/**
 * ONE rating / production answer: the tokens are born on the seal of the party that came to power (the cause on screen
 * — the card that answered stands in nobody's view here), fly to the rating cell / the production badge and tick each
 * on its own touchdown; the table's answer ticks one beat after. A seal that cannot be measured degrades honestly: the
 * rows tick at once.
 */
async function deliverRating(rating: RulingRatingOwed): Promise<void> {
  const seal = rectOf(document.querySelector(`.con-parl__party[data-party="${rating.party}"] .con-pseal__seal`));
  const origin = seal === undefined ? undefined : {x: seal.left + seal.width / 2, y: seal.top + seal.height / 2};
  const done = () => {
    rulingChangeDrawState.ratings = rulingChangeDrawState.ratings.filter((owed) => owed.key !== rating.key);
  };
  if (origin === undefined) {
    rating.specs.forEach((spec) => releasePanelRewardHold(spec));
    rating.reactions.forEach((spec) => releasePanelRewardHold(spec));
    done();
    return;
  }
  await runResourceTransfers({
    specs: rating.specs,
    source: {},
    origins: rating.specs.map(() => origin),
    arrival: 'auto',
    onArrive: (spec) => releasePanelRewardHold(spec),
  });
  // The table's answer — one beat after its reason's touchdown, never with it.
  if (rating.reactions.length > 0) {
    await new Promise<void>((resolve) => {
      scheduleParliamentBeat(TOUCHDOWN_TICK_GAP_MS, () => {
        rating.reactions.forEach((spec) => releasePanelRewardHold(spec));
        resolve();
      });
    });
  }
  done();
}

/** Full reset (game switch, test cleanup). */
export function resetRulingChangeDraw(): void {
  clearNet();
  rulingChangeDrawState.owedKey = undefined;
  rulingChangeDrawState.delivering = false;
  rulingChangeDrawState.presenting = undefined;
  releaseRulingRatings('reset');
}
