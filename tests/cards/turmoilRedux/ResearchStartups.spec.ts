import {expect} from 'chai';
import {CARDS_KEPT, DATA_ON_PLAY, DATA_PER_PATENT_SOLD, RESEARCH_STARTUPS_NO_DATA_REASON, ResearchStartups} from '../../../src/server/cards/turmoilRedux/ResearchStartups';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {SellPatentsStandardProject} from '../../../src/server/cards/base/standardProjects/SellPatentsStandardProject';
import {PATENTS_SOLD_UNIT} from '../../../src/server/cards/base/standardProjects/patentSale';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {patentSaleModel} from '../../../src/server/models/patentSaleModel';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR46 — RESEARCH STARTUPS: the Scientists' plate, a data holder that answers
 * THE PATENT SALE (+1 data here per card sold — the fork hook `onPatentsSold`,
 * its one writer the standard project) and whose action spends ALL its data
 * for as many cards off the deck, keeping one. Every rule reading of the card
 * file's header is pinned here; the sale's rate on the prompt has its own
 * parity spec (`tests/models/patentSaleModel.spec.ts`).
 */
const S = PartyName.SCIENTISTS;
const COST = 8;
const RS = CardName.RESEARCH_STARTUPS;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ResearchStartups};

/** A two-seat Redux table in the action phase, the Scientists RULING (an enacted Scientists' law). */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new ResearchStartups();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

function play(t: Table, payment: Payment = Payment.of({megacredits: COST})): void {
  t.player.playCard(t.card, payment);
  runAllActions(t.game);
}

/** The card on the player's table with `data` on it. */
function onTable(t: Table, data: number): void {
  t.player.cardsInHand = [];
  t.player.playedCards.push(t.card);
  t.card.resourceCount = data;
}

/** Sell `count` cards from a freshly dealt hand of `hand` through the standard project. */
function sell(t: Table, player: TestPlayer, count: number, hand: number = Math.max(count, 1)): ReadonlyArray<IProjectCard> {
  player.cardsInHand = t.game.projectDeck.drawN(t.game, hand);
  const sold = player.cardsInHand.slice(0, count);
  new SellPatentsStandardProject().action(player).cb(sold);
  runAllActions(t.game);
  return sold;
}

/** Shrink the project deck (and empty its discard) to `n` cards. */
function deckOf(t: Table, n: number): void {
  const deck = t.game.projectDeck;
  deck.discardPile.splice(0, deck.discardPile.length);
  deck.drawPile.splice(0, deck.drawPile.length - n);
}

