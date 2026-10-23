import {expect} from 'chai';
import {CulturalMetropolis} from '../../../src/server/cards/turmoil/CulturalMetropolis';
import {SendDelegateToArea} from '../../../src/server/deferredActions/SendDelegateToArea';
import {IGame} from '../../../src/server/IGame';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Turmoil} from '../../../src/server/turmoil/Turmoil';
import {testGame} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {TileType} from '../../../src/common/TileType';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {DELEGATE_ICON} from '../../../src/common/parliament/ParliamentTypes';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {runAllActions} from '../../TestingUtils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

describe('Cultural Metropolis', () => {
  let card: CulturalMetropolis;
  let player: TestPlayer;
  let game: IGame;
  let turmoil: Turmoil;

  beforeEach(() => {
    card = new CulturalMetropolis();
    [game, player/* , player2 */] = testGame(2, {turmoilExtension: true});
    turmoil = game.turmoil!;
  });

  it('Can not play without energy production', () => {
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    expect(card.canPlay(player)).is.not.true;
  });


  it('Can not play without two delegate in unity or unity ruling', () => {
    player.production.add(Resource.ENERGY, 1);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Can not play without 2 delegates available', () => {
    player.production.add(Resource.ENERGY, 1);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    while (turmoil.getAvailableDelegateCount(player) > 2) {
      turmoil.sendDelegateToParty(player, PartyName.REDS, game);
    }
    expect(turmoil.getAvailableDelegateCount(player)).to.equal(2);
    expect(card.canPlay(player)).is.true;
    turmoil.sendDelegateToParty(player, PartyName.REDS, game);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Can not play without an available city space', () => {
    player.production.add(Resource.ENERGY, 1);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);

    const availableCitySpaces = [...game.board.getAvailableSpacesForCity(player)];
    const savedSpace = availableCitySpaces.pop()!;
    for (const space of availableCitySpaces) {
      game.simpleAddTile(player, space, {tileType: TileType.GREENERY});
    }

    expect(card.canPlay(player)).is.true;

    game.simpleAddTile(player, savedSpace, {tileType: TileType.GREENERY});

    expect(card.canPlay(player)).is.false;
  });

  it('Should play', () => {
    const unity = turmoil.getPartyByName(PartyName.UNITY);
    const startingUnityDelegateCount = unity.delegates.size;

    player.production.add(Resource.ENERGY, 1);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);

    expect(unity.delegates.size).eq(startingUnityDelegateCount + 2);
    expect(turmoil.getAvailableDelegateCount(player)).to.equal(5);
    expect(card.canPlay(player)).is.true;

    card.play(player);
    expect(game.deferredActions).has.lengthOf(2);
    player.game.deferredActions.pop(); // Pop out the city placement deferred action
    const action = cast(player.game.deferredActions.pop(), SendDelegateToArea);
    const options = action.execute();
    options!.cb(PartyName.UNITY);

    expect(player.production.energy).to.eq(0);
    expect(player.production.megacredits).to.eq(3);
    expect(unity.delegates.size).eq(startingUnityDelegateCount + 4);
  });
});

/**
 * T03 — CULTURAL METROPOLIS ON A TURMOIL REDUX TABLE: the first classic card
 * whose political EFFECT moves onto the facade (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md`
 * §3.1). The card is wholly declarative now — `behavior.turmoil.sendDelegates`:
 * availability is `politics.delegatesInReserve`, the placement
 * `politics.placeDelegates` → the shared grant step (`PlaceDelegatesOnResolution`,
 * TR03's body) — and its play has TWO doors: the city's cell (the staged one)
 * and the vote (a live follow-up of the same flow). Every rule is pinned here.
 */
