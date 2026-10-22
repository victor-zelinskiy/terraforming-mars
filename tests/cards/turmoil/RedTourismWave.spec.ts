import {expect} from 'chai';
import {RedTourismWave} from '../../../src/server/cards/turmoil/RedTourismWave';
import {HermeticOrderOfMars} from '../../../src/server/cards/promo/HermeticOrderofMars';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {Tourist} from '../../../src/server/awards/amazonisPlanitia/Tourist';
import {IGame} from '../../../src//server/IGame';
import {Game} from '../../../src/server/Game';
import {IPlayer} from '../../../src/server/IPlayer';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {SpaceId} from '../../../src/common/Types';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, addGreenery, addOcean, runAllActions} from '../../TestingUtils';

describe('RedTourismWave', () => {
  let card: RedTourismWave;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new RedTourismWave();
    [game, player] = testGame(2, {turmoilExtension: true});
  });

  it('Can play', () => {
    expect(card.canPlay(player)).is.not.true;

    const reds = game.turmoil!.getPartyByName(PartyName.REDS);
    reds.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;
  });

  it('play', () => {
    const tharsis = game.board.getSpaceOrThrow('09');
    const lands = game.board.getAdjacentSpaces(tharsis).filter((space) => space.spaceType === SpaceType.LAND);
    game.addCity(player, lands[0]);
    card.play(player);
    expect(player.megaCredits).to.eq(3);
  });
});

/**
 * T12 — RED TOURISM WAVE ON A TURMOIL REDUX TABLE: the fifth classic Turmoil card adapted IN PLACE
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The rules did not change: the party requirement reads the facade
 * (`PartyRequirement` → `game.politics`), the play is the bespoke `getAdjacentEmptySpacesCount` (the static the
 * Amazonis «Tourist» award reads — untouched). The work is the premium reading: the COUNTED play with its CELLS (the
 * board peek lights the counted areas), the honest zero named, the face, the lore. Every rule is pinned here.
 */
