import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {PlaceDelegatesOnResolution, skippedPopularSupport} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {Server} from '../../src/server/models/ServerModel';
import {colonySource} from '../../src/server/inputs/choiceContext';
import {ChoiceContextSource, SelectPartyModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {
  NEUTRAL_DELEGATE_ICON, PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_NEUTRAL_DELEGATES, POPULAR_SUPPORT_LABEL, ReduxParty, REDUX_PARTIES,
  SUPPORT_LIMIT_REASON,
} from '../../src/common/parliament/ParliamentTypes';
import {cast} from '../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from './parliamentArrange';
import {runAllActions} from '../TestingUtils';

/**
 * THE SHARED STEP «ADD N DELEGATES TO A RESOLUTION», extended for a card that
 * ALSO pays the chosen resolution's party (TR03 Political Donation): the
 * `support` option, the per-party projection on the marker, the read-only
 * twin — and the ONE arithmetic of Popular Support the promise and the payout
 * both read (`Parliament.popularSupportRoom`). The colony's grant (the Redux
 * Venus) is pinned UNCHANGED here; its own rules live in `VenusRedux.spec`.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;
const CARD = 'A card that adds a delegate' as CardName;
const GIVER: ChoiceContextSource = {kind: 'card', card: CARD};

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/** A two-seat Redux table with three quiet resolutions: the Greens' (slot 0), Mars First's (slot 1), the Industrialists' (slot 2). */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
}

/** Leave exactly `n` neutral delegates in the common supply (the rest stand as neutral votes on slot 2). */
function drainNeutralSupply(parliament: Parliament, n: number): void {
  while (parliament.neutralSupply() > n) {
    parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++parliament.voteSeq});
  }
}

