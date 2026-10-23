import {expect} from 'chai';
import {PublicCelebrations} from '../../../src/server/cards/turmoil/PublicCelebrations';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CHAIRMAN_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {ratingVetoed} from '../../../src/server/parliament/ratingVetoGate';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Payment} from '../../../src/common/inputs/Payment';
import {Phase} from '../../../src/common/Phase';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

describe('PublicCelebrations', () => {
  it('Should play', () => {
    const card = new PublicCelebrations();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(card.canPlay(player)).is.not.true;

    game.turmoil!.chairman = player;
    expect(card.canPlay(player)).is.true;
    card.play(player);
  });

  it('the classic table keeps upstream\'s line: no named chairman reason (it is the Redux seat\'s alone)', () => {
    const [game, player, other] = testGame(2, {turmoilExtension: true});
    game.phase = Phase.ACTION;
    game.turmoil!.chairman = other;
    const card = new PublicCelebrations();
    player.cardsInHand.push(card);
    player.megaCredits = 20;
    expect(player.canPlay(card)).is.false;
    expect(unplayableReasons(player, card).some((r) => r.message === CHAIRMAN_REQUIREMENT_REASON)).is.false;
  });
});

/**
 * T10 — PUBLIC CELEBRATIONS ON A TURMOIL REDUX TABLE: the eighth classic
 * Turmoil card adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1).
 * The card file did not change its rules: the chairman requirement already
 * reads the facade (`ChairmanRequirement` → `game.politics.isChairman`), the
 * hand names it (`chairmanRequirementReason` — TR12 Party Sanctions' class),
 * and the play is nothing but the event's 2 VP. Every rule of the reading is
 * pinned here.
 */
describe('PublicCelebrations — on a Turmoil Redux table', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PublicCelebrations};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, three quiet resolutions up, p1 in the chair, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([PartyName.GREENS, PartyName.UNITY, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    parliament.chairman = p1.id;
    const card = new PublicCelebrations();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament, card};
  }

  function play(t: Table): void {
    t.p1.playCard(t.card, Payment.of({megacredits: 8}));
    runAllActions(t.game);
  }

  function cardVp(p: {getVictoryPoints(): {detailsCards: ReadonlyArray<{cardName: string, victoryPoint: number}>}}): number | undefined {
    return p.getVictoryPoints().detailsCards.find((d) => d.cardName === CardName.PUBLIC_CELEBRATIONS)?.victoryPoint;
  }

  it('rule 1 — the printed card: an event for 8, no tags, 2 VP, the CHAIRMAN requirement alone; the printed number is T10', () => {
    const c = new PublicCelebrations();
    expect(c.name).eq(CardName.PUBLIC_CELEBRATIONS);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(8);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).eq(2);
    expect(c.requirements).has.lengthOf(1);
    expect((c.requirements[0] as {chairman?: unknown}).chairman).eq(true);
    expect(c.metadata.cardNumber).eq('T10');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.PUBLIC_CELEBRATIONS]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement is the chair, NOW', () => {
    it('in the chair: playable, no reason', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('another seat holds it: unplayable, the reason names the holder', () => {
      const t = table();
      t.parliament.chairman = t.p2.id;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: CHAIRMAN_REQUIREMENT_REASON, chairmanNow: {name: t.p2.name, color: t.p2.color},
        requirement: true, requirementKey: 'req:Chairman',
      }]);
    });

    it('the chair is vacant: unplayable, «the chair is vacant»', () => {
      const t = table();
      t.parliament.chairman = undefined;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({message: CHAIRMAN_REQUIREMENT_REASON, chairmanNow: 'vacant'});
    });

    it('in the chair but short of M€: the price is the only reason', () => {
      const t = table();
      t.p1.megaCredits = 7;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card).map((r) => r.type)).deep.eq(['megacredits']);
    });
  });

  describe('rule 2 — the play: nothing but 2 VP and the events pile', () => {
    it('8 M€ paid; into the events pile; no rating, no prompt, the chair kept', () => {
      const t = table();
      const tr = t.p1.terraformRating;
      const from = t.game.events.events.length;
      play(t);
      expect(t.p1.megaCredits).eq(12);
      expect(t.p1.playedCards.has(CardName.PUBLIC_CELEBRATIONS), 'into the events pile').is.true;
      expect(t.p1.cardsInHand.some((c) => c.name === CardName.PUBLIC_CELEBRATIONS)).is.false;
      expect(t.p1.terraformRating).eq(tr);
      expect(t.game.events.events.slice(from).some((e) => e.type === 'tr-changed'), 'no rating line').is.false;
      expect(t.p1.getWaitingFor(), 'no prompt').is.undefined;
      expect(t.parliament.chairman, 'the requirement reads, it never spends the chair').eq(t.p1.id);
    });

    it('+2 VP at the end — the card\'s own row of the breakdown', () => {
      const t = table();
      play(t);
      expect(cardVp(t.p1)).eq(2);
    });

    it('the chair lost after the play: the VP stay (the requirement is a gate, never a condition of the score)', () => {
      const t = table();
      play(t);
      t.parliament.chairman = t.p2.id;
      expect(cardVp(t.p1)).eq(2);
    });
  });

  it('rule 2 under RX42 UNMI Veto (p1 first by rating): VP are no rating — the veto does not touch the card', () => {
    const t = table();
    seatEnacted(t.parliament, UNMI_VETO_ID);
    t.p1.terraformRating = 30;
    t.p2.terraformRating = 20;
    expect(ratingVetoed(t.p1)).is.true;
    expect(t.p1.canPlay(t.card)).is.true;
    play(t);
    expect(t.p1.terraformRating).eq(30);
    expect(cardVp(t.p1)).eq(2);
  });

  it('rule 1 with MarsBot at the table: the bot in the chair closes it for the human, named', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([PartyName.GREENS, PartyName.UNITY, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const c = new PublicCelebrations();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    parliament.chairman = bot.id;
    expect(human.canPlay(c)).is.false;
    expect(unplayableReasons(human, c)[0]).deep.include({chairmanNow: {name: bot.name, color: bot.color}});
    parliament.chairman = human.id;
    expect(human.canPlay(c)).is.true;
  });

  it('rule 2 — save / reload: the card in the events pile, its 2 VP, the chair', () => {
    const t = table();
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.has(CardName.PUBLIC_CELEBRATIONS)).is.true;
    expect(cardVp(owner)).eq(2);
    expect(reloaded.parliament!.chairman).eq(t.p1.id);
  });
});