describe('CulturalMetropolis — on a Turmoil Redux table', () => {
  const U = PartyName.UNITY;

  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: CulturalMetropolis};

  /** A two-seat Redux table (Colonies on) in the action phase, the card in hand, 40 M€, 1 energy production. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new CulturalMetropolis();
    p1.cardsInHand.push(card);
    p1.megaCredits = 40;
    p1.production.add(Resource.ENERGY, 1);
    return {game, p1, p2, parliament: game.parliament!, card};
  }

  /** Three QUIET real resolutions up for the vote — Unity's in slot 0 (Unity · Mars First · the Greens). */
  function parliamentTable(): Table {
    const t = table();
    ([U, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    return t;
  }

  /** Unity rules: its quiet resolution stands enacted (seated first — the area's refill then never deals it). */
  function unityRuling(): Table {
    const t = table();
    seatEnacted(t.parliament, quietResolutionOf(U));
    ([PartyName.MARS, PartyName.GREENS, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
    expect(t.parliament.rulingParty()).eq(U);
    return t;
  }

  /** Leave exactly `n` delegates in p1's reserve (the rest stand on the last slot). */
  function drainReserve(t: Table, n: number): void {
    const slot = t.parliament.slots[t.parliament.slots.length - 1];
    while (t.parliament.reserve(t.p1) > n) {
      t.parliament.placeVote(t.p1, slot, 'reserve');
    }
  }

  /** Play the card for real (past the requirement gate) and stop at its first question — the city's cell. */
  function playToCell(t: Table): SelectSpace {
    t.p1.playCard(t.card);
    runAllActions(t.game);
    return cast(t.p1.getWaitingFor(), SelectSpace);
  }

  it('rule 1 — the printed card: green, 20, city + building, Unity\'s plate, T03; wholly declarative', () => {
    const c = new CulturalMetropolis();
    expect(c.name).eq(CardName.CULTURAL_METROPOLIS);
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(20);
    expect(c.tags).deep.eq([Tag.CITY, Tag.BUILDING]);
    expect(requiredPartyOf(c)).eq(U);
    expect(c.metadata.cardNumber).eq('T03');
    expect(c.behavior).deep.eq({production: {energy: -1, megacredits: 3}, city: {}, turmoil: {sendDelegates: {count: 2}}});
    // No bespoke reading of the classic engine is left — the facade is the only political door.
    expect(Object.prototype.hasOwnProperty.call(CulturalMetropolis.prototype, 'bespokeCanPlay')).is.false;
    expect(Object.prototype.hasOwnProperty.call(CulturalMetropolis.prototype, 'bespokePlay')).is.false;
  });

  describe('the requirement: Unity rules, or 2 of your delegates on its resolution (T04\'s roads)', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on its resolution: «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: U, current: 1});
    });

    it('Unity\'s resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.GREENS, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: U, partyOffVote: true});
    });

    it('two delegates on its resolution: playable, no reason', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('Unity rules: playable, no reason', () => {
      const t = unityRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a card-granted Unity EFFECT is not a road (FAQ p.19)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, U, CardName.PR_OFFICE);
      expect(t.game.politics!.hasPartyEffect(t.p1, U)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — the reserve: 2 delegates must be there to place', () => {
    it('one in the reserve: unplayable, the reason COUNTS it «Delegates in your reserve: 1 of 2»', () => {
      const t = unityRuling();
      drainReserve(t, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([
        {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: ['1', '2'], current: 1},
      ]);
    });

    it('exactly two in the reserve: playable — and the lobby\'s cube is not the reserve', () => {
      const t = unityRuling();
      drainReserve(t, 2);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  it('rule 1 — energy production 0: unplayable with the ordinary production reason', () => {
    const t = unityRuling();
    t.p1.production.add(Resource.ENERGY, -1);
    expect(t.p1.canPlay(t.card)).is.false;
    expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'production', message: 'Cannot reduce production'}]);
  });

  it('rule 1 — no space for the city: unplayable, the PLACEMENT reason', () => {
    const t = unityRuling();
    for (const space of t.game.board.getAvailableSpacesForCity(t.p1)) {
      t.game.simpleAddTile(t.p2, space, {tileType: TileType.GREENERY});
    }
    expect(t.p1.canPlay(t.card)).is.false;
    expect(unplayableReasons(t.p1, t.card).map((r) => r.message)).contains('No space available for the tile');
  });

  describe('the play — production, THEN the city, THEN 2 delegates on ONE resolution', () => {
    it('the city\'s cell comes first; its answer raises ONE grant prompt for 2, the giver named, every resolution shown', () => {
      const t = unityRuling();
      const cell = playToCell(t);
      expect(t.p1.production.energy).eq(0);
      expect(t.p1.production.megacredits).eq(3);
      const space = cell.spaces[0];
      t.p1.process({type: 'space', spaceId: space.id});
      runAllActions(t.game);
      expect(space.tile?.tileType).eq(TileType.CITY);
      const select = cast(t.p1.getWaitingFor(), SelectParty);
      expect(select.parties).to.have.members(t.parliament.partiesInVotingArea());
      expect(select.parties).to.have.length(3);
      expect(select.votePrompt?.source).eq('grant');
      expect(select.votePrompt?.count).eq(2);
      expect(select.votePrompt?.printed).eq(2);
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.CULTURAL_METROPOLIS}, mode: 'reward'});
    });

    it('both cubes leave the RESERVE for the ONE chosen resolution; the lobby is untouched; the ledger holds', () => {
      const t = unityRuling();
      const reserve = t.parliament.reserve(t.p1);
      const cell = playToCell(t);
      t.p1.process({type: 'space', spaceId: cell.spaces[0].id});
      runAllActions(t.game);
      t.p1.process({type: 'party', partyName: PartyName.GREENS});
      runAllActions(t.game);
      const greens = t.parliament.slotOf(PartyName.GREENS)!;
      expect(t.parliament.votesOf(t.p1, greens)).eq(2);
      expect(t.parliament.votesOf(t.p1)).eq(2);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 2);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby\'s cube is the generation\'s free vote, not the card\'s').is.true;
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.p1.tableau.has(CardName.CULTURAL_METROPOLIS)).is.true;
      t.parliament.assertLedger(t.game);
    });

    it('no resolution up for the vote (Unity rules): the card is played, the city lands, the grant is a NAMED journal line', () => {
      const t = unityRuling();
      t.parliament.slots = [];
      expect(t.p1.canPlay(t.card)).is.true;
      const cell = playToCell(t);
      t.p1.process({type: 'space', spaceId: cell.spaces[0].id});
      runAllActions(t.game);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.game.gameLog.map((m) => m.message)).contains('${0} cannot add delegates to a resolution: no resolution is up for a vote');
    });
  });

  describe('rule 3 — the play preview: two doors, the count read from the grant', () => {
    it('production chips, the reserve chip −2 → the staged CITY cell → the vote as a live follow-up for 2', () => {
      const t = unityRuling();
      const reserve = t.parliament.reserve(t.p1);
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind).eq('declarative');
      const branch = preview.branches[0];
      const delegate = branch.effects.find((e) => e.icon === DELEGATE_ICON);
      expect(delegate).deep.include({direction: 'cost', amount: 2, current: reserve, resulting: reserve - 2});
      expect(branch.effects.some((e) => e.icon === Resource.ENERGY && e.note === 'production' && e.direction === 'cost')).is.true;
      expect(branch.effects.some((e) => e.icon === Resource.MEGACREDITS && e.note === 'production' && e.amount === 3)).is.true;
      expect(branch.steps.map((s) => s.kind)).deep.eq(['boardPlacement', 'delegateGrantFollowUp']);
      const city = branch.steps[0];
      expect(city.kind === 'boardPlacement' && city.staged !== undefined, 'the city\'s cell is the STAGED door').is.true;
      expect(branch.steps[1]).deep.eq({kind: 'delegateGrantFollowUp', count: 2, printed: 2});
      expect(t.parliament.reserve(t.p1), 'the preview never mutates').eq(reserve);
    });

    it('an empty voting area: no vote is promised — the NAMED skip instead', () => {
      const t = unityRuling();
      t.parliament.slots = [];
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['boardPlacement', 'note']);
      expect(steps[1]).deep.include({noteKind: 'warning', text: 'No resolution is up for a vote'});
    });
  });

  it('save / reload under the grant: the card, its production and the city stand; the question is asked again', () => {
    const t = unityRuling();
    const cell = playToCell(t);
    const space = cell.spaces[0];
    t.p1.process({type: 'space', spaceId: space.id});
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.tableau.has(CardName.CULTURAL_METROPOLIS)).is.true;
    expect(owner.production.megacredits).eq(3);
    expect(reloaded.board.getSpaceOrThrow(space.id).tile?.tileType).eq(TileType.CITY);
  });
});

describe('CulturalMetropolis — the classic reason keeps upstream\'s line', () => {
  it('one delegate short in the classic engine: «Not enough available delegates», never a Redux count', () => {
    const [game, player] = testGame(2, {turmoilExtension: true});
    const turmoil = game.turmoil!;
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    turmoil.sendDelegateToParty(player, PartyName.UNITY, game);
    while (turmoil.getAvailableDelegateCount(player) > 1) {
      turmoil.sendDelegateToParty(player, PartyName.REDS, game);
    }
    const reasons = unplayableReasons(player, new CulturalMetropolis());
    expect(reasons).to.deep.include({type: 'party', message: 'Not enough available delegates'});
    expect(reasons.some((r) => r.message === 'Delegates in your reserve: ${0} of ${1}')).is.false;
  });
});
