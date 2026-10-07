import {expect} from 'chai';
import {RED_TECH_CONVENTION_DRAW, RED_TECH_CONVENTION_WITHOUT_TAGS, RedTechConvention} from '../../../src/server/cards/turmoilRedux/RedTechConvention';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../../src/server/createCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {Server} from '../../../src/server/models/ServerModel';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR32 — RED TECH CONVENTION: the set's first draw with a NEGATIVE filter —
 * the DSL's `drawCard.withoutTags` (its class is pinned by
 * tests/deferredActions/DrawCardsRevealSequence.spec.ts). Every rule reading of
 * the card file's header is pinned here, on a deck stacked by NAME.
 */
const R = PartyName.REDS;
const BIO = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL];

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedTechConvention};

/** A two-seat Redux table, blue's action phase: the Reds' quiet card in slot 0, Mars First's in slot 1, the Greens' in slot 2; the card in hand, 20 M€. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new RedTechConvention();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

/** The requirement's ruling road: the Reds' card enacted (Heat Capture). */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(R));
  expect(t.parliament.rulingParty()).eq(R);
  return t;
}

function card(name: CardName): IProjectCard {
  return newProjectCard(name)!;
}

/**
 * Stack the draw pile so the FIRST name is turned over first (the top of the
 * deck is the tail — `draw()` pops). `spare` cards sit at the bottom so the
 * search never reaches the reshuffle.
 */
function stack(game: IGame, topFirst: ReadonlyArray<CardName | IProjectCard>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
  game.projectDeck.drawPile.length = 0;
  game.projectDeck.discardPile.length = 0;
  const cards = topFirst.map((c) => typeof c === 'string' ? card(c) : c);
  game.projectDeck.drawPile.push(...spare.map(card), ...cards.reverse());
}

/** The prompt's fixture order: Algae ✗ (plant) → Research ✓ → Ants ✗ (microbe) → Fish ✗ (animal) → Mining Area ✓ → Comet ✓. */
const JOURNEY = [CardName.ALGAE, CardName.RESEARCH, CardName.ANTS, CardName.FISH, CardName.MINING_AREA, CardName.COMET];

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: 5}));
  runAllActions(t.game);
}

