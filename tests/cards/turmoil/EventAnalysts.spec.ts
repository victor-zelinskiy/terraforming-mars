import {expect} from 'chai';
import {EventAnalysts} from '../../../src/server/cards/turmoil/EventAnalysts';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../../src/server/parliament/ParliamentModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {MANUFACTURING_RUN_ID} from '../../../src/server/parliament/resolutions/industrialists/ManufacturingRun';
import {TRADE_INDUSTRIES, TRADE_INDUSTRIES_ID} from '../../../src/server/parliament/resolutions/unity/TradeIndustries';
import {BIODOME_CONTEST_ID} from '../../../src/server/parliament/resolutions/greens/BiodomeContest';
import {ARCHITECTURE_AWARD_ID} from '../../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {influenceAtAgenda, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {cast} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {endGenerationThroughParliament, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';

describe('EventAnalysts', () => {
  it('Should play', () => {
    const card = new EventAnalysts();
    const [game, player] = testGame(1, {turmoilExtension: true});
    expect(card.canPlay(player)).is.not.true;

    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    game.turmoil!.sendDelegateToParty(player, PartyName.SCIENTISTS, game);
    expect(card.canPlay(player)).is.true;

    card.play(player);
    expect(game.turmoil!.getInfluence(player)).to.eq(3);
  });

  it('a classic table keeps upstream\'s bare sum: no source, no journal line of the Redux facade', () => {
    const card = new EventAnalysts();
    const [game, player] = testGame(2, {turmoilExtension: true});
    const before = game.turmoil!.getInfluence(player);
    card.play(player);
    expect(game.turmoil!.getInfluence(player)).eq(before + 1);
    expect(game.turmoil!.playersInfluenceBonus.get(player.id)).eq(1);
    expect(game.gameLog.some((entry) => entry.message.includes('influence from'))).is.false;
  });
});

/**
 * T05 — EVENT ANALYSTS ON A TURMOIL REDUX TABLE: the tenth classic Turmoil card
 * adapted IN PLACE (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1) and the FIRST
 * card of the premium scope that gives influence BEYOND the Career. The card
 * file did not change its rules: `behavior.turmoil.influenceBonus` goes through
 * the facade since T04 (`PoliticalOps.addInfluenceBonus(player, 1, card.name)`)
 * and `Parliament.influence` adds the track's level and every bonus. What T05
 * added on the server: the journal line of the facade (the giver and the whole
 * influence before → after) and the play preview's influence chip. Every rule
 * of the reading is pinned here.
 */
