import {expect} from 'chai';
import {
  DATA_REMOVED, NO_DATA_SOURCE_REASON, SCIENCE_CARDS_DRAWN, ScientificBreakthrough,
} from '../../../src/server/cards/turmoilRedux/ScientificBreakthrough';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {MarsUniversity} from '../../../src/server/cards/base/MarsUniversity';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {newProjectCard} from '../../../src/server/createCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {playPreviewWithTableQuestions, HIDDEN_DRAW_NOTE} from '../../../src/server/models/tableQuestions';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';

/**
 * TR52 — SCIENTIFIC BREAKTHROUGH: the Scientists' plate over a MANDATORY attack
 * on a card of ANY player — two data off ONE card — that buys a search of the
 * project deck for two Science cards (TR32's class). Every rule reading of the
 * card file's header is pinned here on the real card: the plate's two roads, the
 * floor of two on ONE card (`requireFullCount`), the refusal, the target never
 * applied silently, the order (the removal, THEN the search), the search's
 * sequence / exhaustion / reshuffle, the table's questions, the attack's journal,
 * the batch landing whole, MarsBot and save / load.
 */
const S = PartyName.SCIENTISTS;
const COST = 6;
const ID = CardName.SCIENTIFIC_BREAKTHROUGH;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ScientificBreakthrough};

/** A two-seat Redux table in the action phase, the Scientists RULING by an enacted card, the card in hand. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new ScientificBreakthrough();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

function holder<T extends ICard>(owner: IPlayer, card: T, count: number): T {
  card.resourceCount = count;
  owner.playedCards.push(card as unknown as IProjectCard);
  return card;
}

function card(name: CardName): IProjectCard {
  return newProjectCard(name)!;
}

/** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail). */
function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
  game.projectDeck.drawPile.length = 0;
  game.projectDeck.discardPile.length = 0;
  game.projectDeck.drawPile.push(...spare.map(card), ...[...topFirst].reverse().map(card));
}

/** The prompt's journey: Algae ✗ → Comet ✗ → Fish ✗ → Research ✓ → Physics Complex ✓. */
const JOURNEY = [CardName.ALGAE, CardName.COMET, CardName.FISH, CardName.RESEARCH, CardName.PHYSICS_COMPLEX];

function play(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

/** The action menu's «Play project card» branch — the batch's head, as the composer wraps it. */
function playHead(t: Table): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  expect(index).is.greaterThan(-1);
  return {type: 'or', index, response: {type: 'projectCard', card: ID, payment: Payment.of({megacredits: COST})}};
}

function expectActionMenu(t: Table): void {
  const wf = cast(t.player.getWaitingFor(), OrOptions);
  expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'the next action menu, not a prompt of the card').is.true;
}

