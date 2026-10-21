import {expect} from 'chai';
import {ColonizerTrainingCamp} from '../../../src/server/cards/base/ColonizerTrainingCamp';
import {MethaneFromTitan} from '../../../src/server/cards/base/MethaneFromTitan';
import {DiasporaMovement} from '../../../src/server/cards/turmoil/DiasporaMovement';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IParty} from '../../../src/server/turmoil/parties/IParty';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {cardVictoryPointsAtPlay} from '../../../src/server/game/calculateVictoryPoints';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('DiasporaMovement', () => {
  let card: DiasporaMovement;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;
  let turmoil: Turmoil;
  let reds: IParty;

  beforeEach(() => {
    card = new DiasporaMovement();
    [game, player, player2] = testGame(2, {turmoilExtension: true});
    turmoil = game.turmoil!;
    reds = turmoil.getPartyByName(PartyName.REDS);
  });

  it('Can not play', () => {
    reds.sendDelegate(player, game);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play', () => {
    reds.sendDelegate(player, game);
    reds.sendDelegate(player, game);
    expect(card.canPlay(player)).is.true;

    player.playedCards.push(new ColonizerTrainingCamp());
    player2.playedCards.push(new MethaneFromTitan());
    card.play(player);
    expect(player.megaCredits).to.eq(3);
  });
});

/**
 * T04 — DIASPORA MOVEMENT ON A TURMOIL REDUX TABLE: the first classic Turmoil
 * card adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The card
 * file did not change its rules: the party requirement already reads the
 * facade (`PartyRequirement` → `game.politics.satisfiesPartyRequirement`), and
 * the counted gain is the Counter's `{tag: JOVIAN, all: true}` — Galilean
 * Waystation's path. Every rule of the reading is pinned here.
 */
describe('DiasporaMovement — on a Turmoil Redux table', () => {
  const R = PartyName.REDS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: DiasporaMovement};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new DiasporaMovement();
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

  /** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  it('rule 1 — the printed card: green, 7, a Jovian tag, 1 VP, the Reds\' plate; the printed number is T04', () => {
    const c = new DiasporaMovement();
    expect(c.name).eq(CardName.DIASPORA_MOVEMENT);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(7);
    expect(c.tags).deep.eq([Tag.JOVIAN]);
    expect(c.victoryPoints).eq(1);
    expect(requiredPartyOf(c)).eq(R);
    // Upstream prints the letter O («TO4»); the card, its art and its lore are keyed by the printed T04.
    expect(c.metadata.cardNumber).eq('T04');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.DIASPORA_MOVEMENT]?.compatibility).is.undefined;
  });

  describe('rules 2–3 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
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
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
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

  describe('rule 4 — 1 M€ for EACH Jovian tag in play, every player\'s, this one included', () => {
    it('its own tag + one of the player\'s + one of the opponent\'s = 3 M€', () => {
      const t = redsRuling();
      t.p1.playedCards.push(new ColonizerTrainingCamp());
      t.p2.playedCards.push(new MethaneFromTitan());
      const before = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - before, '(`playCard` takes no payment — the gain alone)').eq(3);
      expect(t.p1.tableau.has(CardName.DIASPORA_MOVEMENT)).is.true;
    });

    it('alone on the table: its own tag pays 1', () => {
      const t = redsRuling();
      const before = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - before).eq(1);
    });

    it('an opponent\'s WILD tag is not a Jovian tag (the raw count); the player\'s own wild is not either', () => {
      const t = redsRuling();
      t.p2.playedCards.push(fakeCard({name: 'wild other' as CardName, tags: [Tag.WILD]}));
      const before = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - before).eq(1);
    });
  });

  it('rule 5 — the play preview states the counted gain «+3 M€» before the play, read-only', () => {
    const t = redsRuling();
    t.p1.playedCards.push(new ColonizerTrainingCamp());
    t.p2.playedCards.push(new MethaneFromTitan());
    const mc = t.p1.megaCredits;
    const preview = cardPlayPreview(t.p1, t.card);
    expect(preview.kind, 'a declaration — no hook').eq('declarative');
    const effects = preview.branches.flatMap((b) => b.effects);
    const gain = effects.find((e) => e.direction === 'gain' && e.icon === 'megacredits');
    expect(gain, JSON.stringify(effects)).is.not.undefined;
    expect(gain!.amount).eq(3);
    expect(t.p1.megaCredits, 'the preview never mutates').eq(mc);
    // A FIXED 1 VP is printed, not projected: the play composer's projection is for counted VP only.
    expect(cardVictoryPointsAtPlay(t.p1, t.card)).is.undefined;
    expect(t.card.getVictoryPoints(t.p1)).eq(1);
  });

  it('rule 4 with MarsBot at the table: the bot\'s Jovian tags are its track position (rulebook p.5), the count does not fail', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([R, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(R));
    const board = game.automa!.board;
    const jovian = board.getTrackIndexForTag(Tag.JOVIAN);
    expect(jovian).is.not.undefined;
    board.tracks[jovian!].position = 2;
    const c = new DiasporaMovement();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    expect(human.megaCredits, 'its own tag + the bot\'s two').eq(20 + 1 + 2);
  });

  it('rule 8 — save / reload: the played card stays in the tableau and still scores its VP', () => {
    const t = redsRuling();
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const again = owner.playedCards.get(CardName.DIASPORA_MOVEMENT);
    expect(again).is.not.undefined;
    expect(again!.getVictoryPoints(owner)).eq(1);
  });
});
