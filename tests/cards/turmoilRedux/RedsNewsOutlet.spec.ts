import {expect} from 'chai';
import {RedsNewsOutlet} from '../../../src/server/cards/turmoilRedux/RedsNewsOutlet';
import {AdministrationDistrict} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {MartianRoads} from '../../../src/server/cards/turmoilRedux/MartianRoads';
import {RedTechConvention} from '../../../src/server/cards/turmoilRedux/RedTechConvention';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {HabitatMarte} from '../../../src/server/cards/pathfinders/HabitatMarte';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {RD_FUNDING_ID} from '../../../src/server/parliament/resolutions/scientists/RdFunding';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {hasPartyRequirement, partyRequirementCardsInGame, requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {resolutionCountUnitsOf} from '../../../src/server/parliament/resolutions/ResolutionCounts';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {victoryPointsIconOf} from '../../../src/common/cards/victoryPointsIcon';
import {calculateVictoryPoints, cardVictoryPointsAtPlay} from '../../../src/server/game/calculateVictoryPoints';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR33 — REDS NEWS OUTLET: the TR20 class («VP for tags», no effect row) over
 * the set's own MARS tag, one for one, under the Reds' plate. Every rule
 * reading of the card file's header is pinned here; the play composer's VP
 * projection has its corpus guard (tests/models/cardVictoryPointsAtPlay.spec.ts),
 * which takes this card by itself.
 */
const R = PartyName.REDS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedsNewsOutlet};

/** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new RedsNewsOutlet();
  p1.cardsInHand.push(card);
  return {game, p1, p2, parliament: game.parliament!, card};
}

/** The same table with three QUIET real resolutions (the Reds · Mars First · the Greens) and 40 M€. */
function parliamentTable(): Table {
  const t = table();
  ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
  t.p1.megaCredits = 40;
  return t;
}

/** `n` more played cards of `player`'s, each printing one Mars tag (and nothing else). */
let marsSerial = 0;
function playMarsCards(player: TestPlayer, n: number): void {
  for (let i = 0; i < n; i++) {
    player.playedCards.push(fakeCard({name: `mars ${marsSerial++}` as CardName, tags: [Tag.MARS]}));
  }
}

/** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
function play(t: Table): void {
  t.p1.playCard(t.card);
  runAllActions(t.game);
}

describe('RedsNewsOutlet', () => {
  it('registers with source-backed metadata (the scan: 7 · Mars · green · the Reds\' plate · 1/[Mars])', () => {
    const card = new RedsNewsOutlet();
    expect(card.name).eq(CardName.REDS_NEWS_OUTLET);
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(7);
    expect(card.tags, 'one planet in the corner').deep.eq([Tag.MARS]);
    expect(card.metadata.cardNumber).eq('TR33');
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'the VP badge on the Mars disc: «1/[Mars tag]»').deep.eq({tag: Tag.MARS, per: 1});
    expect(card.behavior).is.undefined;
    expect(card.resourceType).is.undefined;
    // No effect row on the scan — no `renderData`, and no prose `vpText` standing in for the badge.
    expect(card.metadata.renderData).is.undefined;
    expect(card.metadata.infoText).deep.eq([{kind: 'victory-points', text: '1 VP per Mars tag you have.'}]);
    // Only the module's icon at the bottom left: the module is the gate, no `compatibility`.
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.REDS_NEWS_OUTLET]?.compatibility).is.undefined;
  });

  it('the structured text is the requirement block + the VP line — no phantom «on play» block', () => {
    const info = buildCardInformation(new RedsNewsOutlet(), 'turmoilRedux');
    expect(info?.groups.map((g) => g.kind)).deep.eq(['requirements', 'victory-points']);
    expect(info?.groups.flatMap((g) => g.blocks.map((b) => b.text))).deep.eq([
      'Requires Reds to be ruling or that you have 2 delegates on its resolution.',
      '1 VP per Mars tag you have.',
    ]);
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the TR15 class\'s NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
    });

    it('two delegates on their resolution: playable', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Reds rule: playable', () => {
      const t = parliamentTable();
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.rulingParty()).eq(R);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });
  });

  describe('rules 2–3 — 1 VP per Mars tag you have, the card\'s own included', () => {
    it('no other Mars tag: its own makes 1; 4 others + its own make 5', () => {
      const t = table();
      play(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
      playMarsCards(t.p1, 4);
      expect(t.card.getVictoryPoints(t.p1)).eq(5);
    });

    it('another player\'s Mars tags are not «you have»', () => {
      const t = table();
      playMarsCards(t.p1, 2);
      play(t);
      playMarsCards(t.p2, 4);
      expect(t.card.getVictoryPoints(t.p1)).eq(3);
    });

    it('rule 3 — its own tag counts BEFORE the play too: the number the card scores the moment it lands', () => {
      const t = table();
      playMarsCards(t.p1, 2);
      expect(t.card.getVictoryPoints(t.p1), 'in hand: the Counter adds the unplayed card\'s own tag').eq(3);
      play(t);
      expect(t.card.getVictoryPoints(t.p1), 'in the tableau').eq(3);
    });

    it('the play composer\'s projection is the VP after the play — and the score explorer\'s row', () => {
      const t = table();
      playMarsCards(t.p1, 4);
      const projected = cardVictoryPointsAtPlay(t.p1, t.card);
      expect(projected).deep.eq({
        cardName: CardName.REDS_NEWS_OUTLET, victoryPoint: 5, kind: 'conditional',
        mechanics: {shape: 'per', each: 1, per: 1, counted: 5, unit: 'tags', tag: Tag.MARS},
      });
      play(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(projected?.victoryPoint);
      expect(calculateVictoryPoints(t.p1).detailsCards.find((d) => d.cardName === CardName.REDS_NEWS_OUTLET)).deep.eq(projected);
    });

    it('the projection is never «by condition» and never below its own tag: 0 others → +1 now', () => {
      const t = table();
      expect(cardVictoryPointsAtPlay(t.p1, t.card)).deep.include({victoryPoint: 1});
      expect(cardVictoryPointsAtPlay(t.p1, t.card)?.mechanics).deep.include({counted: 1, per: 1});
    });
  });

  describe('rule 4 — the VP count is RAW (the FAQ: a wild tag counts only «when performing an action»)', () => {
    it('a printed WILD tag does not count — the action-time count sees it, the VP count does not', () => {
      const t = table();
      playMarsCards(t.p1, 1);
      t.p1.playedCards.push(fakeCard({name: 'wild' as CardName, tags: [Tag.WILD]}));
      play(t);
      expect(t.p1.tags.count(Tag.MARS, 'default'), 'the action-time count sees 3').eq(3);
      expect(t.p1.tags.count(Tag.MARS, 'raw')).eq(2);
      expect(t.card.getVictoryPoints(t.p1), 'the VP count sees 2').eq(2);
    });

    it('the Scientists\' wild tag (2 delegates on their resolution) does not count', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(PartyName.SCIENTISTS));
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(ParliamentHandler.wildTags(t.p1)).eq(1);
      playMarsCards(t.p1, 2);
      play(t);
      expect(t.p1.tags.count(Tag.MARS, 'default'), 'the action-time count: 3 + the party\'s wild tag').eq(4);
      expect(t.card.getVictoryPoints(t.p1)).eq(3);
    });

    it('the ruling Scientists\' wild tag and R&D Funding at influence 1: neither reaches the Mars VP count', () => {
      const t = table();
      seatEnacted(t.parliament, RD_FUNDING_ID);
      t.parliament.agenda.set(t.p1.id, 1);
      expect(t.parliament.influence(t.p1)).eq(1);
      expect(ParliamentHandler.wildTags(t.p1), 'the law is the Scientists\' own, so they RULE: their wild tag').eq(1);
      // R&D Funding raises SCIENCE tags — never a Mars count, in any mode.
      expect(ParliamentHandler.tagBonus(t.p1, Tag.SCIENCE)).eq(1);
      expect(ParliamentHandler.tagBonus(t.p1, Tag.MARS)).eq(0);
      playMarsCards(t.p1, 3);
      const projected = cardVictoryPointsAtPlay(t.p1, t.card);
      play(t);
      expect(t.p1.tags.count(Tag.SCIENCE, 'default'), 'the science count: the wild tag + the law').eq(2);
      expect(t.p1.tags.count(Tag.MARS, 'default'), 'the Mars count for an action: 4 + the wild tag').eq(5);
      expect(t.card.getVictoryPoints(t.p1), 'the VP count: 4').eq(4);
      expect(projected?.victoryPoint, 'the composer\'s projection says the same 4').eq(4);
    });

    it('a played EVENT\'s Mars tag does not count (face down)', () => {
      const t = table();
      playMarsCards(t.p1, 1);
      t.p1.playedCards.push(fakeCard({name: 'event' as CardName, type: CardType.EVENT, tags: [Tag.MARS]}));
      play(t);
      expect(t.card.getVictoryPoints(t.p1)).eq(2);
      playMarsCards(t.p1, 1);
      expect(t.card.getVictoryPoints(t.p1)).eq(3);
    });

    it('Habitat Marte reads Mars tags AS science, never the other way round — the Mars count and the VP are its printed tags', () => {
      const t = table();
      playMarsCards(t.p1, 2);
      t.p1.playedCards.push(fakeCard({name: 'science' as CardName, tags: [Tag.SCIENCE]}));
      // Habitat Marte prints a Mars tag of its own: 2 + it + the card's own = 4.
      t.p1.playedCards.push(new HabitatMarte());
      play(t);
      expect(t.p1.tags.count(Tag.SCIENCE, 'default'), 'the science count: 1 printed + the 4 Mars tags').eq(5);
      expect(t.p1.tags.count(Tag.MARS, 'default'), 'the science tag is no Mars tag').eq(4);
      expect(t.card.getVictoryPoints(t.p1)).eq(4);
    });
  });

  describe('rule 5 — a NON-NEGATIVE variable VP icon, and no Building tag', () => {
    it('the icon is variable and non-negative', () => {
      expect(victoryPointsIconOf(new RedsNewsOutlet())).deep.eq({kind: 'variable', sign: 'nonNegative'});
    });

    it('with TR16 in the tableau the play draws NOTHING (TR16 answers a Building card) — and the forecast says nothing either', () => {
      const t = table();
      t.p1.playedCards.push(new AdministrationDistrict());
      const facts = effectForecastForPlay(t.p1, t.card, cardPlayPreview(t.p1, t.card)).facts
        .filter((f) => f.source.name === CardName.ADMINISTRATION_DISTRICT);
      expect(facts).deep.eq([]);
      const before = t.p1.cardsInHand.length;
      play(t);
      expect(t.p1.cardsInHand.length, 'only the played card left the hand').eq(before - 1);
    });

    it('Architecture Award (RX02) does not count it — it is not a Building card', () => {
      const t = table();
      play(t);
      expect(resolutionCountUnitsOf(t.p1, 'buildingCardsWithNonNegativeVp', t.card)).eq(0);
    });
  });

  it('rule 6 — a card with a party requirement: one more target of TR13\'s check in a Redux game', () => {
    expect(hasPartyRequirement(new RedsNewsOutlet())).is.true;
    const [game] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const before = partyRequirementCardsInGame(game);
    // Wherever the deal put it, the game holds it: take it out of every pool and the count drops by exactly one.
    const isIt = (c: {name: CardName}) => c.name === CardName.REDS_NEWS_OUTLET;
    const pools = [game.projectDeck.drawPile, game.projectDeck.discardPile, ...game.players.flatMap((p) => [p.cardsInHand, p.dealtProjectCards])];
    expect(pools.some((pool) => pool.some(isIt)), 'the card is in the Redux game').is.true;
    for (const pool of pools) {
      const at = pool.findIndex(isIt);
      if (at >= 0) {
        pool.splice(at, 1);
      }
    }
    expect(partyRequirementCardsInGame(game)).eq(before - 1);
  });

  it('rule 7 — the play only lays the card down: it asks nothing, pays nothing, places nothing', () => {
    const t = table();
    t.p1.megaCredits = 0;
    const tiles = t.game.board.spaces.filter((s) => s.tile !== undefined).length;
    play(t);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.game.deferredActions.length).eq(0);
    expect(t.p1.megaCredits).eq(0);
    expect(t.game.board.spaces.filter((s) => s.tile !== undefined).length).eq(tiles);
    expect(t.p1.tableau.has(CardName.REDS_NEWS_OUTLET)).is.true;
  });

  it('rule 7 — on a MarsBot table the human scores it like anywhere else; the bot\'s Mars tags are not «you have»', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(R));
    const card = new RedsNewsOutlet();
    human.cardsInHand.push(card);
    human.megaCredits = 20;
    expect(human.canPlay(card)).is.true;
    playMarsCards(human, 1);
    bot.playedCards.push(fakeCard({name: 'bot mars' as CardName, tags: [Tag.MARS]}));
    human.playCard(card);
    runAllActions(game);
    expect(card.getVictoryPoints(human)).eq(2);
    expect(calculateVictoryPoints(human).detailsCards.find((d) => d.cardName === CardName.REDS_NEWS_OUTLET)?.victoryPoint).eq(2);
  });

  it('save / reload: the reloaded card scores the same', () => {
    const t = table();
    // Real manifest cards (a fake one does not survive `Game.deserialize`): 2 Mars tags + its own = 3 VP.
    t.p1.playedCards.push(new MartianRoads(), new RedTechConvention());
    play(t);
    expect(t.card.getVictoryPoints(t.p1)).eq(3);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const again = owner.playedCards.get(CardName.REDS_NEWS_OUTLET);
    expect(again).is.not.undefined;
    expect(again!.getVictoryPoints(owner)).eq(3);
  });
});