describe('ScientificBreakthrough', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a red EVENT for 6, Science, no VP, the SCIENTISTS\' plate, TR52 — in the Redux manifest without compatibility', () => {
      const c = t.card;
      expect(c.name).eq(ID);
      expect(c.type).eq(CardType.EVENT);
      expect(c.cost).eq(COST);
      expect(c.tags, 'the event\'s own tag follows from its type').deep.eq([Tag.SCIENCE]);
      expect(c.victoryPoints, 'no VP badge').is.undefined;
      expect(c.resourceType).is.undefined;
      expect(requiredPartyOf(c), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(c.metadata.cardNumber).eq('TR52');
      expect(c.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Remove 2 data resources from ANY player\'s card (this is mandatory) to draw 2 Science cards. (Discard cards from the deck until you find them.)');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility).is.undefined;
      expect([DATA_REMOVED, SCIENCE_CARDS_DRAWN]).deep.eq([2, 2]);
    });

    it('the face reads the scan: «− [data][data]* [card·science][card·science]» — TWO data squares in the «any player» border, never «2×»', () => {
      type Node = {is?: string, type?: string, amount?: number, showDigit?: boolean, anyPlayer?: boolean, secondaryTag?: unknown, resource?: string};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      // minus · the data · asterisk · the space before the cards · the cards.
      expect(items.map((n) => n.is)).deep.eq(['symbol', 'item', 'symbol', 'symbol', 'item']);
      const data = items[1];
      expect([data.type, data.amount, data.showDigit, data.anyPlayer, data.resource]).deep.eq([CardRenderItemType.RESOURCE, 2, undefined, true, CardResource.DATA]);
      const cards = items[4];
      expect([cards.type, cards.amount, cards.secondaryTag]).deep.eq([CardRenderItemType.CARDS, 2, Tag.SCIENCE]);
    });

    it('the structured text: the requirement line, the removal, the search', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(blocks).deep.eq([
        'Requires Scientists to be ruling or that you have 2 delegates on its resolution.',
        'Remove 2 data from a card of ANY player (mandatory).',
        'Reveal cards from the project deck until you reveal 2 cards with a science tag. Take them into your hand and discard the rest.',
      ]);
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    function redsRule(): void {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
    }
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

    it('the Scientists ruling: playable (a source of two data at the table)', () => {
      holder(t.opponent, new MartianCensus(), 3);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2»; two cubes: playable; TR36 never lowers a REQUIREMENT', () => {
      holder(t.opponent, new MartianCensus(), 3);
      redsRule();
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, party: S, current: 0});
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(1);
      expect(t.player.canPlay(t.card), 'one cube with Council Seat — still «1 of 2»').is.false;
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — the removal is MANDATORY: no source of two data → unplayable, and it says why', () => {
    it('no data anywhere: the card is refused with its reason', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.eq([{type: 'target', message: NO_DATA_SOURCE_REASON}]);
    });

    it('a holder with ONE data is not a source («2 data from a card», never 1 + 1 across two cards)', () => {
      holder(t.player, new Supercomputer(), 1);
      holder(t.opponent, new MartianCensus(), 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({message: NO_DATA_SOURCE_REASON});
    });

    it('solo: the neutral opponent always has them (the class\'s solo rule) — playable, nothing asked, the search runs', () => {
      const [game, solo] = testGame(1, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(S));
      const c = new ScientificBreakthrough();
      // The solo table opens on its own question (which colony tile leaves) — answered away first.
      runAllActions(game);
      solo.popWaitingFor();
      solo.cardsInHand.push(c);
      solo.megaCredits = 20;
      stack(game, JOURNEY);
      expect(solo.canPlay(c)).is.true;
      solo.playCard(c, Payment.of({megacredits: COST}));
      runAllActions(game);
      expect(solo.cardsInHand.map((x) => x.name)).deep.eq([CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
    });
  });

  describe('rules 3–4 — the target: ONE card of ANY player holding ≥ 2, shown even alone, never applied silently', () => {
    it('own 2, rival 3: both candidates; rival 1 and own 0 are DISABLED with their own reasons', () => {
      const own = holder(t.player, new MartianCensus(), 2);
      const rival = holder(t.opponent, new Supercomputer(), 3);
      holder(t.opponent, new VectorComputations(), 1);
      holder(t.player, new MartianFiber(), 0);
      play(t);
      const pick = cast(t.player.getWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.MARTIAN_CENSUS, CardName.SUPERCOMPUTER]);
      expect(pick.config.showOwner, 'the picker names whose card it is').is.true;
      // The own table first, then the rival's — a rival's TR05 answers ITS owner's Science tags, never this play's.
      expect(pick.config.disabled?.map((d) => [d.card.name, d.reason])).deep.eq([
        [CardName.MARTIAN_FIBER, 'No resources on this card'],
        [CardName.VECTOR_COMPUTATIONS, 'Not enough resources on this card'],
      ]);
      expect(own.resourceCount + rival.resourceCount, 'nothing leaves before the answer').eq(5);
      pick.process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      runAllActions(t.game);
      expect(rival.resourceCount).eq(1);
      expect(own.resourceCount).eq(2);
    });

    it('a rival\'s holder with ONE data reads «Not enough resources on this card» — shown, not hidden', () => {
      holder(t.player, new MartianCensus(), 2);
      holder(t.opponent, new Supercomputer(), 1);
      play(t);
      const pick = cast(t.player.getWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.MARTIAN_CENSUS]);
      expect(pick.config.disabled?.map((d) => [d.card.name, d.reason])).deep.eq([[CardName.SUPERCOMPUTER, 'Not enough resources on this card']]);
    });

    it('ONE candidate is still a question (the fork\'s invariant 3) — and the preview pre-collects it with −2 per candidate', () => {
      const census = holder(t.opponent, new MartianCensus(), 3);
      const preview = cardPlayPreview(t.player, t.card);
      const branch = preview.branches[0];
      expect(branch.effects.map((e) => [e.direction, e.icon, e.amount, e.note])).deep.eq([
        ['cost', 'data', 2, undefined],
        ['gain', 'cards', 2, 'draw'],
      ]);
      expect(branch.effects[1].search, 'the chip names the search — the descriptor its reveal will carry').deep.eq({count: 2, tag: Tag.SCIENCE});
      expect(branch.steps).has.length(1);
      const step = branch.steps[0];
      expect(step.kind === 'input' && step.amount).eq(-2);
      expect(step.kind === 'input' && step.cardResource).eq('data');
      expect(step.kind === 'input' && step.input.type === 'card' && step.input.cards.map((c) => c.name)).deep.eq([CardName.MARTIAN_CENSUS]);
      play(t);
      expect(cast(t.player.getWaitingFor(), SelectCard).cards.map((c) => c.name), 'asked, never applied').deep.eq([CardName.MARTIAN_CENSUS]);
      expect(census.resourceCount).eq(3);
    });
  });

  describe('rule 5 — ORDER: the removal, then the search; the deck\'s own rules', () => {
    it('nothing is drawn before the answer; then Algae ✗ → Comet ✗ → Fish ✗ → Research ✓ → Physics Complex ✓', () => {
      const census = holder(t.opponent, new MartianCensus(), 3);
      stack(t.game, JOURNEY);
      const deckBefore = t.game.projectDeck.drawPile.length;
      play(t);
      expect(t.game.projectDeck.drawPile.length, 'the deck is untouched while the target is asked').eq(deckBefore);
      expect(t.player.cardsInHand).has.length(0);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      expect(census.resourceCount).eq(1);
      expect(t.player.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.COMET, CardName.FISH]);
      const reveal = t.player.cardDrawReveals[0];
      expect(reveal.source).deep.eq({type: 'card', cardName: ID});
      expect(reveal.search).deep.eq({count: 2, tag: Tag.SCIENCE});
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched])).deep.eq([
        [CardName.ALGAE, false], [CardName.COMET, false], [CardName.FISH, false], [CardName.RESEARCH, true], [CardName.PHYSICS_COMPLEX, true],
      ]);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(ID), 'the event lies in the events pile').eq(t.card);
    });

    it('two Science cards on top: the plain language — no sequence, the rule still named', () => {
      holder(t.opponent, new MartianCensus(), 3);
      stack(t.game, [CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      const reveal = t.player.cardDrawReveals[0];
      expect(reveal.sequence, 'nothing was thrown away').is.undefined;
      expect(reveal.search).deep.eq({count: 2, tag: Tag.SCIENCE});
    });

    it('exhaustion: ONE Science card left in the whole deck — the player keeps it, the reveal names the end', () => {
      holder(t.opponent, new MartianCensus(), 3);
      stack(t.game, [CardName.ALGAE, CardName.RESEARCH, CardName.COMET], []);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      expect(t.player.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH]);
      expect(t.player.cardDrawReveals[0].exhausted).is.true;
    });

    it('a draw pile emptied mid-search reshuffles the discard pile (the engine\'s rule) — the second Science card is found there', () => {
      holder(t.opponent, new MartianCensus(), 3);
      // ONE card left on the pile: the reshuffle is the only road to the second (a thrown-away card in the discard would
      // make the engine's own stop rule depend on the shuffle — upstream's rule, not this card's).
      stack(t.game, [CardName.RESEARCH], []);
      t.game.projectDeck.discardPile.push(card(CardName.PHYSICS_COMPLEX));
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      expect(t.player.cardsInHand.map((c) => c.name).sort()).deep.eq([CardName.PHYSICS_COMPLEX, CardName.RESEARCH].sort());
    });
  });

  describe('rule 6 — the Science tag wakes the table', () => {
    it('TR05 answers the tag (+2 data) before the removal is asked — and is then a candidate itself', () => {
      const vector = holder(t.player, new VectorComputations(), 0);
      holder(t.opponent, new MartianCensus(), 3);
      play(t);
      expect(vector.resourceCount).eq(2);
      expect(cast(t.player.getWaitingFor(), SelectCard).cards.map((c) => c.name)).deep.eq([CardName.VECTOR_COMPUTATIONS, CardName.MARTIAN_CENSUS]);
    });

    it('Olympus Conference with a science ASKS before the card; Mars University\'s discard stands behind the draw — an honest follow-up', () => {
      holder(t.player, new OlympusConference(), 1);
      t.player.playedCards.push(new MarsUniversity());
      t.player.cardsInHand.push(card(CardName.ALGAE));
      holder(t.opponent, new MartianCensus(), 3);
      const composed = playPreviewWithTableQuestions(t.player, t.card);
      const facts = composed.forecast?.facts ?? [];
      const mu = facts.find((f) => f.source.name === CardName.MARS_UNIVERSITY);
      expect(mu?.note, 'the card the player might discard does not exist yet').eq(HIDDEN_DRAW_NOTE);
      expect(mu?.preselect).is.undefined;
      const olympus = facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE);
      expect(olympus?.preselect, 'Olympus is a pre-step of the play').is.not.undefined;
      play(t);
      const first = cast(t.player.getWaitingFor(), OrOptions);
      expect(first.options.map((o) => o.title)).deep.eq(['Remove a science resource from this card to draw a card', 'Add a science resource to this card']);
    });
  });

  describe('rule 7 — the attack: the victim loses the two, the journal names the card, nothing answers', () => {
    it('«blue removed 2 resource(s) from red\'s Martian Census»; Martian Fiber stays silent', () => {
      const census = holder(t.opponent, new MartianCensus(), 3);
      holder(t.opponent, new MartianFiber(), 0);
      stack(t.game, JOURNEY);
      const redMoney = t.opponent.megaCredits;
      t.game.gameLog.length = 0;
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      expect(census.resourceCount).eq(1);
      expect(t.opponent.megaCredits, 'taking data is not an addition — Fiber answers nothing').eq(redMoney);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      const removal = lines.findIndex((l) => l === `${t.player.color} removed 2 resource(s) from ${t.opponent.color}'s ${CardName.MARTIAN_CENSUS}`);
      expect(removal, lines.join('\n')).gte(0);
      const discard = lines.findIndex((l) => l === 'Discarded 3 cards Algae,Comet,Fish');
      expect(discard, 'rule 8 — the search after the removal').gt(removal);
      const delta = t.game.events.events.find((e) => e.type === 'card-resource-changed' && e.player === t.opponent.color);
      expect(delta, 'the victim\'s card-resource event exists').is.not.undefined;
    });
  });

  describe('the BATCH lands whole through `replayBatch`', () => {
    it('[play, {card: Martian Census}] — the pre-selected target lands, nothing is asked, nothing parks', () => {
      const census = holder(t.opponent, new MartianCensus(), 3);
      stack(t.game, JOURNEY);
      replayBatch(t.player, [playHead(t), {type: 'card', cards: [CardName.MARTIAN_CENSUS]}]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(census.resourceCount).eq(1);
      expect(t.player.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
    });
  });

  describe('rule 9 — MarsBot, save / load', () => {
    it('MarsBot is a target while its attackable stock covers the two — its supply pays, and the search runs', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(S));
      const c = new ScientificBreakthrough();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      bot.megaCredits = 5;
      stack(game, JOURNEY);
      expect(human.canPlay(c), 'the bot\'s supply stands in for its data').is.true;
      human.playCard(c, Payment.of({megacredits: COST}));
      runAllActions(game);
      const or = cast(human.getWaitingFor(), OrOptions);
      expect(or.options).has.length(1);
      or.process({type: 'or', index: 0, response: {type: 'option'}}, human);
      runAllActions(game);
      expect(bot.megaCredits).eq(3);
      expect(human.cardsInHand.map((x) => x.name)).deep.eq([CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
    });

    it('a bot with fewer than two in its stock is no target', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(S));
      const c = new ScientificBreakthrough();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      bot.megaCredits = 1;
      expect(human.canPlay(c)).is.false;
    });

    it('a reload keeps the event and the hand; the reveal queue is transient', () => {
      holder(t.opponent, new MartianCensus(), 3);
      stack(t.game, JOURNEY);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect(again.playedCards.get(ID)).is.not.undefined;
      expect(again.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.PHYSICS_COMPLEX]);
      expect((reloaded.getPlayerById(t.opponent.id).playedCards.get(CardName.MARTIAN_CENSUS) as IProjectCard).resourceCount).eq(1);
    });
  });
});
