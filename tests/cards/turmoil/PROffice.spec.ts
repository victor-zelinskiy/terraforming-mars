import {expect} from 'chai';
import {AcquiredCompany} from '../../../src/server/cards/base/AcquiredCompany';
import {Sponsors} from '../../../src/server/cards/base/Sponsors';
import {PROffice} from '../../../src/server/cards/turmoil/PROffice';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {countedPlayEffects} from '../../../src/server/models/actionPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ratingVetoed} from '../../../src/server/parliament/ratingVetoGate';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {DIVERTED_RESEARCH_ID} from '../../../src/server/parliament/resolutions/reds/DivertedResearch';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

describe('PROffice', () => {
  it('Should play', () => {
    const card = new PROffice();
    const card2 = new Sponsors();
    const card3 = new AcquiredCompany();
    const [game, player] = testGame(1, {turmoilExtension: true});

    expect(card.canPlay(player)).is.not.true;

    const unity = game.turmoil!.getPartyByName(PartyName.UNITY);
    unity.delegates.add(player, 2);
    expect(card.canPlay(player)).is.true;

    player.playedCards.push(card2, card3);
    card.play(player);
    expect(player.megaCredits).to.eq(3);
    expect(player.terraformRating).to.eq(15);
  });
});

/**
 * T09 — PR OFFICE ON A TURMOIL REDUX TABLE: the third classic Turmoil card
 * adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). The card file
 * did not change its rules: the party requirement already reads the facade
 * (`PartyRequirement` → `game.politics.satisfiesPartyRequirement`), the +1 TR
 * is the declarative `tr: 1` (the rating funnel — RX42 may refuse it), and the
 * counted gain is the Counter's own `{tag: EARTH}` — the PLAYER's Earth tags,
 * this one included. Every rule of the reading is pinned here.
 */
