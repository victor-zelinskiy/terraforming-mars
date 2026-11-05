import {expect} from 'chai';
import {TestPlayer} from '../../TestPlayer';
import {Units} from '../../../src/common/Units';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {IGame} from '../../../src/server/IGame';
import {runAllActions, testGame} from '../../TestingUtils';
import {RiseToPower} from '../../../src/server/cards/prelude2/RiseToPower';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {cast} from '../../../src/common/utils/utils';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {CardRenderSymbolType} from '../../../src/common/cards/render/CardRenderSymbolType';
import {DELEGATE_ICON, ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {computePreludeOutlooks} from '../../../src/server/preludes/preludeOutlook';

describe('RiseToPower', () => {
  let card: RiseToPower;
  let game: IGame;
  let player: TestPlayer;
  let turmoil: Turmoil;

  beforeEach(() => {
    card = new RiseToPower();
    [game, player] = testGame(1, {turmoilExtension: true});
    turmoil = game.turmoil!;
  });

  it('cannot play, not enough delegates', () => {
    turmoil.delegateReserve.clear();
    expect(card.canPlay(player)).is.false;
  });

  it('play', () => {
    expect(turmoil.getAvailableDelegateCount(player)).eq(7);
    const marsFirst = turmoil.getPartyByName(PartyName.MARS);
    const greens = turmoil.getPartyByName(PartyName.GREENS);
    expect(marsFirst.delegates.get(player)).eq(0);
    expect(greens.delegates.get(player)).eq(0);
    card.play(player);
    runAllActions(player.game);
    const action = cast(player.getWaitingFor(), SelectParty);
    action.cb(marsFirst.name);
    expect(turmoil.getAvailableDelegateCount(player)).eq(6);
    action.cb(greens.name);
    expect(turmoil.getAvailableDelegateCount(player)).eq(5);
    action.cb(greens.name);
    expect(turmoil.getAvailableDelegateCount(player)).eq(4);

    expect(marsFirst.delegates.get(player)).eq(1);
    expect(greens.delegates.get(player)).eq(2);
    expect(player.production.asUnits()).deep.eq(Units.of({megacredits: 3}));
  });
});

/**
 * P60 — RISE TO POWER IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md` §3.1, forms 1 + 5 — DECLARATIVE + POLITICAL;
 * ledger FW): the forty-second Prelude 2 card, the set's third political prelude and the first whose delegates are a
 * SERIES asked FROM THE START. The rules on a Turmoil Redux table: +3 M€ production at play; then three delegates from
 * the reserve, each its OWN grant of one (`PoliticalOps.placeDelegates {oneParty: false}` → three
 * `PlaceDelegatesOnResolution(1)` marked `votePrompt.series {index, of}`), every one onto a resolution of the VOTING
 * AREA — never the enacted law; they may go on different resolutions. The reserve must cover all three (upstream's
 * «not enough delegates» — no partial series), and the refusal NAMES the count. The classic block above stays upstream's.
 */
describe('RiseToPower — on a Turmoil Redux table', () => {
  const M = PartyName.MARS;
  const G = PartyName.GREENS;
  const S = PartyName.SCIENTISTS;
  const U = PartyName.UNITY;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RiseToPower};

  /** A two-seat Redux + Prelude 2 table at the start (the PRELUDES phase), Mars First · Greens · Scientists up for the vote. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true});
    game.phase = Phase.PRELUDES;
    const parliament = game.parliament!;
    ([M, G, S] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const card = new RiseToPower();
    p1.preludeCardsInHand.push(card);
    return {game, p1, p2, parliament, card};
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  function play(t: Table): void {
    cast(t.card.play(t.p1), undefined);
    runAllActions(t.game);
  }

  function grant(t: Table): SelectParty {
    return cast(t.p1.getWaitingFor(), SelectParty);
  }

  /** Answer the standing grant — its continuation drives the queue on to the next grant of the series. */
  function answer(t: Table, party: PartyName): void {
    t.p1.process({type: 'party', partyName: party});
  }

  it('rule 1 — the printed card: prelude, no tags, P60, declarative whole, Redux voice; political, marked for Redux; the asterisk printed', () => {
    const c = new RiseToPower();
    expect(c.type).eq(CardType.PRELUDE);
    expect(c.tags).deep.eq([]);
    expect(c.metadata.cardNumber).eq('P60');
    expect(c.behavior).deep.eq({production: {megacredits: 3}, turmoil: {sendDelegates: {count: 3, manyParties: true}}});
    expect(c.metadata.description, 'the Redux voice — resolutions, never parties')
      .eq('Increase your M€ production 3 steps. Add 3 delegates — you may add them to different resolutions.');
    expect(Object.prototype.hasOwnProperty.call(RiseToPower.prototype, 'bespokePlay'), 'wholly declarative').is.false;
    expect(JSON.stringify(c.metadata.renderData)).contains(JSON.stringify(CardRenderSymbolType.ASTERIX));
    const spec = PRELUDE2_CARD_MANIFEST.preludeCards[CardName.RISE_TO_POWER];
    expect(spec?.compatibility).eq('turmoil');
    expect(spec?.politics, 'the console creator has no classic Turmoil — Redux only').eq('redux');
  });

  it('rule 2 — the play: +3 M€ production FIRST, then the first of three grants of 1, the giver named, marked «1 of 3»', () => {
    const t = table();
    play(t);
    expect(t.p1.production.megacredits, 'the production resolves at play — before the first question').eq(3);
    const select = grant(t);
    expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
    expect(select.parties).to.have.length(3);
    expect(select.votePrompt?.source).eq('grant');
    expect(select.votePrompt?.count).eq(1);
    expect(select.votePrompt?.series).deep.eq({index: 1, of: 3});
    expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.RISE_TO_POWER}, mode: 'reward'});
    expect(select.toModel(t.p1).votePrompt?.series, 'the marker rides the model').deep.eq({index: 1, of: 3});
  });

  it('rule 3 — answers X, Y, X: the reserve −3, two cubes on X and one on Y, counted 1 / 3 · 2 / 3 · 3 / 3; the ledger holds', () => {
    const t = table();
    const reserve = t.parliament.reserve(t.p1);
    const votes = (party: ReduxParty) => t.parliament.votesOf(t.p1, t.parliament.slotOf(party)!);
    play(t);
    const seen: Array<unknown> = [];
    for (const party of [M, G, M]) {
      seen.push(grant(t).votePrompt?.series);
      answer(t, party);
    }
    expect(seen).deep.eq([{index: 1, of: 3}, {index: 2, of: 3}, {index: 3, of: 3}]);
    expect(t.parliament.reserve(t.p1)).eq(reserve - 3);
    expect(t.parliament.lobby.has(t.p1.id), 'the lobby cube is the generation free vote, not the card').is.true;
    expect(votes(M)).eq(2);
    expect(votes(G)).eq(1);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.p1.production.asUnits()).deep.eq(Units.of({megacredits: 3}));
    t.parliament.assertLedger(t.game);
  });

  it('rule 4 — «in a party» under Redux is a resolution UP FOR THE VOTE — the enacted law is never offered, at any step', () => {
    const t = table();
    t.game.phase = Phase.ACTION;
    seatEnacted(t.parliament, quietResolutionOf(U));
    const reserve = t.parliament.reserve(t.p1);
    play(t);
    for (const party of [M, S, S]) {
      expect(grant(t).parties).not.include(U);
      answer(t, party);
    }
    expect(t.parliament.reserve(t.p1)).eq(reserve - 3);
  });

  it('rule 5 — the reserve must cover all three: 2 left → unplayable with the NAMED reason «2 of 3»; 3 left → playable', () => {
    const t = table();
    drainReserve(t, 2);
    expect(t.card.canPlay(t.p1)).is.false;
    expect(unplayableReasons(t.p1, t.card)).deep.eq([
      {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['2', '3'], current: 2},
    ]);
    const u = table();
    drainReserve(u, 3);
    expect(u.card.canPlay(u.p1)).is.true;
    expect(unplayableReasons(u.p1, u.card)).deep.eq([]);
  });

  it('rule 5b — a BURN names its cause: the prelude outlook of a short reserve carries «2 of 3» (the card own hook)', () => {
    const t = table();
    drainReserve(t, 2);
    expect(t.card.unplayableReason(t.p1)).deep.eq({type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['2', '3'], current: 2});
    const outlook = computePreludeOutlooks(t.p1, [t.card], []).get(CardName.RISE_TO_POWER);
    expect(outlook?.state).eq('noEffect');
    expect(outlook?.state === 'noEffect' ? outlook.reason?.params : undefined).deep.eq(['2', '3']);
    const u = table();
    expect(u.card.unplayableReason(u.p1), 'a full reserve has nothing to say').is.undefined;
  });

  it('rule 6 — no resolution up for the vote: the card is played, the production stands, every grant is a NAMED journal line', () => {
    const t = table();
    t.parliament.slots = [];
    expect(t.card.canPlay(t.p1), 'a play still plays — the skip is named').is.true;
    play(t);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.p1.production.megacredits).eq(3);
    const lines = t.game.gameLog.map((m) => m.message).filter((m) => m === '${0} cannot add delegates to a resolution: no resolution is up for a vote');
    expect(lines).to.have.length(3);
  });

  it('rule 7 — the preview: +3 M€ production, the reserve −3, the vote as a SERIES follow-up; read-only', () => {
    const t = table();
    const reserve = t.parliament.reserve(t.p1);
    const before = JSON.stringify(t.game.serialize());
    const preview = cardPlayPreview(t.p1, t.card);
    expect(preview.kind).eq('declarative');
    const branch = preview.branches[0];
    expect(branch.effects.find((e) => e.icon === 'megacredits' && e.note === 'production')).deep.include({direction: 'gain', amount: 3});
    expect(branch.effects.find((e) => e.icon === DELEGATE_ICON)).deep.include({direction: 'cost', amount: 3, current: reserve, resulting: reserve - 3});
    expect(branch.steps).deep.eq([{kind: 'delegateGrantFollowUp', count: 3, printed: 3, separate: true}]);
    expect(JSON.stringify(t.game.serialize()), 'the preview never mutates').eq(before);
  });

  it('rule 8 — save / reload in the middle of the series: the production and the placed delegate stand, «2 of 3» is asked again', () => {
    const t = table();
    const reserve = t.parliament.reserve(t.p1);
    play(t);
    answer(t, M);
    expect(grant(t).votePrompt?.series).deep.eq({index: 2, of: 3});
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.production.megacredits).eq(3);
    expect(reloaded.parliament!.reserve(owner)).eq(reserve - 1);
    expect(reloaded.parliament!.votesOf(owner, reloaded.parliament!.slotOf(M)!)).eq(1);
  });

  it('rule 9 — dealt with Turmoil Redux + Prelude 2 (the marker); absent without Prelude 2', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getPreludeCards().map((c) => c.name);
    }
    const redux = {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true};
    expect(dealt({...redux, prelude2Expansion: true})).include(CardName.RISE_TO_POWER);
    expect(dealt({...redux, prelude2Expansion: false})).not.include(CardName.RISE_TO_POWER);
  });

  it('rule 10 — MarsBot at the table: the human\'s series is the ordinary one, the bot gains no delegate', () => {
    const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([M, G, S] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const c = new RiseToPower();
    expect(c.canPlay(human)).is.true;
    const reserve = parliament.reserve(human);
    const botVotes = parliament.votesOf(bot);
    cast(c.play(human), undefined);
    runAllActions(game);
    for (const [i, party] of [G, G, S].entries()) {
      expect(cast(human.getWaitingFor(), SelectParty).votePrompt?.series).deep.eq({index: i + 1, of: 3});
      human.process({type: 'party', partyName: party});
    }
    expect(parliament.reserve(human)).eq(reserve - 3);
    expect(parliament.votesOf(bot)).eq(botVotes);
    expect(human.getWaitingFor()).is.undefined;
  });
});
