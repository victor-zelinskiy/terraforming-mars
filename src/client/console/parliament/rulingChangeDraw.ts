import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {isReduxParty, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {acknowledgeDraw, dismissEvent, drawnCardsState, DrawnCardEntry, markAllTaken, setAcking} from '@/client/components/drawnCards/drawnCardsState';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {rectOf} from './parliamentFlights';
import {allianceImpulsesSettled} from './allianceImpulse';
import {probeTick} from '@/client/console/probeTick';

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
  presenting: undefined as {card: CardName, party: ReduxParty, count: number} | undefined,
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
  if (batches.length === 0) {
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
  } finally {
    rulingChangeDrawState.delivering = false;
    rulingChangeDrawState.presenting = undefined;
  }
}

/** Full reset (game switch, test cleanup). */
export function resetRulingChangeDraw(): void {
  clearNet();
  rulingChangeDrawState.owedKey = undefined;
  rulingChangeDrawState.delivering = false;
  rulingChangeDrawState.presenting = undefined;
}
