import {expect} from 'chai';
import {ColonialEnvoys} from '../../../src/server/cards/prelude2/ColonialEnvoys';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Luna} from '../../../src/server/colonies/Luna';
import {runAllActions, testGame, setRulingParty} from '../../TestingUtils';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Ganymede} from '../../../src/server/colonies/Ganymede';
import {cast} from '../../../src/common/utils/utils';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {Parliament} from '@/server/parliament/Parliament';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '@/server/models/unplayableReasons';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {DELEGATE_ICON, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('ColonialEnvoys', () => {
  let card: ColonialEnvoys;
  let player: TestPlayer;
  let game: IGame;
  let luna: Luna;
  let ganymede: Ganymede;
  let turmoil: Turmoil;

  beforeEach(() => {
    card = new ColonialEnvoys();
    [game, player] = testGame(2, {turmoilExtension: true, coloniesExtension: true});
    turmoil = player.game.turmoil!;
    luna = new Luna();
    ganymede = new Ganymede();
    game.colonies.push(luna, ganymede);
  });

  it('Can not play, not in power', () => {
    setRulingParty(game, PartyName.KELVINISTS);

    expect(card.canPlay(player)).is.false;

    setRulingParty(game, PartyName.UNITY);

    expect(card.canPlay(player)).is.true;
  });

  it('Cannot play - 1 colony, 0 delegates', () => {
    luna.colonies.push(player.id);
    turmoil.delegateReserve.clear();

    expect(player.canPlay(card)).is.false;
  });

  it('Can play - 0 colonies, 0 delegates', () => {
    setRulingParty(game, PartyName.UNITY);
    turmoil.delegateReserve.clear();

    expect(card.canPlay(player)).is.true;
  });

  it('Can play - 2 colonies, 7 delegates', () => {
    luna.colonies.push(player.id);
    ganymede.colonies.push(player.id);

    expect(turmoil.getAvailableDelegateCount(player)).eq(7);

    const marsFirst = turmoil.getPartyByName(PartyName.MARS);
    const greens = turmoil.getPartyByName(PartyName.GREENS);
    card.play(player);
    runAllActions(player.game);

    let selectParty = cast(player.popWaitingFor(), SelectParty);
    selectParty.cb(marsFirst.name);

    expect(turmoil.getAvailableDelegateCount(player)).eq(6);

    runAllActions(game);
    selectParty = cast(player.popWaitingFor(), SelectParty);
    selectParty.cb(greens.name);
    runAllActions(game);

    expect(turmoil.getAvailableDelegateCount(player)).eq(5);
    expect(marsFirst.delegates.get(player)).eq(1);
    expect(greens.delegates.get(player)).eq(1);

    cast(player.popWaitingFor(), undefined);
  });
});

/**
 * P70 — COLONIAL ENVOYS IN THE PREMIUM SCOPE: the ELEVENTH Prelude 2 card adapted IN PLACE, the seventh POLITICAL
 * one and the first whose delegates are a SERIES of separate decisions (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1
 * + 5). The rules did not change: the requirement is Unity's (it rules, or two of the seat's delegates stand on its
 * resolution), the count is the seat's own colonies (`ColoniesHandler.coloniesOf` — two cubes on one tile are two),
 * and `manyParties` makes the political FACADE ask each delegate as its OWN grant of one
 * (`PoliticalOps.placeDelegates` → N × `PlaceDelegatesOnResolution(1)`), every one onto a resolution of the VOTING
 * AREA — never the enacted law. The work: the marker, the Redux voice of the text, and the series marker each grant
 * carries (`votePrompt.series {index, of}`) so the console's Parliament stands through all of them.
 */
describe('ColonialEnvoys — on a Turmoil Redux table', () => {
  const U = PartyName.UNITY;
  const G = PartyName.GREENS;
  const M = PartyName.MARS;
  const S = PartyName.SCIENTISTS;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: ColonialEnvoys};

  /** A two-seat Redux + Prelude 2 table in the action phase, the card in hand, 20 M€. */
  function bare(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    const card = new ColonialEnvoys();
    p1.cardsInHand.push(card);
    p1.megaCredits = 20;
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** …with Unity's law enacted (Unity rules — the first road) and Mars First · Greens · Scientists up for the vote. */
  function unityRuling(): Table {
    const t = bare();
    ([M, G, S] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    seatEnacted(t.parliament, quietResolutionOf(U));
    expect(t.parliament.rulingParty()).eq(U);
    return t;
  }

  /** …with Unity's resolution UP FOR THE VOTE (slot 0) beside Mars First and the Scientists; a fresh table's Greens rule. */
  function unityOnTheVote(): Table {
    const t = bare();
    ([U, M, S] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    expect(t.parliament.rulingParty()).not.eq(U);
    return t;
  }

  /** `n` colonies of p1, one cube on each of the table's first tiles. */
  function colonies(t: Table, n: number): void {
    for (let i = 0; i < n; i++) {
      t.game.colonies[i].addColony(t.p1);
    }
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  function play(t: Table): void {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  }

  function grant(t: Table): SelectParty {
    return cast(t.p1.getWaitingFor(), SelectParty);
  }

  /** Answer the standing grant — its continuation drives the queue on to the next grant of the series (no drain). */
  function answer(t: Table, party: PartyName): void {
    t.p1.process({type: 'party', partyName: party});
  }

  it('rule 1 — the printed card: red, 4, no tags, no VP, Unity\'s plate, P70; political, marked for Redux; the asterisk printed', () => {
    const c = new ColonialEnvoys();
    expect(c.name).eq(CardName.COLONIAL_ENVOYS);
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(4);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).is.undefined;
    expect(c.metadata.cardNumber).eq('P70');
    expect(c.behavior).deep.eq({turmoil: {sendDelegates: {count: {colonies: {}}, manyParties: true}}});
    expect(c.metadata.description, 'the Redux voice — resolutions, never parties')
      .eq('Requires that Unity is ruling or that you have 2 delegates there. Add 1 delegate per colony you have — you may add them to different resolutions.');
    expect(Object.prototype.hasOwnProperty.call(ColonialEnvoys.prototype, 'bespokePlay'), 'wholly declarative').is.false;
    expect(JSON.stringify(c.metadata.renderData), 'the scan prints the asterisk — its referent is the text\'s last clause').contains(JSON.stringify(CardRenderSymbolType.ASTERIX));
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.COLONIAL_ENVOYS];
    expect(spec?.compatibility).deep.eq(['colonies', 'turmoil']);
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  describe('rule 2 — the requirement: Unity rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = unityOnTheVote();
      colonies(t, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on Unity\'s resolution: still unplayable, «1 of 2»', () => {
      const t = unityOnTheVote();
      colonies(t, 1);
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: U, current: 1});
    });

    it('two delegates on Unity\'s resolution: playable', () => {
      const t = unityOnTheVote();
      colonies(t, 1);
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Unity rules: playable', () => {
      const t = unityRuling();
      colonies(t, 1);
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rule 3 — the count: one delegate per colony, and the reserve must cover it', () => {
    it('two in the reserve, three colonies: unplayable, the reason COUNTS it «Delegates in your reserve: 2 of 3»', () => {
      const t = unityRuling();
      colonies(t, 3);
      drainReserve(t, 2);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([
        {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['2', '3'], current: 2},
      ]);
    });

    it('exactly three in the reserve, three colonies: playable — the lobby\'s cube is not the reserve', () => {
      const t = unityRuling();
      colonies(t, 3);
      drainReserve(t, 3);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('two cubes of the player\'s on ONE tile are two colonies; a rival\'s cube is none', () => {
      const t = unityRuling();
      t.game.colonies[0].addColony(t.p1);
      t.game.colonies[0].addColony(t.p1);
      t.game.colonies[1].addColony(t.p2);
      play(t);
      expect(grant(t).votePrompt?.series).deep.eq({index: 1, of: 2});
    });

    it('no colony: the card plays EMPTY — no grant is asked, no chip, no follow-up', () => {
      const t = unityRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.find((e) => e.icon === DELEGATE_ICON), 'no reserve chip for zero delegates').is.undefined;
      expect(branch.steps.filter((s) => s.kind === 'delegateGrantFollowUp')).deep.eq([]);
      const reserve = t.parliament.reserve(t.p1);
      play(t);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.COLONIAL_ENVOYS)).is.true;
      expect(t.parliament.reserve(t.p1)).eq(reserve);
    });
  });

  describe('rule 4 — the play: a SERIES of grants, one delegate each, every one onto a resolution of the voting area', () => {
    it('three colonies: the FIRST of three grants of 1, the giver named, marked «1 of 3», every resolution up for the vote shown', () => {
      const t = unityRuling();
      colonies(t, 3);
      play(t);
      const select = grant(t);
      expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
      expect(select.parties).to.have.length(3);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(1);
      expect(select.votePrompt?.printed).eq(1);
      expect(select.votePrompt?.series).deep.eq({index: 1, of: 3});
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.COLONIAL_ENVOYS}, mode: 'reward'});
      expect(select.toModel(t.p1).votePrompt?.series, 'the marker rides the model').deep.eq({index: 1, of: 3});
    });

    it('«in a party» under Redux is a resolution UP FOR THE VOTE — the enacted law is never offered, at any step of the series', () => {
      const t = unityRuling();
      colonies(t, 3);
      play(t);
      for (const party of [M, G, M]) {
        expect(grant(t).parties).not.include(U);
        answer(t, party);
      }
    });

    it('answers X, Y, X: the reserve 6 → 3, two cubes on X and one on Y, counted 1 / 3 · 2 / 3 · 3 / 3; the lobby untouched; the ledger holds', () => {
      const t = unityRuling();
      colonies(t, 3);
      drainReserve(t, 6);
      const votes = (party: ReduxParty) => t.parliament.votesOf(t.p1, t.parliament.slotOf(party)!);
      const before = {m: votes(M), g: votes(G)};
      play(t);
      const seen: Array<unknown> = [];
      for (const party of [M, G, M]) {
        seen.push(grant(t).votePrompt?.series);
        answer(t, party);
      }
      expect(seen).deep.eq([{index: 1, of: 3}, {index: 2, of: 3}, {index: 3, of: 3}]);
      expect(t.parliament.reserve(t.p1)).eq(3);
      expect(votes(M) - before.m).eq(2);
      expect(votes(G) - before.g).eq(1);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby\'s cube is the generation\'s free vote, not the card\'s').is.true;
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.COLONIAL_ENVOYS)).is.true;
      t.parliament.assertLedger(t.game);
    });

    it('one colony: ONE lone grant — no series marker (a series of one is not a series)', () => {
      const t = unityRuling();
      colonies(t, 1);
      play(t);
      expect(grant(t).votePrompt?.count).eq(1);
      expect(grant(t).votePrompt?.series).is.undefined;
    });

    it('no resolution up for the vote: the card is played, every grant of the series is a NAMED journal line', () => {
      const t = unityRuling();
      colonies(t, 2);
      t.parliament.slots = [];
      expect(t.p1.canPlay(t.card)).is.true;
      play(t);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.COLONIAL_ENVOYS)).is.true;
      const lines = t.game.gameLog.map((m) => m.message).filter((m) => m === '${0} cannot add delegates to a resolution: no resolution is up for a vote');
      expect(lines).to.have.length(2);
    });
  });

  describe('rule 5 — the play preview: the reserve −N, the vote as a SERIES follow-up', () => {
    it('chip «−3 delegates · from the reserve»; the step: the grant follow-up for 3, one by one (`separate`); read-only', () => {
      const t = unityRuling();
      colonies(t, 3);
      const reserve = t.parliament.reserve(t.p1);
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 3, current: reserve, resulting: reserve - 3});
      expect(branch.steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 3, printed: 3, separate: true}]);
      expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
    });

    it('one colony: a lone grant follow-up — not `separate`', () => {
      const t = unityRuling();
      colonies(t, 1);
      expect(cardPlayPreview(t.p1, t.card).branches[0].steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 1, printed: 1}]);
    });

    it('an empty voting area: no vote is promised — the NAMED skip instead', () => {
      const t = unityRuling();
      colonies(t, 2);
      t.parliament.slots = [];
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note']);
      expect(steps[0]).deep.include({noteKind: 'warning', text: 'No resolution is up for a vote'});
    });
  });

  describe('rule 6 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2; off the hold-back list', () => {
      const redux = {turmoilReduxExpansion: true, coloniesExtension: true};
      expect(dealt({...redux, prelude2Expansion: true})).include(CardName.COLONIAL_ENVOYS);
      expect(dealt({...redux, prelude2Expansion: false})).not.include(CardName.COLONIAL_ENVOYS);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.COLONIAL_ENVOYS)).is.false;
    });

    it('save / reload in the middle of the series: the event is played, the delegate already placed stays placed', () => {
      const t = unityRuling();
      colonies(t, 3);
      const reserve = t.parliament.reserve(t.p1);
      play(t);
      answer(t, M);
      expect(grant(t).votePrompt?.series).deep.eq({index: 2, of: 3});
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.tableau.has(CardName.COLONIAL_ENVOYS)).is.true;
      expect(reloaded.parliament!.reserve(owner)).eq(reserve - 1);
    });

    it('MarsBot at the table (the card brought in by hand): the human\'s series is the ordinary one', () => {
      const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([M, G, S] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(U));
      const c = new ColonialEnvoys();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      game.colonies[0].addColony(human);
      game.colonies[1].addColony(human);
      expect(human.canPlay(c)).is.true;
      const reserve = parliament.reserve(human);
      human.playCard(c);
      runAllActions(game);
      expect(cast(human.getWaitingFor(), SelectParty).votePrompt?.series).deep.eq({index: 1, of: 2});
      human.process({type: 'party', partyName: G});
      runAllActions(game);
      expect(cast(human.getWaitingFor(), SelectParty).votePrompt?.series).deep.eq({index: 2, of: 2});
      human.process({type: 'party', partyName: G});
      runAllActions(game);
      expect(parliament.reserve(human)).eq(reserve - 2);
      expect(human.getWaitingFor()).is.undefined;
    });
  });
});
