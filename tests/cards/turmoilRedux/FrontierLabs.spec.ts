import {expect} from 'chai';
import {
  FRONTIER_LABS_NO_DRAW_NOTE, FRONTIER_LABS_NO_HOLDER_REASON, FRONTIER_LABS_PRICE, FrontierLabs,
} from '../../../src/server/cards/turmoilRedux/FrontierLabs';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Pets} from '../../../src/server/cards/base/Pets';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {ICard} from '../../../src/server/cards/ICard';
import {NO_RESOURCE_YET_REASON} from '../../../src/server/deferredActions/AddResourcesToCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';

/**
 * TR53 — FRONTIER LABS: the Scientists' plate; an action that PAYS 5 M€ to add a
 * resource to a card that ALREADY holds one, and draws a card unless the
 * resource is science. Every rule reading of the card file's header is pinned
 * here; the shared class (`AddResourcesToCard.extraByCard` / `nearMisses`) has
 * its own spec beside the step.
 */
const S = PartyName.SCIENTISTS;
const FL = CardName.FRONTIER_LABS;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: FrontierLabs};

/** A two-seat Redux table in the action phase, the Scientists RULING, the card in hand, 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new FrontierLabs();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

/** The card on the player's table. */
function onTable(t: Table): void {
  t.player.cardsInHand = [];
  t.player.playedCards.push(t.card);
}

function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

/** Activate through the REAL blue-action door; returns the first prompt after the price (the target pick). */
function activate(t: Table): SelectCard<ICard> {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name), 'the card stands among the playable actions').to.include(FL);
  door.cb([t.card]);
  runAllActions(t.game);
  return cast(t.player.getWaitingFor(), SelectCard<ICard>);
}

