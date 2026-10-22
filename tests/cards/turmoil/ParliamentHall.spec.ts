import {expect} from 'chai';
import {Capital} from '../../../src/server/cards/base/Capital';
import {CommercialDistrict} from '../../../src/server/cards/base/CommercialDistrict';
import {DeepWellHeating} from '../../../src/server/cards/base/DeepWellHeating';
import {MartianRails} from '../../../src/server/cards/base/MartianRails';
import {Mine} from '../../../src/server/cards/base/Mine';
import {ParliamentHall} from '../../../src/server/cards/turmoil/ParliamentHall';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {calculateVictoryPoints} from '../../../src/server/game/calculateVictoryPoints';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('ParliamentHall', () => {
  it('Should play', () => {
    const card = new ParliamentHall();
    const card2 = new DeepWellHeating();
    const card3 = new MartianRails();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(card.canPlay(player)).is.not.true;

    const mars = game.turmoil!.getPartyByName(PartyName.MARS);
    mars.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;

    player.playedCards.push(card2, card3);
    card.play(player);
    expect(player.production.megacredits).to.eq(1);
  });
});

/**
 * T08 — PARLIAMENT HALL ON A TURMOIL REDUX TABLE: the fourth classic Turmoil
 * card adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The card
 * file did not change its rules: the party requirement already reads the
 * facade (`PartyRequirement` → `game.politics.satisfiesPartyRequirement`), and
 * the production is the declarative `production.megacredits {tag: BUILDING,
 * per: 3}` — the Counter's count of the PLAYER's Building tags, this one
 * included (it is on the tableau when the behavior runs), floored per 3.
 * Every rule of the reading is pinned here.
 */
describe('ParliamentHall — on a Turmoil Redux table', () => {
  const M = PartyName.MARS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: ParliamentHall};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new ParliamentHall();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (Mars First · Unity · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([M, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** Mars First rule: their quiet resolution stands enacted. */
  function marsFirstRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(M));
    expect(t.parliament.rulingParty()).eq(M);
    return t;
  }

  /** The second road: two of p1's delegates on Mars First's resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** `n` distinct Building-tag cards (no other tag counts toward the rule). */
  function buildings(n: number): Array<IProjectCard> {
    return [new MartianRails(), new Mine(), new CommercialDistrict(), new DeepWellHeating(), new Capital()].slice(0, n);
  }

  /** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const gainOf = (effects: ReadonlyArray<ActionEffect>, icon: string) => effects.find((e) => e.direction === 'gain' && e.icon === icon);

  it('rule 1 — the printed card: green, 8, a Building tag, 1 VP, Mars First\'s plate; the printed number is T08', () => {
    const c = new ParliamentHall();
    expect(c.name).eq(CardName.PARLIAMENT_HALL);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(8);
    expect(c.tags).deep.eq([Tag.BUILDING]);
    expect(c.victoryPoints).eq(1);
    expect(requiredPartyOf(c)).eq(M);
    expect(c.metadata.cardNumber).eq('T08');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.PARLIAMENT_HALL]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: Mars First rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [M, '2'], party: M, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, current: 1});
    });

    it('Mars First\'s resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.UNITY, PartyName.GREENS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: M, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Mars First rule: playable', () => {
      const t = marsFirstRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Mars First EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, M, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, M)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — +1 M€ production for every 3 of YOUR Building tags, this one included', () => {
    it('two Buildings on the table + this one = 3 → +1 step', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(2));
      play(t);
      expect(t.p1.production.megacredits).eq(1);
      expect(t.p1.tableau.has(CardName.PARLIAMENT_HALL)).is.true;
    });

    it('five Buildings + this one = 6 → +2 steps', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(5));
      play(t);
      expect(t.p1.production.megacredits).eq(2);
    });

    it('one Building + this one = 2 → nothing (the count floors per 3)', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(1));
      play(t);
      expect(t.p1.production.megacredits).eq(0);
    });

    it('an opponent\'s Building tags do not count (the PLAYER\'s count)', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(1));
      t.p2.playedCards.push(...buildings(5));
      play(t);
      expect(t.p1.production.megacredits).eq(0);
    });

    it('the player\'s own WILD tag counts as a Building tag (the Counter\'s own tag count); an EVENT\'s Building tag does not', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(1));
      t.p1.playedCards.push(fakeCard({name: 'wild own' as CardName, tags: [Tag.WILD]}));
      t.p1.playedCards.push(fakeCard({name: 'building event' as CardName, type: CardType.EVENT, tags: [Tag.BUILDING]}));
      play(t);
      expect(t.p1.production.megacredits, '1 Building + 1 wild + this = 3').eq(1);
    });

    it('the journal: the step is the play\'s `production-changed`, attributed to the card', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(2));
      const from = t.game.events.events.length;
      play(t);
      const steps = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color && e.type === 'production-changed');
      expect(steps.map((e) => e.impact.production?.[Resource.MEGACREDITS]), JSON.stringify(steps)).deep.eq([1]);
      expect(steps[0].source, JSON.stringify(steps[0])).deep.include({card: CardName.PARLIAMENT_HALL});
    });

    it('1 VP: the score explorer counts the card once it lands', () => {
      const t = marsFirstRuling();
      const before = calculateVictoryPoints(t.p1).victoryPoints;
      play(t);
      expect(calculateVictoryPoints(t.p1).victoryPoints - before).eq(1);
    });
  });

  describe('rule 3 — the forecast before the press: «+N M€ production · N Building tags, including this»', () => {
    it('the play preview states the production step with its basis (the count, this one included), read-only', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(2));
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      const mc = gainOf(effects, 'megacredits');
      expect(mc, JSON.stringify(effects)).deep.include({amount: 1, current: 0, resulting: 1, note: 'production'});
      expect(mc?.basis?.[0], 'the count names its tag and includes this card').deep.include({count: 3, tag: Tag.BUILDING});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('an honest zero: one Building + this = 2 — the chip says +0 and its basis says 2 (the player reads «2 of 3»), never a hidden chip', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(1));
      const effects = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects);
      const mc = gainOf(effects, 'megacredits');
      expect(mc, JSON.stringify(effects)).deep.include({amount: 0, note: 'production'});
      expect(mc?.basis?.[0]).deep.include({count: 2, tag: Tag.BUILDING});
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects` → `CardModel.countedPlay`)', () => {
      const t = marsFirstRuling();
      t.p1.playedCards.push(...buildings(5));
      const counted = countedPlayEffects(t.p1, t.card);
      expect(gainOf(counted, 'megacredits'), JSON.stringify(counted)).deep.include({amount: 2, note: 'production'});
    });
  });

  it('rule 2 with MarsBot at the table: the count is the HUMAN\'s own tags — the bot\'s Building track does not pay', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([M, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(M));
    const board = game.automa!.board;
    const building = board.getTrackIndexForTag(Tag.BUILDING);
    expect(building).is.not.undefined;
    board.tracks[building!].position = 6;
    const c = new ParliamentHall();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    human.playedCards.push(...buildings(1));
    const prod = human.production.megacredits;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    expect(human.production.megacredits - prod, '1 Building + this = 2 of 3 — the bot\'s track adds nothing').eq(0);
  });

  it('rule 4 — save / reload: the played card stays in the tableau with its tag and its production', () => {
    const t = marsFirstRuling();
    t.p1.playedCards.push(...buildings(2));
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.PARLIAMENT_HALL)).is.not.undefined;
    expect(owner.tags.count(Tag.BUILDING, 'raw')).eq(3);
    expect(owner.production.megacredits).eq(1);
  });
});