describe('PROffice — on a Turmoil Redux table', () => {
  const U = PartyName.UNITY;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PROffice};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new PROffice();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (Unity · Mars First · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([U, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** Unity rules: their quiet resolution stands enacted. */
  function unityRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(U));
    expect(t.parliament.rulingParty()).eq(U);
    return t;
  }

  /** The second road: two of p1's delegates on Unity's resolution (slot 0). */
  function twoDelegates(t: Table): Table {
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
    t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
    return t;
  }

  /** Play the card for real (past the requirement gate) and resolve whatever the play queues. */
  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  const gainOf = (effects: ReadonlyArray<ActionEffect>, icon: string) => effects.find((e) => e.direction === 'gain' && e.icon === icon);

  it('rule 1 — the printed card: green, 7, an Earth tag, no VP, Unity\'s plate; the printed number is T09', () => {
    const c = new PROffice();
    expect(c.name).eq(CardName.PR_OFFICE);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(7);
    expect(c.tags).deep.eq([Tag.EARTH]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(U);
    expect(c.metadata.cardNumber).eq('T09');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.PR_OFFICE]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: Unity rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: U, current: 1});
    });

    it('Unity\'s resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.GREENS, PartyName.SCIENTISTS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: U, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Unity rule: playable', () => {
      const t = unityRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Unity EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, U, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, U)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — +1 TR, and 1 M€ for each of YOUR Earth tags, this one included', () => {
    it('its own tag + two of the player\'s = 3 M€, and the rating rises by 1', () => {
      const t = unityRuling();
      t.p1.playedCards.push(new Sponsors(), new AcquiredCompany());
      const mc = t.p1.megaCredits;
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.p1.megaCredits - mc, '(`playCard` takes no payment — the gain alone)').eq(3);
      expect(t.p1.terraformRating - tr).eq(1);
      expect(t.p1.tableau.has(CardName.PR_OFFICE)).is.true;
    });

    it('alone on the table: its own tag pays 1', () => {
      const t = unityRuling();
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(1);
    });

    it('an opponent\'s Earth tags do not count (the PLAYER\'s count, unlike Diaspora Movement\'s «in play»)', () => {
      const t = unityRuling();
      t.p2.playedCards.push(new Sponsors(), new AcquiredCompany());
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(1);
    });

    it('the player\'s own WILD tag counts as an Earth tag (the Counter\'s own tag count); an EVENT\'s Earth tag does not', () => {
      const t = unityRuling();
      t.p1.playedCards.push(fakeCard({name: 'wild own' as CardName, tags: [Tag.WILD]}));
      t.p1.playedCards.push(fakeCard({name: 'earth event' as CardName, type: CardType.EVENT, tags: [Tag.EARTH]}));
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.megaCredits - mc).eq(2);
    });

    it('the journal: the M€ and the rating are both the play\'s, in the engine\'s order — the stock first, then the rating', () => {
      const t = unityRuling();
      t.p1.playedCards.push(new Sponsors());
      const from = t.game.events.events.length;
      play(t);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      const mc = mine.findIndex((e) => e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) > 0);
      const tr = mine.findIndex((e) => e.type === 'tr-changed');
      expect(mc, JSON.stringify(mine.map((e) => e.type))).gte(0);
      expect(tr, JSON.stringify(mine.map((e) => e.type))).gte(0);
      expect(mc, '`Executor.execute`: `stock` (line ~483) runs before `tr` (line ~569)').lt(tr);
    });
  });

  describe('rule 3 — the forecast before the press: «+1 TR» and «+N M€ · N Earth tags, including this»', () => {
    it('the play preview states both chips, the M€ with its basis, read-only', () => {
      const t = unityRuling();
      t.p1.playedCards.push(new Sponsors(), new AcquiredCompany());
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(gainOf(effects, 'tr')?.amount, JSON.stringify(effects)).eq(1);
      const mc = gainOf(effects, 'megacredits');
      expect(mc?.amount, JSON.stringify(effects)).eq(3);
      expect(mc?.basis?.[0], 'the count names its tag').deep.include({count: 3, tag: Tag.EARTH});
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('the hand reads the same counted number off the server (`countedPlayEffects` → `CardModel.countedPlay`)', () => {
      const t = unityRuling();
      t.p1.playedCards.push(new Sponsors());
      const counted = countedPlayEffects(t.p1, t.card);
      expect(gainOf(counted, 'megacredits')?.amount, JSON.stringify(counted)).eq(2);
    });
  });

  describe('rule 2 under the replacing laws — the rating goes through the ONE funnel', () => {
    it('RX42 UNMI Veto (the Reds rule, p1 FIRST by rating, the second road open): the +1 TR is refused, the M€ still pays; the preview strikes the chip BY NAME', () => {
      const t = parliamentTable();
      seatEnacted(t.parliament, UNMI_VETO_ID);
      twoDelegates(t);
      t.p1.terraformRating = 30;
      t.p2.terraformRating = 20;
      expect(ratingVetoed(t.p1)).is.true;
      expect(t.p1.canPlay(t.card), 'the second road is the way in while the Reds rule').is.true;
      const tr = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects).find((e) => e.icon === 'tr' && e.direction === 'gain');
      expect(tr?.vetoed, 'the chip is struck with the law and its steps').deep.eq({resolution: UNMI_VETO_ID, steps: 1});
      const mc = t.p1.megaCredits;
      play(t);
      expect(t.p1.terraformRating, 'nothing gained').eq(30);
      expect(t.p1.megaCredits - mc, 'the counted M€ is not the rating').eq(1);
    });

    it('RX35 Diverted Research takes scale steps and tiles, never a BARE rating: the +1 TR stands, unmarked', () => {
      const t = twoDelegates(parliamentTable());
      seatEnacted(t.parliament, DIVERTED_RESEARCH_ID);
      const tr = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects).find((e) => e.icon === 'tr' && e.direction === 'gain');
      expect(tr?.amount).eq(1);
      expect(tr?.diverted).is.undefined;
      const before = t.p1.terraformRating;
      play(t);
      expect(t.p1.terraformRating - before).eq(1);
    });
  });

  it('rule 2 with MarsBot at the table: the count is the HUMAN\'s own tags — the bot\'s Earth track does not pay', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([U, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(U));
    const board = game.automa!.board;
    const earth = board.getTrackIndexForTag(Tag.EARTH);
    expect(earth).is.not.undefined;
    board.tracks[earth!].position = 3;
    const c = new PROffice();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    const tr = human.terraformRating;
    expect(human.canPlay(c)).is.true;
    human.playCard(c);
    runAllActions(game);
    expect(human.megaCredits, 'its own tag only').eq(20 + 1);
    expect(human.terraformRating - tr).eq(1);
  });

  it('rule 4 — save / reload: the played card stays in the tableau', () => {
    const t = unityRuling();
    play(t);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.PR_OFFICE)).is.not.undefined;
    expect(owner.tags.count(Tag.EARTH, 'raw')).eq(1);
  });
});