describe('RedTourismWave — on a Turmoil Redux table', () => {
  const R = PartyName.REDS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedTourismWave};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new RedTourismWave();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (the Reds · Mars First · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** The Reds rule: their quiet resolution stands enacted. */
  function redsRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(R));
    expect(t.parliament.rulingParty()).eq(R);
    return t;
  }

  /** The second road: two of p1's delegates on the Reds' resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** Play the card for real (past the requirement gate) and resolve whatever the play queues; the M€ it paid. */
  function play(t: Table): number {
    const before = t.p1.megaCredits;
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return t.p1.megaCredits - before;
  }

  const mcGain = (effects: ReadonlyArray<ActionEffect>) => effects.find((e) => e.direction === 'gain' && e.icon === 'megacredits');
  const ids = (player: IPlayer) => RedTourismWave.getAdjacentEmptySpaces(player).map((s) => s.id);

  it('rule 1 — the printed card: an event, 3, an Earth tag, no VP, the Reds\' plate; the printed number is T12', () => {
    const c = new RedTourismWave();
    expect(c.name).eq(CardName.RED_TOURISM_WAVE);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(3);
    expect(c.tags).deep.eq([Tag.EARTH]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(R);
    expect(c.metadata.cardNumber).eq('T12');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.RED_TOURISM_WAVE]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
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

    it('the Reds\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.GREENS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Reds rule: playable', () => {
      const t = redsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Reds EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, R, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, R)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — 1 M€ for each EMPTY area adjacent to at least one of YOUR tiles', () => {
    it('one tile with six empty neighbours pays 6', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      expect(play(t)).eq(6);
    });

    it('an area next to two of your tiles counts ONCE; the tiles\' own areas are not empty', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      addGreenery(t.p1, '51');
      expect(play(t)).eq(8);
    });

    it('an occupied area is not empty — an ocean between your tiles takes one away', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      addGreenery(t.p1, '51');
      addOcean(t.p1, '43');
      expect(play(t)).eq(7);
    });

    it('a RESTRICTED area does not count; a COLONY space is never an area', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      addGreenery(t.p1, '51');
      t.game.board.getSpaceOrThrow('43').spaceType = SpaceType.RESTRICTED;
      expect(ids(t.p1)).not.include('43');
      expect(RedTourismWave.getAdjacentEmptySpaces(t.p1).every((s) => s.spaceType !== SpaceType.COLONY && s.spaceType !== SpaceType.RESTRICTED)).is.true;
      expect(play(t)).eq(7);
    });

    it('another player\'s tiles count for nothing — and a rival tile on your neighbour takes that area away', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      const neighbour = t.game.board.getAdjacentSpaces(t.game.board.getSpaceOrThrow('50')).find((s) => s.spaceType === SpaceType.LAND);
      expect(neighbour).is.not.undefined;
      addCity(t.p2, neighbour!.id);
      // The rival city's own neighbours are not p1's; the area it stands on is no longer empty.
      expect(ids(t.p1)).not.include(neighbour!.id);
      expect(RedTourismWave.getAdjacentEmptySpaces(t.p2).length, 'the rival has areas of its own').gt(0);
      expect(play(t)).eq(5);
    });

    it('no tile of yours: the honest zero — the play pays nothing and still resolves', () => {
      const t = redsRuling();
      addGreenery(t.p2, '50');
      expect(play(t)).eq(0);
      expect(t.p1.playedCards.get(CardName.RED_TOURISM_WAVE)).is.not.undefined;
    });

    it('the journal: ONE M€ gain of the play\'s', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      const from = t.game.events.events.length;
      play(t);
      const gains = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color && e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) > 0);
      expect(gains.map((e) => e.impact?.stock?.megacredits)).deep.eq([6]);
    });

    it('the static the Tourist award reads is unchanged — the cells and the count never disagree', () => {
      const t = redsRuling();
      const tourist = new Tourist();
      for (const tile of ['50', '51', '43', '22'] as Array<SpaceId>) {
        if (tile === '43') {
          addOcean(t.p1, tile);
        } else {
          addGreenery(t.p1, tile);
        }
        expect(RedTourismWave.getAdjacentEmptySpaces(t.p1).length, tile).eq(RedTourismWave.getAdjacentEmptySpacesCount(t.p1));
        expect(tourist.getScore(t.p1), tile).eq(RedTourismWave.getAdjacentEmptySpacesCount(t.p1));
      }
    });
  });

  describe('rule 3 — the forecast before the press: «+N M€» with N and its CELLS', () => {
    it('the play preview states the gain with its basis and the counted cells, read-only', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      addGreenery(t.p1, '51');
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'the co-located hook').eq('bespoke');
      const mc = mcGain(preview.branches.flatMap((b) => b.effects));
      expect(mc?.amount).eq(8);
      expect(mc?.current).eq(20);
      expect(mc?.resulting).eq(28);
      const basis = mc?.basis?.[0];
      expect(basis).deep.include({count: 8, label: 'Empty areas next to your tiles', zero: 'No empty areas next to your tiles'});
      expect(basis?.spaces, 'the cells are the play\'s own walk').deep.eq(ids(t.p1));
      expect(new Set(basis?.spaces).size, 'one cell, one count').eq(8);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('the preview IS the result: the number the play pays', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      addOcean(t.p1, '43');
      const forecast = mcGain(cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects))?.amount;
      expect(play(t)).eq(forecast);
    });

    it('the zero reads in words, with no cells', () => {
      const t = redsRuling();
      const mc = mcGain(cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects));
      expect(mc?.amount).eq(0);
      expect(mc?.basis?.[0]).deep.include({count: 0, zero: 'No empty areas next to your tiles'});
      expect(mc?.basis?.[0].spaces).deep.eq([]);
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects` → `CardModel.countedPlay`)', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      const counted = countedPlayEffects(t.p1, t.card);
      expect(mcGain(counted)?.amount, JSON.stringify(counted)).eq(6);
      expect(mcGain(counted)?.basis?.[0].spaces).deep.eq(ids(t.p1));
    });

    it('Hermetic Order of Mars counts by the SAME walk — its chip carries the same cells', () => {
      const t = redsRuling();
      addGreenery(t.p1, '50');
      const hermetic = mcGain(countedPlayEffects(t.p1, new HermeticOrderOfMars()));
      expect(hermetic?.amount).eq(6);
      expect(hermetic?.basis?.[0].spaces).deep.eq(ids(t.p1));
    });
  });

  it('rule 2 with MarsBot at the table: the bot\'s tiles are another player\'s — they count for nothing', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(R));
    addGreenery(bot, '50');
    addGreenery(human, '22');
    const expected = RedTourismWave.getAdjacentEmptySpacesCount(human);
    expect(RedTourismWave.getAdjacentEmptySpaces(human).map((s) => s.id)).not.include.members(
      game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('50')).filter((s) => s.tile === undefined).map((s) => s.id)
        .filter((id) => !game.board.getAdjacentSpaces(game.board.getSpaceOrThrow('22')).some((s) => s.id === id)));
    const c = new RedTourismWave();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    expect(human.megaCredits).eq(20 + expected);
  });

  it('rule 4 — save / reload: the event stays played', () => {
    const t = redsRuling();
    addGreenery(t.p1, '50');
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.RED_TOURISM_WAVE)).is.not.undefined;
    expect(owner.megaCredits).eq(26);
  });
});