describe('FrontierLabs', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 8, Science + Building, the SCIENTISTS\' plate, no resource, no VP, TR53 — Redux, no compatibility', () => {
      const card = t.card;
      expect(card.name).eq(FL);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(8);
      expect(card.tags, 'atom, then the brown disc').deep.eq([Tag.SCIENCE, Tag.BUILDING]);
      expect(card.resourceType, 'the card holds nothing of its own').is.undefined;
      expect(card.victoryPoints).is.undefined;
      expect(requiredPartyOf(card)).eq(S);
      expect(card.requirements).has.length(1);
      expect(card.behavior, 'nothing happens on play').is.undefined;
      expect(card.metadata.cardNumber).eq('TR53');
      expect(card.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[FL];
      expect(entry).is.not.undefined;
      expect(entry.compatibility).is.undefined;
    });

    it('the face reads the scan: [5] → [a card with resources] : + [?] [a card]*', () => {
      type Node = {is?: string, type?: string, amount?: number, questionMark?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(1);
      const action = rows[0][0];
      const parts = (box: Node, i: number) => (box.rows?.[i] ?? []).filter((n): n is Node => typeof n === 'object');
      expect(action.is).eq('effect');
      expect(parts(action, 0).map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.MEGACREDITS, FRONTIER_LABS_PRICE]]);
      const result = parts(action, 2);
      expect(result.map((n) => n.type)).deep.eq([
        CardRenderItemType.RESOURCE_CARD, ':', '+', CardRenderItemType.RESOURCE, CardRenderItemType.NBSP, CardRenderItemType.CARDS, '*',
      ]);
      expect(result[3].questionMark, 'the «?» — the kind the choice decides').is.true;
      expect(action.rows?.[2]).deep.include(
        'Action: Pay 5 M€ to add a resource to a card that already has a resource. If it is not a science resource, also draw a card.');
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
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

    it('neither road: «0 of 2» named; one cube: no; two: playable; TR36 does not lower a requirement', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0});
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(1);
      expect(t.player.canPlay(t.card), 'Council Seat eases an EFFECT, never this plate').is.false;
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — the play does nothing itself; its tags wake the table', () => {
    it('played for 8: no resource, no production; Olympus Conference answers the Science tag', () => {
      const olympus = holder(t.player, new OlympusConference(), 0);
      t.player.playCard(t.card, Payment.of({megacredits: 8}));
      runAllActions(t.game);
      expect(t.player.playedCards.get(FL)).eq(t.card);
      expect(olympus.resourceCount, 'the Science tag woke Olympus (+1 science)').eq(1);
    });
  });

  describe('rule 3 — the action: 5 M€ first; ONE reason, in order', () => {
    it('no card holds a resource yet → that reason first (even with 0 M€)', () => {
      onTable(t);
      holder(t.player, new Tardigrades(), 0);
      t.player.megaCredits = 0;
      expect(t.card.canAct(t.player)).is.false;
      expect(t.card.actionUnavailableReason(t.player)).deep.include({type: 'target', message: FRONTIER_LABS_NO_HOLDER_REASON});
    });

    it('a holder with a resource but less than 5 M€ → the M€ reason', () => {
      onTable(t);
      holder(t.player, new Tardigrades(), 1);
      t.player.megaCredits = 4;
      expect(t.card.canAct(t.player)).is.false;
      expect(t.card.actionUnavailableReason(t.player)).deep.include({type: 'megacredits'});
      t.player.megaCredits = 5;
      expect(t.card.canAct(t.player)).is.true;
    });

    it('the price is paid FIRST and without a question when only M€ can pay', () => {
      onTable(t);
      holder(t.player, new Tardigrades(), 1);
      const pick = activate(t);
      expect(t.player.megaCredits, '20 − 5, already off the rail when the target is asked').eq(15);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
    });
  });

  describe('rule 4 — the target: an OWN card that already holds a resource; one is still a pick; a 0 holder is shown disabled', () => {
    it('candidates of ANY kind with ≥ 1; a rival\'s never; the 0 holder rides `disabledCards` with its reason; this card is no candidate', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      const census = holder(t.player, new MartianCensus(), 2);
      holder(t.player, new Pets(), 0);
      holder(t.opponent, new Tardigrades(), 3);
      const pick = activate(t);
      expect(pick.cards.map((c) => c.name)).to.have.members([tardigrades.name, census.name]);
      expect(pick.cards).has.length(2);
      const model = pick.toModel(t.player);
      expect(model.disabledCards?.map((c) => c.name)).deep.eq([CardName.PETS]);
      expect(model.disabledCards?.[0].disabledReason).eq(NO_RESOURCE_YET_REASON);
      expect(model.cards.map((c) => c.name)).not.to.include(FL);
    });

    it('ONE candidate is still a pick of one (never automatic); +1 of THAT card\'s kind', () => {
      onTable(t);
      const census = holder(t.player, new MartianCensus(), 1);
      const pick = activate(t);
      expect(pick.cards.map((c) => c.name)).deep.eq([census.name]);
      t.player.process({type: 'card', cards: [census.name]});
      runAllActions(t.game);
      expect(census.resourceCount).eq(2);
    });
  });

  describe('rule 5 — the draw: not science → +1 card; science → none; an empty deck is skipped by name', () => {
    it('a microbe holder: +1 microbe AND +1 card', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      const hand = t.player.cardsInHand.length;
      activate(t);
      t.player.process({type: 'card', cards: [tardigrades.name]});
      runAllActions(t.game);
      expect(tardigrades.resourceCount).eq(2);
      expect(t.player.cardsInHand.length).eq(hand + 1);
    });

    it('a science holder: +1 science, NO card', () => {
      onTable(t);
      const olympus = holder(t.player, new OlympusConference(), 1);
      const hand = t.player.cardsInHand.length;
      activate(t);
      t.player.process({type: 'card', cards: [olympus.name]});
      runAllActions(t.game);
      expect(olympus.resourceCount).eq(2);
      expect(t.player.cardsInHand.length).eq(hand);
    });

    it('a WARE holder is not science: it draws', () => {
      expect(FrontierLabs.drawsFor(fakeCard({resourceType: CardResource.WARE}))).is.true;
      expect(FrontierLabs.drawsFor(fakeCard({resourceType: CardResource.SCIENCE}))).is.false;
    });

    it('an empty deck: the addition stands, the draw is skipped BY NAME', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      activate(t);
      t.game.projectDeck.drawPile.length = 0;
      t.game.projectDeck.discardPile.length = 0;
      t.player.process({type: 'card', cards: [tardigrades.name]});
      runAllActions(t.game);
      expect(tardigrades.resourceCount).eq(2);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
      expect(skipped).deep.include({label: 'Draw cards', reason: 'The deck is empty', effect: {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}});
    });
  });

  describe('rule 6 / 13 — every candidate says what it gives (the server\'s chips, `extraByCard`)', () => {
    it('a non-science candidate wears «+1 card»; a science one the named «no draw»', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      const olympus = holder(t.player, new OlympusConference(), 1);
      const meta = activate(t).toModel(t.player).resourceGainPrompt;
      expect(meta?.extraByCard?.[tardigrades.name]).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]);
      expect(meta?.extraByCard?.[olympus.name]).deep.eq([{direction: 'gain', icon: 'cards', amount: 0, note: FRONTIER_LABS_NO_DRAW_NOTE}]);
      expect(meta?.cardResourceByCard).deep.eq({[tardigrades.name]: 'microbe', [olympus.name]: 'science'});
    });
  });

  describe('rule 7 — preview = execution', () => {
    it('the price chip, the «+1 to a card» chip, the target step = the live picker, addressed; the batch replays whole', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      holder(t.player, new Pets(), 0);
      const branch = actionPreview(t.player, t.card).branches[0];
      expect(branch.effects).to.deep.include({direction: 'cost', icon: 'megacredits', amount: 5, current: 20, resulting: 15});
      expect(branch.effects).to.deep.include({direction: 'gain', icon: 'resources', amount: 1, note: 'to a card'});
      const step = branch.steps.find((s) => s.kind === 'input');
      if (step === undefined || step.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      expect(step.for, 'the pre-collected answer is ADDRESSED').is.not.undefined;
      const model = step.input as SelectCardModel;
      expect(model.cards.map((c) => c.name)).deep.eq([tardigrades.name]);
      expect(model.disabledCards?.map((c) => c.name)).deep.eq([CardName.PETS]);
      expect(model.resourceGainPrompt?.extraByCard?.[tardigrades.name]?.[0]?.icon).eq('cards');

      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      const hand = t.player.cardsInHand.length;
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [FL]}},
        {type: 'card', cards: [tardigrades.name], ...(step.for === undefined ? {} : {for: step.for})} as InputResponse,
      ];
      replayBatch(t.player, batch);
      runAllActions(t.game);
      expect(tardigrades.resourceCount).eq(2);
      expect(t.player.megaCredits).eq(15);
      expect(t.player.cardsInHand.length, 'the draw is no prompt').eq(hand + 1);
      const wf = t.player.getWaitingFor();
      expect(wf === undefined || wf instanceof OrOptions, 'nothing asked twice').is.true;
    });
  });

  describe('rule 8 — the table answers the ADDITION (Martian Fiber), never the draw', () => {
    it('a data holder chosen: Martian Fiber +1 M€', () => {
      onTable(t);
      const census = holder(t.player, new MartianCensus(), 1);
      holder(t.player, new MartianFiber(), 0);
      activate(t);
      t.player.process({type: 'card', cards: [census.name]});
      runAllActions(t.game);
      expect(t.player.megaCredits, '20 − 5 + 1 (Fiber)').eq(16);
    });
  });

  describe('rules 9, 11, 12', () => {
    it('the journal names the price, the addition and the draw', () => {
      onTable(t);
      const tardigrades = holder(t.player, new Tardigrades(), 1);
      activate(t);
      t.player.process({type: 'card', cards: [tardigrades.name]});
      runAllActions(t.game);
      const messages = t.game.gameLog.map((m) => m.message);
      expect(messages.some((m) => m.includes('added') || m.includes('${1} ${2} to ${3}'))).is.true;
      expect(messages.some((m) => m.includes('drew'))).is.true;
    });

    it('MarsBot\'s cards are never targets (a bot game: the player\'s own holders only)', () => {
      const [game, player, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(S));
      const card = new FrontierLabs();
      player.playedCards.push(card);
      player.megaCredits = 20;
      const mine = holder(player, new Tardigrades(), 1);
      if (bot !== undefined) {
        bot.playedCards.push(Object.assign(new Tardigrades(), {resourceCount: 2}));
      }
      expect(card.target(player).getCards().map((c) => c.name)).deep.eq([mine.name]);
    });

    it('save / load: an ordinary card', () => {
      onTable(t);
      const serialized = t.game.serialize();
      expect(serialized.players[0].playedCards.map((c) => c.name)).to.include(FL);
    });
  });
});