describe('EventAnalysts — on a Turmoil Redux table', () => {
  const S = PartyName.SCIENTISTS;
  const LOG = '${0} gained +${1} influence from ${2} (${3} → ${4})';

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: EventAnalysts};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€; p1's Career at step 3 (level 2). */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new EventAnalysts();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    const parliament = game.parliament!;
    parliament.agenda.set(p1.id, 3);
    expect(parliament.influence(p1), 'the track alone: step 3 → level 2').eq(2);
    return {game, p1, p2, parliament, card};
  }

  /** The same table with three QUIET real resolutions up for the vote (the Scientists · Unity · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([S, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** The Scientists rule: their quiet resolution stands enacted. */
  function scientistsRuling(): Table {
    const t = parliamentTable();
    seatEnacted(t.parliament, quietResolutionOf(S));
    expect(t.parliament.rulingParty()).eq(S);
    return t;
  }

  /** The second road: two of p1's delegates on the Scientists' resolution (slot 0). */
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

  function reload(game: IGame): IGame {
    return Game.deserialize(structuredClone(game.serialize()));
  }

  it('rule 1 — the printed card: blue, 5, a Science tag, no VP, the Scientists\' plate; the printed number is T05', () => {
    const c = new EventAnalysts();
    expect(c.name).eq(CardName.EVENT_ANALYSTS);
    expect(c.type).eq(CardType.ACTIVE);
    expect(c.cost).eq(5);
    expect(c.tags).deep.eq([Tag.SCIENCE]);
    expect(c.victoryPoints).is.undefined;
    expect(requiredPartyOf(c)).eq(S);
    expect(c.behavior?.turmoil).deep.eq({influenceBonus: 1});
    expect(c.metadata.cardNumber).eq('T05');
    expect(TURMOIL_CARD_MANIFEST.projectCards[CardName.EVENT_ANALYSTS]?.compatibility).is.undefined;
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, current: 1});
    });

    it('the Scientists\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.UNITY, PartyName.GREENS, PartyName.MARS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = twoDelegates(parliamentTable());
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Scientists rule: playable', () => {
      const t = scientistsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Scientists EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, S, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 1 — +1 influence beyond the Career, with its giver', () => {
    it('the bonus is 1, its source is the card, the influence is the track\'s level + 1; the Career does not move', () => {
      const t = scientistsRuling();
      play(t);
      expect(t.parliament.influenceBonusOf(t.p1)).eq(1);
      expect(t.parliament.influenceSourcesOf(t.p1)).deep.eq([{amount: 1, source: CardName.EVENT_ANALYSTS}]);
      expect(t.parliament.influence(t.p1)).eq(influenceAtAgenda(3) + 1).eq(3);
      expect(t.parliament.agendaOf(t.p1), 'a bonus is not a step of the Career').eq(3);
      expect(t.game.politics!.influence(t.p1)).eq(3);
      expect(t.p1.tableau.has(CardName.EVENT_ANALYSTS)).is.true;
    });

    it('the bonus rides ON TOP of the track: a step of the Career later keeps it (step 5 → level 3, influence 4)', () => {
      const t = scientistsRuling();
      play(t);
      t.parliament.agenda.set(t.p1.id, 5);
      expect(t.parliament.influence(t.p1)).eq(4);
    });

    it('two DIFFERENT givers add up in the order they were given', () => {
      const t = scientistsRuling();
      t.game.politics!.addInfluenceBonus(t.p1, 1, CardName.COLONIAL_REPRESENTATION);
      play(t);
      expect(t.parliament.influenceSourcesOf(t.p1)).deep.eq([
        {amount: 1, source: CardName.COLONIAL_REPRESENTATION}, {amount: 1, source: CardName.EVENT_ANALYSTS},
      ]);
      expect(t.parliament.influence(t.p1)).eq(4);
    });

    it('the opponent\'s influence is untouched', () => {
      const t = scientistsRuling();
      const before = t.parliament.influence(t.p2);
      play(t);
      expect(t.parliament.influence(t.p2)).eq(before);
      expect(t.parliament.influenceSourcesOf(t.p2)).deep.eq([]);
    });

    it('the seat model carries the FINAL influence and its sources — for the viewer and as one of the players', () => {
      const t = scientistsRuling();
      play(t);
      const model = getParliamentModel(t.game, t.p1)!;
      const mine = model.players.find((p) => p.color === t.p1.color)!;
      expect(mine).deep.include({agenda: 3, influence: 3});
      expect(mine.influenceSources).deep.eq([{amount: 1, source: CardName.EVENT_ANALYSTS}]);
      const rival = model.players.find((p) => p.color === t.p2.color)!;
      expect(rival.influenceSources, 'a seat whose influence is the track\'s alone lists nothing').is.undefined;
    });
  });

  describe('rule 2 — the FINAL influence is the one every reader of the server applies', () => {
    it('a threshold «at influence 2+» (Manufacturing Run: 3 uses) opens for a seat whose TRACK says 1', () => {
      const t = twoDelegates(parliamentTable());
      seatEnacted(t.parliament, resolutionInstanceId(MANUFACTURING_RUN_ID, 0));
      t.parliament.agenda.set(t.p1.id, 1);
      expect(t.parliament.resolutionActionUsesLeft(t.p1), 'influence 1 → 2 uses').eq(2);
      play(t);
      expect(t.parliament.influence(t.p1)).eq(2);
      expect(t.parliament.resolutionActionUsesLeft(t.p1), 'influence 2 → 3 uses').eq(3);
    });

    it('a paid action\'s discount per influence (Trade Industries): the price drops by one more step', () => {
      const t = twoDelegates(parliamentTable());
      seatEnacted(t.parliament, resolutionInstanceId(TRADE_INDUSTRIES_ID, 0));
      const before = TRADE_INDUSTRIES.action!.preview(t.p1)[0];
      play(t);
      t.p1.megaCredits = before.current!;
      const after = TRADE_INDUSTRIES.action!.preview(t.p1)[0];
      expect(after.basis?.[0]).deep.eq({count: 3, label: 'Influence'});
      expect(after.amount, JSON.stringify([before, after])).lessThan(before.amount);
    });

    it('a payout per influence (Biodome Contest — 2 plants per influence): the bonus is paid in full', () => {
      const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, resolutionInstanceId(BIODOME_CONTEST_ID, 0));
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      parliament.agenda.set(p2.id, 3);
      p2.playCard(new EventAnalysts());
      runAllActions(game);
      expect(parliament.influence(p2)).eq(3);
      endGenerationThroughParliament(game);
      const ask = cast(p1.getWaitingFor(), SelectSpace);
      const cell = ask.spaces.find((s) => s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile?.tileType === TileType.OCEAN))!;
      p1.process({type: 'space', spaceId: cell.id});
      runAllActions(game);
      const outcomes = parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.find((o) => o.player === p2.id && o.step === 'plants')).deep.include({amount: 6, influence: 3});
    });

    it('a seat the Parliament does not count (MarsBot under `none`) holds the bonus and applies none of it', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.politics!.addInfluenceBonus(bot, 1, CardName.EVENT_ANALYSTS);
      expect(parliament.influenceBonusOf(bot), 'stored').eq(1);
      expect(parliament.influence(bot), 'not applied').eq(0);
      expect(getParliamentModel(game, bot)!.players.find((p) => p.color === bot.color)?.influenceSources, 'no sources of a seat that does not take part').is.undefined;
    });
  });

  describe('rule 3 — the journal names the giver and the whole influence before → after', () => {
    it('ONE line per play, tokens (player · amount · card · before · after), never pre-rendered text', () => {
      const t = scientistsRuling();
      play(t);
      const lines = t.game.gameLog.filter((entry) => entry.message === LOG);
      expect(lines).has.length(1);
      expect(lines[0].data.map((d) => d.type)).deep.eq([
        LogMessageDataType.PLAYER, LogMessageDataType.RAW_STRING, LogMessageDataType.CARD, LogMessageDataType.RAW_STRING, LogMessageDataType.RAW_STRING,
      ]);
      expect(lines[0].data.map((d) => d.value)).deep.eq([t.p1.color, '1', CardName.EVENT_ANALYSTS, '2', '3']);
    });
  });

  describe('rule 4 — the forecast before the press: «influence 2 → 3», read-only', () => {
    it('the play preview states the influence chip with the server\'s whole number, without touching the game', () => {
      const t = scientistsRuling();
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.filter((e) => e.icon === 'influence'), JSON.stringify(effects)).deep.eq([
        {direction: 'gain', icon: 'influence', amount: 1, current: 2, resulting: 3},
      ]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('the chip starts from the seat\'s FINAL influence (a bonus already held: 3 → 4)', () => {
      const t = scientistsRuling();
      t.game.politics!.addInfluenceBonus(t.p1, 1, CardName.COLONIAL_REPRESENTATION);
      const effects = cardPlayPreview(t.p1, t.card).branches.flatMap((b) => b.effects);
      expect(effects.find((e) => e.icon === 'influence')).deep.include({current: 3, resulting: 4});
    });

    it('a classic table keeps upstream\'s silence (no chip)', () => {
      const [, player] = testGame(2, {turmoilExtension: true});
      const effects = cardPlayPreview(player, new EventAnalysts()).branches.flatMap((b) => b.effects);
      expect(effects.some((e) => e.icon === 'influence')).is.false;
    });
  });

  it('with MarsBot at the table: the human plays it, the bonus is the human\'s', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([S, PartyName.UNITY, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    seatEnacted(parliament, quietResolutionOf(S));
    const c = new EventAnalysts();
    human.cardsInHand.push(c);
    human.megaCredits = 20;
    expect(human.canPlay(c)).is.true;
    const before = parliament.influence(human);
    human.playCard(c);
    runAllActions(game);
    expect(parliament.influence(human)).eq(before + 1);
    expect(parliament.influenceBonusOf(bot)).eq(0);
  });

  it('rule 4 — save / reload: the bonus survives with its source, the influence is read the same', () => {
    const t = scientistsRuling();
    play(t);
    const reloaded = reload(t.game);
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(reloaded.parliament!.influenceSourcesOf(owner)).deep.eq([{amount: 1, source: CardName.EVENT_ANALYSTS}]);
    expect(reloaded.parliament!.influence(owner)).eq(3);
    expect(owner.playedCards.get(CardName.EVENT_ANALYSTS)).is.not.undefined;
  });
});
