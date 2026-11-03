/**
 * THE PAYOUT OF A DISCARD IS ONE WAVE — FOR ANY SOURCE (ledger CS · P68 Ceres Tech Market, 2026-10-30; first written
 * for the Turmoil Redux «один фреймворк», 2026-10-24 — the Reds' «2 M€ per plant, microbe and animal tag discarded»).
 * A discard that BUYS a stock resource (`DiscardPromptMeta.exchange`) pays it as the ACTION COMMIT's own language, never
 * as a number that changed or a result panel computed as `megacredits − mcBefore`: ONE token carrying the exchange's
 * TOTAL, born on the PRINTED icon of the source standing in the hero slot (a party's plaque, a card's action graphic),
 * landing on the rail row, the row ticking ONCE on its touchdown — AFTER the cards have left the hand (the cause before
 * the effect).
 *
 * ONE TOKEN PER EXCHANGE (P50's polish companion · ledger FD — the owner, 2026-11-03: «чип монет при сбросе Красных
 * летит визуально с цифрой 2, даже если платит больше»). The law used to be «one token per paying unit», each wearing
 * the RATE — so three plant / microbe / animal tags flew three «+2» chips while the header read «+6»: the number the
 * player watched fly was never the number they were paid. A discard is ONE exchange («−2 [cards] → +6 M€ · 3 tags × 2»),
 * so its payout is ONE token wearing the total, read by the same rule the header reads (`deriveDiscardIntent`).
 *
 * ONE RATE READER (`discardExchangeSpecs`) for both shapes of an exchange: `perTag` — the rate × every paying printed
 * tag of the thrown cards (the Reds); `perCard` — the rate × the thrown cards (Ceres Tech Market's «2x [M€]»). The
 * amount is the SERVER's (the marker's rate × the pick), never client arithmetic. Two doors, because the discard arrives
 * two ways:
 *   · a LIVE prompt answered in the card composer (a party's action — the discard is asked AFTER the commit): SEEDED in
 *     the transport's apply block against the two views (`seedPoliticalDiscardExchange` — the thrown cards are the
 *     ones that left the hand), FLOWN by that composer once the hand step has left its zone (`flyDiscardExchange`);
 *   · a PRE-COLLECTED step of a card's action (the discard rides the commit's ONE POST): the commit's own reward wave
 *     carries the token (`discardExchangeCommitSpecs` — appended to the wave, one per exchange), so the panel
 *     hold, the birth on the printed icon and the tick on each touchdown are the wave's; the cards' leaving is the
 *     shared discard scene armed at the same press (the transport holds the view until they have landed on the pile,
 *     and the wave flies after the view — the order is the architecture's).
 * A patent sale keeps its own scene (`consolePatentSale.ts` — a candidate of this class, the owner's decision apart).
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {DiscardPromptMeta} from '@/common/models/PlayerInputModel';
import {RailReward, railRewardPending, releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {consoleCardActionsUi, partyTileKey} from '@/client/console/consoleCardActions';

/** The rail key of a political source's discard payout. */
export function discardExchangeRailKey(sourceKey: string): string {
  return `discard-exchange:${sourceKey}`;
}

/**
 * The token of a discard's payout (pure): ONE spec carrying the TOTAL — `perTag`: the rate × every paying printed tag of
 * the thrown cards (an event's printed tags count — the Reds' rule; a card with two paying tags pays twice; a card with
 * none pays nothing); `perCard`: the rate × the thrown cards. Zero paid → no token (the server names the skip). Only a
 * STOCK payout is a wave: an exchange in cards (Mars University, Ender) or one with a second payout in cards (Open IP
 * Trade's draw — the deck's own scene) is not read here.
 */
