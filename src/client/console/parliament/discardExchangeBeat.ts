/**
 * THE PAYOUT OF A PARTY ACTION'S DISCARD IS A WAVE, NOT A PANEL (Turmoil Redux «один фреймворк», 2026-10-24 — the
 * Reds' «2 M€ per plant, microbe and animal tag discarded»). The party composer stated it in a result panel computed
 * as `megacredits − mcBefore`; in the card composer it is the ACTION COMMIT's own language: one token per paying TAG,
 * born on the PRINTED «2 M€» icon of the party's plaque standing in the hero slot, landing on the M€ row, the row
 * ticking on each touchdown.
 *
 * The amount is the SERVER's: the discard prompt's own rate (`discardPrompt.exchange` — `amount` per tag of `perTag`)
 * times the printed tags of the cards that LEFT the hand in this very response — the patent sale's law («the rate ×
 * the pick, nothing else»), and the two views must keep that promise (`verifyRailReward`): a response that paid
 * otherwise holds nothing and names itself, the row ticks with the commit. SEEDED in the transport's apply block
 * (the viewer's own discard is a submit), only while the card composer that committed the party's action stands;
 * FLOWN by that composer once the hand step has left its zone (`flyDiscardExchange`).
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {RailReward, railRewardPending, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {consoleCardActionsUi, partyTileKey} from '@/client/console/consoleCardActions';

/** The rail key of a political source's discard payout. */
export function discardExchangeRailKey(sourceKey: string): string {
  return `discard-exchange:${sourceKey}`;
}

/**
 * The tokens of a discard's payout — one per paying printed tag, each the rate's amount (pure). An event's printed
 * tags count (the Reds' rule); a card with none of the tags pays nothing.
 */
export function discardExchangeSpecs(
  thrown: ReadonlyArray<CardName>,
  exchange: {icon: string, amount: number, perTag?: ReadonlyArray<Tag>},
  tagsOf: (card: CardName) => ReadonlyArray<Tag> = (card) => getCard(card)?.tags ?? [],
): Array<ResourceTransferSpec> {
  if (exchange.perTag === undefined || exchange.amount <= 0) {
    return [];
  }
  const perTag = exchange.perTag;
  const specs: Array<ResourceTransferSpec> = [];
  for (const card of thrown) {
    for (const tag of tagsOf(card)) {
      if (perTag.includes(tag)) {
        specs.push({channel: 'stock', resource: exchange.icon, amount: exchange.amount});
      }
    }
  }
  return specs;
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