describe('ResearchStartups', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 8, Science + Building, a data holder, the SCIENTISTS\' plate, no VP, TR46 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(RS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.SCIENCE, Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.DATA);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR46');
      expect(card.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Add 3 data resources to this card.');
      expect(card.behavior).deep.eq({addResources: DATA_ON_PLAY});
      expect(DATA_ON_PLAY).eq(3);
      expect(DATA_PER_PATENT_SOLD).eq(1);
      expect(CARDS_KEPT).eq(1);
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[RS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    });

    it('the face reads the scan: [Sell Patents] : [data] / [card]; X [data] → X [card]*; 3 [data]', () => {
      type Node = {is?: string, type?: string, amount?: number, text?: string, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(3);
      const [effect, action] = [rows[0][0], rows[1][0]];
      const parts = (box: Node, i: number) => (box.rows?.[i] ?? []).filter((n): n is Node => typeof n === 'object');
      expect(effect.is).eq('effect');
      expect(parts(effect, 0).map((n) => [n.type, n.text])).deep.eq([[CardRenderItemType.PLATE, 'Sell Patents']]);
      expect(parts(effect, 2).map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.RESOURCE, '/', CardRenderItemType.CARDS]);
      expect(effect.rows?.[2]).deep.include('Effect: When you Sell Patents, add 1 data here per card sold.');
      expect(action.is).eq('effect');
      expect(parts(action, 0).map((n) => n.type)).deep.eq([CardRenderItemType.TEXT, CardRenderItemType.RESOURCE]);
      expect(parts(action, 2).map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.TEXT, CardRenderItemType.CARDS, '*']);
      const onPlay = rows[2] as Array<Node>;
      expect(onPlay.map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.RESOURCE, DATA_ON_PLAY]]);
    });

    it('K-R1 — the holder\'s ACTION role: ALL the data → as many cards, keep 1 — declared once, and it IS what the preview says', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({spend: 'all', good: {kind: 'look', keep: CARDS_KEPT}});
      onTable(t, 4);
      const effects = actionPreview(t.player, t.card).branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost'), 'spend ALL').deep.include({amount: 4, current: 4, resulting: 0});
      expect(effects.find((e) => e.icon === 'cards')?.look, 'one card per unit, keep the declared count').deep.eq({revealed: 4, keep: CARDS_KEPT});
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
    });

    function scientistsCubes(n: number): void {
      let slot = t.parliament.slotOf(S);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(S));
        slot = t.parliament.slotOf(S)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
      }
    }

    it('neither road: «0 of 2» with the NAMED party reason; one cube: still no; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0});
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the Scientists ruling: playable with no delegate anywhere', () => {
      seatEnacted(t.parliament, quietResolutionOf(S));
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — the play: +3 data here, and the table answers', () => {
    it('+3 data on THIS card; the preview is declarative «0 → 3 on this card»', () => {
      const chip = cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.note === 'on this card');
      expect(chip).deep.include({direction: 'gain', icon: 'data', amount: 3, current: 0, resulting: 3});
      play(t);
      expect(t.card.resourceCount).eq(3);
    });

    it('Martian Fiber +3 M€ and TR05 Vector Computations +1 data on itself (Science tag) — forecast and live agree', () => {
      const fiber = new MartianFiber();
      const vector = new VectorComputations();
      t.player.playedCards.push(fiber, vector);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      const fiberMc = facts.filter((f) => f.source.name === CardName.MARTIAN_FIBER)
        .flatMap((f) => f.effects).filter((e) => e.icon === Resource.MEGACREDITS).reduce((s, e) => s + e.amount, 0);
      const before = t.player.megaCredits;
      play(t);
      expect(t.card.resourceCount).eq(3);
      // The Fiber pays per data added to ANY own card — this card's 3 and whatever the Science tag added elsewhere.
      expect(t.player.megaCredits - (before - COST), 'forecast == execution (Fiber)').eq(fiberMc);
      expect(fiberMc).greaterThanOrEqual(3);
    });

    it('rule 2 — the Building tag lets steel pay (2 M€ a unit)', () => {
      expect(t.player.paymentOptionsForCard(t.card).steel).is.true;
      t.player.megaCredits = 4;
      t.player.steel = 2;
      expect(t.player.canPlay(t.card)).is.true;
      play(t, Payment.of({megacredits: 4, steel: 2}));
      expect(t.player.steel).eq(0);
      expect(t.player.playedCards.get(RS)).eq(t.card);
    });
  });

  describe('rule 3 — the effect: +1 data here per card sold, in ONE addition', () => {
    it('1 card sold → +1 data; 4 cards → +4 data', () => {
      onTable(t, 0);
      sell(t, t.player, 1, 3);
      expect(t.card.resourceCount).eq(1);
      sell(t, t.player, 4, 6);
      expect(t.card.resourceCount).eq(5);
    });

    it('ONE `onResourceAdded` of N: Martian Fiber pays N M€ beside the project\'s N', () => {
      onTable(t, 2);
      t.player.playedCards.push(new MartianFiber());
      const before = t.player.megaCredits;
      sell(t, t.player, 4, 6);
      expect(t.card.resourceCount).eq(6);
      expect(t.player.megaCredits - before, '4 (the project) + 4 (the Fiber)').eq(8);
      const adds = t.game.events.events.filter((e) => e.type === 'card-resource-changed' && e.impact.cardResources?.[0].target === RS);
      expect(adds, 'one addition').has.length(1);
      expect(adds[0].impact.cardResources).deep.eq([{cardResource: CardResource.DATA, target: RS, amount: 4, basis: {count: 4, unitKey: PATENTS_SOLD_UNIT}}]);
    });

    it('the sale\'s rate names this card and the Fiber after it, per card — and the sale pays exactly «rate × N»', () => {
      onTable(t, 0);
      t.player.playedCards.push(new MartianFiber());
      t.player.cardsInHand = t.game.projectDeck.drawN(t.game, 5);
      const model = patentSaleModel(t.player, new SellPatentsStandardProject());
      expect(model.megacreditsPerCard).eq(1);
      expect(model.answers?.map((f) => [f.source.name, f.certainty, f.effects.map((e) => [e.icon, e.amount, e.host ?? null])])).deep.eq([
        [RS, 'exact', [['data', 1, RS]]],
        [CardName.MARTIAN_FIBER, 'exact', [[Resource.MEGACREDITS, 1, null]]],
      ]);
      const before = t.player.megaCredits;
      new SellPatentsStandardProject().action(t.player).cb(t.player.cardsInHand.slice(0, 5));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(5);
      expect(t.player.megaCredits - before).eq(10);
    });

    it('a RIVAL\'s sale pays nothing; the card in the HAND answers nothing', () => {
      onTable(t, 1);
      sell(t, t.opponent, 3);
      expect(t.card.resourceCount).eq(1);
      const inHand = new ResearchStartups();
      t.player.cardsInHand = [inHand];
      t.player.playedCards.remove(t.card);
      sell(t, t.player, 2, 2);
      expect(inHand.resourceCount).eq(0);
    });

    it('rule 9 — the sale is an ACTION ROOT: its +N M€, the data and the Fiber\'s answer nest under it, in the event order', () => {
      onTable(t, 0);
      t.player.playedCards.push(new MartianFiber());
      const from = t.game.events.events.length;
      sell(t, t.player, 3, 4);
      const events = t.game.events.events.slice(from);
      const root = events[0];
      expect(root).deep.include({type: 'action', category: 'standard-project'});
      expect(root.source).deep.eq({kind: 'standardProject', card: CardName.SELL_PATENTS_STANDARD_PROJECT});
      expect(events.every((e) => e.correlationId === root.id), 'one chain').is.true;
      expect(events.map((e) => [e.type, e.source?.kind === 'card' ? e.source.card : e.source?.kind])).deep.eq([
        ['action', 'standardProject'],
        ['resource-changed', 'standardProject'],
        ['effect-triggered', RS],
        ['card-resource-changed', RS],
        ['effect-triggered', CardName.MARTIAN_FIBER],
        ['resource-changed', CardName.MARTIAN_FIBER],
      ]);
    });

    it('rule 10 — the RIVAL reads the sale with its answers: the data chip carries «for 3 patents sold»', () => {
      onTable(t, 0);
      t.player.playedCards.push(new MartianFiber());
      sell(t, t.player, 3, 4);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'standardProject')!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.player.color, t.opponent.color);
      const chips = impact.pillGroups.flatMap((g) => g.chips);
      expect(chips.map((c) => c.icon)).to.include.members([Resource.MEGACREDITS, CardResource.DATA]);
      const gain = impact.childVMs.find((vm) => vm.basis !== undefined);
      expect(gain?.basis, 'the reason rides to the rival').deep.include({count: 3, unitKey: PATENTS_SOLD_UNIT});
    });

    it('the effect names THIS card: the effect scope on the `standard-project` channel', () => {
      onTable(t, 0);
      sell(t, t.player, 2, 3);
      const triggers = t.game.events.events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === RS);
      expect(triggers.map((e) => e.trigger)).deep.eq(['standard-project']);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      const sold = lines.findIndex((l) => /sold 2 patents/.test(l));
      const added = lines.findIndex((l) => /added 2 data to Research Startups/i.test(l));
      expect(sold, lines.slice(-6).join('\n')).greaterThan(-1);
      expect(added, 'the cause before its answer').greaterThan(sold);
    });
  });

  describe('rules 5–8 — the action: ALL the data → as many cards → keep 1, discard the rest', () => {
    it('X = 5: the data leave, five cards are offered (keep exactly 1, a KEEP deck pick sourced by this card), four go to the discard', () => {
      onTable(t, 5);
      const hand = t.player.cardsInHand.length;
      const discard = t.game.projectDeck.discardPile.length;
      expect(t.card.canAct(t.player)).is.true;
      t.card.action(t.player);
      expect(t.card.resourceCount, 'the data leave at the press').eq(0);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(pick.cards).has.length(5);
      expect(pick.config).deep.include({min: 1, max: 1});
      const model = pick.toModel(t.player);
      expect(model.deckPickPrompt).deep.include({revealed: 5, min: 1, max: 1, mode: 'keep', origin: 'deck'});
      expect(model.deckPickPrompt?.source).deep.include({card: RS});
      pick.cb([pick.cards[2]]);
      runAllActions(t.game);
      expect(t.player.cardsInHand).has.length(hand + 1);
      expect(t.player.cardsInHand).to.include(pick.cards[2]);
      expect(t.game.projectDeck.discardPile.length - discard).eq(4);
    });

    it('the preview reads the same activation: «5 → 0 data on this card» and «+1 card of 5 turned over»; no pre-collected step', () => {
      onTable(t, 5);
      const branch = actionPreview(t.player, t.card).branches[0];
      expect(branch.available).is.true;
      expect(branch.steps, 'the pick is hidden information — never pre-collected').deep.eq([]);
      expect(branch.effects.find((e) => e.direction === 'cost')).deep.include({icon: 'data', amount: 5, current: 5, resulting: 0, note: 'on this card'});
      expect(branch.effects.find((e) => e.icon === 'cards')).deep.include({direction: 'gain', amount: 1, look: {revealed: 5, keep: 1}});
    });

    it('rule 6 — X = 1: one card, NO choice — it goes to the hand through the draw reveal', () => {
      onTable(t, 1);
      const hand = t.player.cardsInHand.length;
      t.card.action(t.player);
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.cardsInHand).has.length(hand + 1);
      expect(t.card.resourceCount).eq(0);
      const chip = actionPreview(t.player, (t.card.resourceCount = 1, t.card)).branches[0].effects.find((e) => e.icon === 'cards');
      expect(chip).deep.include({amount: 1});
      expect(chip?.look, 'a draw that keeps all is a plain draw').is.undefined;
    });

    it('rule 5 — the deck holds fewer than X (its discard empty): as many as there are, named before the press', () => {
      onTable(t, 5);
      deckOf(t, 3);
      expect(ResearchStartups.activationAt(t.player, 5)).deep.eq({spent: 5, revealed: 3, kept: 1, discarded: 2});
      expect(actionPreview(t.player, t.card).branches[0].effects.find((e) => e.icon === 'cards')?.look).deep.eq({revealed: 3, keep: 1});
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(pick.cards).has.length(3);
      expect(t.card.resourceCount, 'ALL the data leave — the printed rule').eq(0);
    });

    it('rule 5 — the discard is reshuffled when the pile runs out (the engine\'s rule)', () => {
      onTable(t, 4);
      const deck = t.game.projectDeck;
      const moved = deck.drawPile.splice(0, deck.drawPile.length - 2);
      deck.discardPile.push(...moved);
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(pick.cards).has.length(4);
    });

    it('rule 6 — no data: unavailable, «0 of 1 data on this card»; an empty deck AND discard: «The deck is empty»', () => {
      onTable(t, 0);
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'count', message: RESEARCH_STARTUPS_NO_DATA_REASON, params: ['0'], current: 0}]);
      t.card.resourceCount = 2;
      deckOf(t, 0);
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)[0]).deep.include({type: 'rule', message: 'The deck is empty'});
    });

    it('once per generation: used, the card leaves the playable actions', () => {
      onTable(t, 3);
      expect(t.player.getPlayableActionCards().map((c) => c.name)).to.include(RS);
      t.player.actionsThisGeneration.add(RS);
      t.card.resourceCount = 3;
      expect(t.player.getPlayableActionCards().map((c) => c.name)).not.to.include(RS);
    });

    it('rule 9 — the journal: «discarded 5 data from Research Startups to look at 5 card(s)», then the engine\'s draw line', () => {
      onTable(t, 5);
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard<IProjectCard>);
      pick.cb([pick.cards[0]]);
      runAllActions(t.game);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /discarded 5 data from Research Startups to look at 5 card\(s\) from the deck/i.test(l)), lines.slice(-5).join('\n')).is.true;
    });
  });

  describe('rule 11 — MarsBot and save / load', () => {
    it('MarsBot never sells patents: its table answers nothing', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new ResearchStartups();
      human.playedCards.push(card);
      human.cardsInHand = game.projectDeck.drawN(game, 2);
      new SellPatentsStandardProject().action(human).cb(human.cardsInHand.slice(0, 2));
      runAllActions(game);
      expect(card.resourceCount).eq(2);
      expect(bot.isMarsBot).is.true;
    });

    it('the data and the action\'s flag survive a reload as ordinary fields, and the reloaded card still answers the sale', () => {
      onTable(t, 4);
      t.player.actionsThisGeneration.add(RS);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.player.id);
      const again = owner.playedCards.get(RS) as ICard;
      expect(again.resourceCount).eq(4);
      expect(owner.actionsThisGeneration.has(RS)).is.true;
      owner.cardsInHand = reloaded.projectDeck.drawN(reloaded, 2);
      new SellPatentsStandardProject().action(owner).cb(owner.cardsInHand.slice(0, 2));
      runAllActions(reloaded);
      expect(again.resourceCount).eq(6);
    });
  });
});