describe('RedTechConvention', () => {
  it('registers with source-backed metadata (the scan: 5 · Mars · green · the Reds\' plate · no VP · TR32) and prints «3 [cards] [animal̶] [plant̶] [microbe̶]»', () => {
    const card = new RedTechConvention();
    expect(card.name).eq(CardName.RED_TECH_CONVENTION);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(5);
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.victoryPoints).is.undefined;
    expect(card.metadata.cardNumber).eq('TR32');
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(RED_TECH_CONVENTION_DRAW).eq(3);
    expect(RED_TECH_CONVENTION_WITHOUT_TAGS, 'the rule names them in the TEXT\'s order').deep.eq(BIO);
    expect(card.behavior).deep.eq({drawCard: {count: 3, withoutTags: BIO}});
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
    expect(rows).has.lengthOf(1);
    const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
    expect(items.map((item) => [item.type, item.amount, item.tag, item.cancelled])).deep.eq([
      [CardRenderItemType.CARDS, 3, undefined, undefined],
      // The PRINT's order — paw, leaf, microbe — each struck through.
      [CardRenderItemType.TAG, -1, Tag.ANIMAL, true],
      [CardRenderItemType.TAG, -1, Tag.PLANT, true],
      [CardRenderItemType.TAG, -1, Tag.MICROBE, true],
    ]);
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with a NAMED reason — the Reds, «0 of 2»', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: «1 of 2»; two: playable', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Reds rule: playable with no delegate anywhere', () => {
      const t = redsRule(table());
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 2–5 — the search, on a deck stacked by name', () => {
    it('Algae ✗ → Research ✓ → Ants ✗ → Fish ✗ → Mining Area ✓ → Comet ✓: the sequence word for word, the 3 in hand, the 3 in the discard pile, 5 M€ paid', () => {
      const t = redsRule(table());
      stack(t.game, JOURNEY);
      const hand = t.p1.cardsInHand.length;
      play(t);
      expect(t.p1.megaCredits).eq(15);
      expect(t.p1.playedCards.get(CardName.RED_TECH_CONVENTION)).is.not.undefined;
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET]);
      expect(t.p1.cardsInHand.length, 'the played card left, three arrived').eq(hand - 1 + 3);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.ANTS, CardName.FISH]);
      const reveal = t.p1.cardDrawReveals[0];
      expect(reveal.source).deep.eq({type: 'card', cardName: CardName.RED_TECH_CONVENTION});
      expect(reveal.sequence?.map((s) => [s.card.name, s.matched, s.failedTags])).deep.eq([
        [CardName.ALGAE, false, [Tag.PLANT]],
        [CardName.RESEARCH, true, undefined],
        [CardName.ANTS, false, [Tag.MICROBE]],
        [CardName.FISH, false, [Tag.ANIMAL]],
        [CardName.MINING_AREA, true, undefined],
        [CardName.COMET, true, undefined],
      ]);
      expect(reveal.search).deep.eq({count: 3, withoutTags: BIO});
      expect(reveal.exhausted).is.undefined;
      expect(t.p1.popWaitingFor(), 'one answer, no question').is.undefined;
    });

    it('rule 3 — TAGS are checked, not resources: Imported Nitrogen (Earth + Space, it PLACES microbes and animals) is clean; an event without the tags is clean; a printed WILD tag is none of them', () => {
      const t = redsRule(table());
      const wild = fakeCard({name: 'wild tag card' as CardName, tags: [Tag.WILD]});
      stack(t.game, [CardName.ALGAE, CardName.IMPORTED_NITROGEN, CardName.FISH, CardName.COMET, wild]);
      play(t);
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.IMPORTED_NITROGEN, CardName.COMET, 'wild tag card']);
      expect(card(CardName.COMET).type, 'Comet is an EVENT').eq(CardType.EVENT);
      expect(t.p1.cardDrawReveals[0].sequence?.filter((s) => !s.matched).map((s) => [s.card.name, s.failedTags])).deep.eq([
        [CardName.ALGAE, [Tag.PLANT]],
        [CardName.FISH, [Tag.ANIMAL]],
      ]);
    });

    it('rule 4 — exhaustion: the deck turned over to the end with ONE clean card keeps that one, names the end, never throws', () => {
      const t = redsRule(table());
      stack(t.game, [CardName.ALGAE, CardName.RESEARCH, CardName.ANTS, CardName.FISH], []);
      t.game.gameLog.length = 0;
      play(t);
      expect(t.p1.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH]);
      expect(t.p1.cardDrawReveals[0].exhausted).is.true;
      expect(t.game.gameLog.map((m) => m.message)).to.include('The whole project deck has been searched — no more matching cards.');
    });

    it('rule 5 — the journal: the discards with their names (public), the found cards with theirs (they were REVEALED), in that order', () => {
      const t = redsRule(table());
      stack(t.game, JOURNEY);
      t.game.gameLog.length = 0;
      play(t);
      const lines = t.game.gameLog.filter((m) => m.playerId === undefined).map((m) => formatMessage(m));
      const discard = lines.findIndex((l) => l === 'Discarded 3 cards Algae,Ants,Fish');
      const drew = lines.findIndex((l) => l === 'blue drew Research,Mining Area,Comet');
      expect(discard, lines.join('\n')).gte(0);
      expect(drew, lines.join('\n')).gt(discard);
    });
  });

  describe('ONE descriptor of the search — the chip, the structured text, the reveal', () => {
    it('the composer\'s draw chip carries the rule; its number does not change', () => {
      const t = redsRule(table());
      const chip = cardPlayPreview(t.p1, t.card).branches[0].effects.find((e) => e.icon === 'cards');
      expect(chip).deep.eq({direction: 'gain', icon: 'cards', amount: 3, note: 'draw', basis: undefined, search: {count: 3, withoutTags: BIO}});
    });

    it('the structured text prints the rule itself — the requirement line, then the search', () => {
      const info = buildCardInformation(new RedTechConvention(), 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      expect(blocks).deep.eq([
        'Requires Reds to be ruling or that you have 2 delegates on its resolution.',
        'Reveal cards from the project deck until you reveal 3 cards without a plant, microbe or animal tag. Take them into your hand and discard the rest.',
      ]);
    });

    it('the owner\'s model carries rule and reasons; the other seat\'s model carries nothing of it', () => {
      const t = redsRule(table());
      stack(t.game, JOURNEY);
      play(t);
      const mine = Server.getPlayerModel(t.p1).cardDrawReveals;
      expect(mine).has.length(1);
      expect(mine[0].search).deep.eq({count: 3, withoutTags: BIO});
      expect(mine[0].sequence?.map((s) => s.failedTags)).deep.eq([[Tag.PLANT], undefined, [Tag.MICROBE], [Tag.ANIMAL], undefined, undefined]);
      expect(Server.getPlayerModel(t.p2).cardDrawReveals, 'rule 6 — the faces are the owner\'s').deep.eq([]);
    });
  });

  it('rule 7 — on a MarsBot table the human plays it like anywhere else; the bot\'s hand and deck are untouched', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(R));
    const card = new RedTechConvention();
    human.cardsInHand.push(card);
    human.megaCredits = 20;
    expect(human.canPlay(card)).is.true;
    stack(game, JOURNEY);
    const botHand = bot.cardsInHand.length;
    human.playCard(card, Payment.of({megacredits: 5}));
    runAllActions(game);
    expect(human.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET]);
    expect(bot.cardsInHand).has.length(botHand);
  });

  it('rule 8 — save / load: the card on the table, the hand and the discard pile survive; the reveal queue is transient', () => {
    const t = redsRule(table());
    stack(t.game, JOURNEY);
    play(t);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    expect([...again.tableau].map((c) => c.name)).includes(CardName.RED_TECH_CONVENTION);
    expect(again.cardsInHand.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.MINING_AREA, CardName.COMET]);
    expect(live.projectDeck.discardPile.map((c) => c.name)).deep.eq([CardName.ALGAE, CardName.ANTS, CardName.FISH]);
    expect(again.cardDrawReveals).deep.eq([]);
  });
});