export function discardExchangeSpecs(
  thrown: ReadonlyArray<CardName>,
  exchange: {icon: string, amount: number, perTag?: ReadonlyArray<Tag>, perCard?: boolean, draw?: number},
  tagsOf: (card: CardName) => ReadonlyArray<Tag> = (card) => getCard(card)?.tags ?? [],
): Array<ResourceTransferSpec> {
  if (exchange.amount <= 0 || exchange.icon === 'cards' || exchange.draw !== undefined) {
    return [];
  }
  let units = 0;
  if (exchange.perTag !== undefined) {
    const perTag = exchange.perTag;
    units = thrown.reduce((sum, card) => sum + tagsOf(card).filter((tag) => perTag.includes(tag)).length, 0);
  } else if (exchange.perCard === true) {
    units = thrown.length;
  }
  return units > 0 ? [{channel: 'stock', resource: exchange.icon, amount: units * exchange.amount}] : [];
}

/**
 * THE PRE-COLLECTED DOOR — a card ACTION whose discard is a step the composer answered before the press (P68): the
 * token of every answered discard step of the pressed branch, one per exchange carrying its total (`discardExchangeSpecs`
 * — the marker's own rate), for the commit's reward wave. Read off the step's SERVER marker (`discardPrompt`), never a title.
 */
export function discardExchangeCommitSpecs(
  branch: ActionPreviewBranch | undefined,
  stepResponses: Readonly<Record<number, unknown>>,
  tagsOf?: (card: CardName) => ReadonlyArray<Tag>,
): Array<ResourceTransferSpec> {
  return (branch?.steps ?? []).flatMap((step, i) => {
    const marker = step.kind === 'input' && step.input.type === 'card' ? (step.input as {discardPrompt?: DiscardPromptMeta}).discardPrompt : undefined;
    const answer = stepResponses[i] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
    if (marker?.exchange === undefined || answer?.type !== 'card') {
      return [];
    }
    return discardExchangeSpecs(answer.cards ?? [], marker.exchange, tagsOf);
  });
}

/** The transport's apply block: a party discard answered in the card composer holds its payout on the rail. */
export function seedPoliticalDiscardExchange(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const prompt = before?.waitingFor;
  const marker = prompt?.partyActionPrompt;
  const exchange = prompt?.type === 'card' ? prompt.discardPrompt?.exchange : undefined;
  if (before === undefined || after === undefined || marker === undefined || marker.stage !== 'discard' || exchange === undefined) {
    return;
  }
  // Still asked (a refusal, a re-ask): nothing was paid.
  if (after.waitingFor?.partyActionPrompt?.stage === 'discard') {
    return;
  }
  const sourceKey = partyTileKey(marker.party);
  if (consoleCardActionsUi.draft?.cardName !== sourceKey) {
    return;
  }
  const kept = new Set(after.cardsInHand.map((c) => c.name));
  const thrown = before.cardsInHand.map((c) => c.name).filter((name) => !kept.has(name));
  const cause = discardExchangeSpecs(thrown, exchange);
  if (cause.length === 0) {
    return;
  }
  const reward: RailReward = {cause, reactions: [], known: {}};
  seedRailReward(discardExchangeRailKey(sourceKey), reward, before, after);
}

/** A payout of this source is held and owed its flight. */
export function discardExchangeOwed(sourceKey: string): boolean {
  return railRewardPending(discardExchangeRailKey(sourceKey));
}

/**
 * THE OWNER LEAVES — a payout nobody will fly any more (the card composer that committed the party's action is closing
 * for good, or the shell's stall net is tearing its workspace down) is released: the rows tick now, honestly late.
 * The seed holds a BLOCKING rail entry, and the composer is its ONE flyer — left standing, an unflown seed froze the
 * next prompt, the feed and the bot until the registry's 35 s ceiling (field 2026-10-24 / 25: «"rail-reward" held for
 * over 35000ms … discard-exchange:PARTY_Reds … phase "held"»). Idempotent; a key with no entry is a no-op.
 */
export function releaseDiscardExchange(sourceKey: string | undefined, why: string): void {
  if (sourceKey !== undefined && sourceKey !== '' && railRewardPending(discardExchangeRailKey(sourceKey))) {
    releaseRailReward(discardExchangeRailKey(sourceKey), why);
  }
}