function ask(t: Table, quantity: number, support?: number): SelectParty {
  t.game.defer(new PlaceDelegatesOnResolution(t.p1, quantity, GIVER, support === undefined ? {} : {support}));
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

describe('Parliament.popularSupportRoom — the one arithmetic of Popular Support', () => {
  it('equals addPopularSupport on the whole grid (area × supply × n) — and asking changes nothing', () => {
    for (let current = 0; current <= PARLIAMENT_MAX_POPULAR_SUPPORT; current++) {
      for (let supply = 0; supply <= 4; supply++) {
        for (let n = 0; n <= 4; n++) {
          const {parliament} = table();
          parliament.popularSupport.set(G, current);
          drainNeutralSupply(parliament, supply);
          const before = JSON.stringify(parliament.serialize());
          const room = parliament.popularSupportRoom(G, n);
          expect(JSON.stringify(parliament.serialize()), 'the question is pure').eq(before);
          const label = `area ${current}/3 · supply ${supply} · n ${n}`;
          expect(room.current, label).eq(current);
          expect(room.printed, label).eq(n);
          expect(room.gained, label).eq(Math.min(n, PARLIAMENT_MAX_POPULAR_SUPPORT - current, supply));
          expect(room.resulting, label).eq(current + room.gained);
          const gained = parliament.addPopularSupport(G, n);
          expect(gained, `${label}: the payout is the promise`).eq(room.gained);
          expect(parliament.popularSupportOf(G), label).eq(room.resulting);
          expect(parliament.neutralSupply(), label).eq(supply - gained);
        }
      }
    }
  });

  it('names WHAT cut the number: the area first, the supply second, nothing when it all lands', () => {
    const {parliament} = table();
    expect(parliament.popularSupportRoom(G, 3)).deep.eq({current: 0, gained: 3, resulting: 3, printed: 3});
    parliament.popularSupport.set(G, 2);
    expect(parliament.popularSupportRoom(G, 3), 'one place left').deep.eq({current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'});
    parliament.popularSupport.set(G, 3);
    expect(parliament.popularSupportRoom(G, 3), 'a full area').deep.eq({current: 3, gained: 0, resulting: 3, printed: 3, limit: 'area'});
    parliament.popularSupport.set(G, 0);
    drainNeutralSupply(parliament, 2);
    expect(parliament.popularSupportRoom(G, 3), 'two left in the supply').deep.eq({current: 0, gained: 2, resulting: 2, printed: 3, limit: 'supply'});
    drainNeutralSupply(parliament, 0);
    expect(parliament.popularSupportRoom(G, 3), 'an empty supply').deep.eq({current: 0, gained: 0, resulting: 0, printed: 3, limit: 'supply'});
    // Both bind at once (one place, one delegate): the area is judged first.
    parliament.popularSupport.set(M, 2);
    parliament.slots[2].votes.pop();
    parliament.slots[2].votes.pop();
    expect(parliament.neutralSupply()).eq(0);
    parliament.slots[2].votes.pop();
    expect(parliament.neutralSupply()).eq(1);
    expect(parliament.popularSupportRoom(M, 3).limit).eq('area');
  });

  it('the supply is the 14 neutral delegates minus the votes and ALL the support', () => {
    const {parliament} = table();
    for (const party of REDUX_PARTIES) {
      parliament.popularSupport.set(party as ReduxParty, 0);
    }
    const votes = parliament.neutralVotes();
    parliament.popularSupport.set(G, 3);
    parliament.popularSupport.set(M, 2);
    expect(parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - votes - 5);
  });
});

describe('PlaceDelegatesOnResolution — «then add up to N neutral delegates to that resolution\'s party»', () => {
  it('the marker carries the SERVER\'s projection for every party of the area', () => {
    const t = table();
    t.parliament.popularSupport.set(M, 2);
    t.parliament.popularSupport.set(I, 3);
    const select = ask(t, 1, 3);
    expect(select.votePrompt).deep.eq({
      source: 'grant', cost: 0, count: 1, printed: 1,
      support: [
        {party: G, current: 0, gained: 3, resulting: 3, printed: 3},
        {party: M, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'},
        {party: I, current: 3, gained: 0, resulting: 3, printed: 3, limit: 'area'},
      ],
    });
    expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CARD}, mode: 'reward'});
  });

  it('the answer places the delegate from the RESERVE, then the chosen party takes its neutral delegates — and they never stand on the card voted for', () => {
    const t = table();
    const {game, p1, parliament} = t;
    const reserve = parliament.reserve(p1);
    const supply = parliament.neutralSupply();
    const neutralOnSlot = parliament.neutralVotes(parliament.slots[0]);
    ask(t, 1, 3);
    p1.process({type: 'party', partyName: G});
    runAllActions(game);
    expect(parliament.votesOf(p1, parliament.slots[0])).eq(1);
    expect(parliament.reserve(p1)).eq(reserve - 1);
    expect(parliament.lobby.has(p1.id), 'the lobby\'s free delegate is not the grant\'s to spend').is.true;
    expect(parliament.popularSupportOf(G)).eq(3);
    expect(parliament.popularSupportOf(M), 'only the chosen resolution\'s party').eq(0);
    expect(parliament.neutralSupply()).eq(supply - 3);
    expect(parliament.neutralVotes(parliament.slots[0]), 'support lies in the AREA, not on the card').eq(neutralOnSlot);
    const lines = game.gameLog.map((m) => m.message);
    const delegate = lines.lastIndexOf('${0} added ${1} delegate(s) from the reserve to ${2}');
    const support = lines.lastIndexOf('${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})');
    expect(delegate, 'the delegate is journalled').gte(0);
    expect(support, '«then»: the support follows the delegate').gt(delegate);
    parliament.assertLedger(game);
    // …and beside the journal lines, the two TYPED facts (a chain with rows of its own hides a text-only line).
    const resolution = parliament.resolutionOf(parliament.slots[0].instance).id;
    expect(game.events.events.filter((e) => e.type === 'delegates-placed').map((e) => e.impact.delegates)).deep.eq([{count: 1, resolution}]);
    expect(game.events.events.filter((e) => e.type === 'popular-support-gained').map((e) => e.impact.popularSupport)).deep.eq([{party: G, gained: 3, total: 3}]);
  });

  it('a party with ONE place left takes one — and the answer re-reads the room', () => {
    const t = table();
    t.parliament.popularSupport.set(M, 2);
    ask(t, 1, 3);
    t.p1.process({type: 'party', partyName: M});
    expect(t.parliament.popularSupportOf(M)).eq(3);
    expect(t.game.events.events.some((e) => e.type === 'effect-skipped'), 'one landed: nothing is skipped').is.false;
  });

  it('a supply of two pays two', () => {
    const t = table();
    drainNeutralSupply(t.parliament, 2);
    const select = ask(t, 1, 3);
    expect(select.votePrompt?.support?.[0]).deep.eq({party: G, current: 0, gained: 2, resulting: 2, printed: 3, limit: 'supply'});
    t.p1.process({type: 'party', partyName: G});
    expect(t.parliament.popularSupportOf(G)).eq(2);
    expect(t.parliament.neutralSupply()).eq(0);
  });

  for (const scenario of [
    {name: 'a FULL area', limit: 'area' as const, arrange: (p: Parliament) => p.popularSupport.set(G, 3)},
    {name: 'an EMPTY supply', limit: 'supply' as const, arrange: (p: Parliament) => drainNeutralSupply(p, 0)},
  ]) {
    it(`${scenario.name}: the delegate still lands and the lost support is a NAMED record in the forecast's own words`, () => {
      const t = table();
      const {game, p1, parliament} = t;
      scenario.arrange(parliament);
      const select = ask(t, 1, 3);
      const promised = select.votePrompt!.support!.find((row) => row.party === G)!;
      expect(promised.gained).eq(0);
      expect(promised.limit).eq(scenario.limit);
      const before = parliament.popularSupportOf(G);
      p1.process({type: 'party', partyName: G});
      runAllActions(game);
      expect(parliament.votesOf(p1, parliament.slots[0]), 'the first effect is paid').eq(1);
      expect(parliament.popularSupportOf(G)).eq(before);
      const facts = game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
      // The record repeats the promise: the label, the printed magnitude, the cause by what cut it.
      const described = skippedPopularSupport(promised);
      expect(facts).deep.eq([{
        label: POPULAR_SUPPORT_LABEL,
        reason: SUPPORT_LIMIT_REASON[scenario.limit],
        effect: {direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: 3},
      }]);
      expect(facts[0]?.label).eq(described.skipped.label);
      expect(facts[0]?.reason).eq(described.reason);
      expect(game.gameLog.filter((m) => m.message === '${0} — effect skipped: ${1} (${2})')).has.length(1);
    });
  }

  describe('previewSelectParty — the read-only twin', () => {
    it('is the LIVE prompt, field for field (title, button, parties, the marker with its projection, the giver)', () => {
      const t = table();
      t.parliament.popularSupport.set(M, 2);
      const step = new PlaceDelegatesOnResolution(t.p1, 1, GIVER, {support: 3});
      const before = JSON.stringify(Game.deserialize(t.game.serialize()).serialize());
      const events = t.game.events.events.length;
      const logs = t.game.gameLog.length;
      const preview = step.previewSelectParty()!;
      expect(t.game.events.events.length, 'no event').eq(events);
      expect(t.game.gameLog.length, 'no journal line').eq(logs);
      expect(t.p1.getWaitingFor(), 'nothing is asked').is.undefined;
      expect(JSON.stringify(Game.deserialize(t.game.serialize()).serialize()), 'the state is untouched').eq(before);

      t.game.defer(step);
      runAllActions(t.game);
      const live = Server.getPlayerModel(t.p1).waitingFor as SelectPartyModel;
      expect(live.type).eq('party');
      expect(preview.title).deep.eq(live.title);
      expect(preview.buttonLabel).eq(live.buttonLabel);
      expect(preview.parties).deep.eq(live.parties);
      expect(preview.votePrompt).deep.eq(live.votePrompt);
      expect(preview.choiceContext).deep.eq(live.choiceContext);
    });

    it('is undefined in exactly the branches where the step asks nothing', () => {
      // No parliament.
      const [plain, plainPlayer] = testGame(2);
      expect(new PlaceDelegatesOnResolution(plainPlayer, 1, GIVER, {support: 3}).previewSelectParty()).is.undefined;
      expect(plain.gameLog.some((m) => m.message.includes('cannot add delegates')), 'and it journals nothing').is.false;
      // An empty voting area.
      const empty = table();
      empty.parliament.slots = [];
      expect(new PlaceDelegatesOnResolution(empty.p1, 1, GIVER, {support: 3}).previewSelectParty()).is.undefined;
      // An empty reserve (the lobby's cube does not count).
      const spent = table();
      while (spent.parliament.reserve(spent.p1) > 0) {
        spent.parliament.placeVote(spent.p1, spent.parliament.slots[0], 'reserve');
      }
      expect(spent.parliament.lobby.has(spent.p1.id)).is.true;
      expect(new PlaceDelegatesOnResolution(spent.p1, 1, GIVER, {support: 3}).previewSelectParty()).is.undefined;
    });
  });

  it('a colony\'s grant is UNCHANGED: no `support` on its marker, nothing paid to the party', () => {
    const t = table();
    t.game.defer(new PlaceDelegatesOnResolution(t.p1, 2, colonySource(ColonyName.VENUS_REDUX)));
    runAllActions(t.game);
    const select = cast(t.p1.getWaitingFor(), SelectParty);
    expect(select.votePrompt).deep.eq({source: 'grant', cost: 0, count: 2, printed: 2});
    t.p1.process({type: 'party', partyName: G});
    expect(t.parliament.votesOf(t.p1, t.parliament.slots[0])).eq(2);
    expect(t.parliament.popularSupportOf(G)).eq(0);
    expect(t.game.events.events.filter((e) => e.type === 'delegates-placed').map((e) => e.impact.delegates?.count), 'a typed fact for every giver').deep.eq([2]);
    expect(t.game.events.events.some((e) => e.type === 'popular-support-gained')).is.false;
  });
});
