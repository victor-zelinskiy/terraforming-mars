import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  DiscardPopularSupport, DISCARD_POPULAR_SUPPORT_TITLE, EMPTY_SUPPORT_AREA_REASON, EVERY_SUPPORT_AREA_EMPTY_REASON,
} from '../../src/server/parliament/DiscardPopularSupport';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {Server} from '../../src/server/models/ServerModel';
import {ChoiceContextSource, SelectPartyModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {POPULAR_SUPPORT_LABEL, REDUX_PARTIES} from '../../src/common/parliament/ParliamentTypes';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';

/**
 * THE SHARED STEP «DISCARD ALL NEUTRAL DELEGATES FROM ONE POPULAR SUPPORT AREA
 * OF YOUR CHOICE» (Turmoil Redux TR12 Party Sanctions): the six areas on the
 * marker, the candidates and the refused with their ONE reason, the read-only
 * twin, the named skip, the continuation run after the discard, and what the
 * discard never touches (votes on resolutions, players' delegates).
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const R = PartyName.REDS;
const CARD = 'A card that strips an area' as CardName;
const GIVER: ChoiceContextSource = {kind: 'card', card: CARD};

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, after: Array<string>};

/** A two-seat Redux table whose support areas hold exactly `support` (every other area empty). */
function table(support: Partial<Record<PartyName, number>> = {}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  for (const party of REDUX_PARTIES) {
    parliament.popularSupport.set(party, support[party] ?? 0);
  }
  return {game, p1, p2, parliament, after: []};
}

function step(t: Table): DiscardPopularSupport {
  return new DiscardPopularSupport(t.p1, GIVER, () => {
    t.after.push(`then:${t.parliament.totalPopularSupport()}`);
  });
}

function ask(t: Table): SelectParty {
  t.game.defer(step(t));
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

describe('DiscardPopularSupport — one Popular Support Area returns to the supply', () => {
  it('asks a SelectParty over the CANDIDATES, marked with all six areas («N → 0», the refused with their reason)', () => {
    const t = table({[M]: 3, [G]: 1});
    const prompt = ask(t);
    expect(prompt.parties).deep.eq([G, M]);
    expect(prompt.votePrompt, 'not a vote').is.undefined;
    expect(prompt.choiceContext).deep.eq({source: GIVER, mode: 'effect-choice'});
    const areas = prompt.supportPrompt!.areas;
    expect(prompt.supportPrompt!.source).eq('discard');
    expect(areas.map((a) => a.party)).deep.eq([...REDUX_PARTIES]);
    expect(areas.find((a) => a.party === M)).deep.eq({party: M, current: 3, resulting: 0, available: true});
    expect(areas.find((a) => a.party === G)).deep.eq({party: G, current: 1, resulting: 0, available: true});
    for (const area of areas.filter((a) => a.party !== M && a.party !== G)) {
      expect(area, area.party).deep.eq({party: area.party, current: 0, resulting: 0, available: false, reason: EMPTY_SUPPORT_AREA_REASON});
    }
    expect(t.after, 'nothing runs before the answer').deep.eq([]);
  });

  it('the marker rides the model (nesting-safe — `SelectParty.toModel`)', () => {
    const t = table({[M]: 2});
    ask(t);
    const model = Server.getWaitingFor(t.p1, t.p1.getWaitingFor()) as SelectPartyModel;
    expect(model.type).eq('party');
    expect(model.supportPrompt?.areas.find((a) => a.party === M)?.current).eq(2);
  });

  it('the answer empties THAT area into the supply — votes and delegates untouched — then runs the continuation', () => {
    const t = table({[M]: 3, [G]: 1});
    t.parliament.slots[0].votes.push({owner: 'NEUTRAL', seq: ++t.parliament.voteSeq});
    const supply = t.parliament.neutralSupply();
    const votes = t.parliament.neutralVotes();
    const reserve = t.parliament.reserve(t.p1);
    const prompt = ask(t);

    prompt.process({type: 'party', partyName: M});
    runAllActions(t.game);

    expect(t.parliament.popularSupportOf(M)).eq(0);
    expect(t.parliament.popularSupportOf(G), 'one area only').eq(1);
    expect(t.parliament.neutralSupply()).eq(supply + 3);
    expect(t.parliament.neutralVotes(), 'a neutral VOTE on a resolution is not support').eq(votes);
    expect(t.parliament.reserve(t.p1)).eq(reserve);
    t.parliament.assertLedger(t.game);
    expect(t.after, 'the continuation runs AFTER the discard (support already 1)').deep.eq(['then:1']);

    const event = t.game.events.events.find((e) => e.type === 'popular-support-discarded');
    expect(event?.impact.popularSupport).deep.eq({party: M, gained: -3, total: 0});
    expect(event?.player).eq(t.p1.color);
  });

  it('the RULING party\'s area is an ordinary candidate when it holds a stock', () => {
    const t = table();
    const ruler = t.parliament.rulingParty();
    t.parliament.popularSupport.set(ruler, 2);
    const prompt = ask(t);
    expect(prompt.parties).deep.eq([ruler]);
  });

  it('NO candidate: a NAMED skip, nothing asked — and the continuation still runs', () => {
    const t = table();
    t.game.defer(step(t));
    runAllActions(t.game);
    expect(t.p1.getWaitingFor()).is.undefined;
    expect(t.after).deep.eq(['then:0']);
    const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
    expect(skipped).deep.eq([{label: POPULAR_SUPPORT_LABEL, reason: EVERY_SUPPORT_AREA_EMPTY_REASON}]);
    expect(t.game.events.events.some((e) => e.type === 'popular-support-discarded')).is.false;
  });

  it('an area emptied between the ask and the answer is the named skip, never a silent zero', () => {
    const t = table({[M]: 2});
    const prompt = ask(t);
    t.parliament.popularSupport.set(M, 0);
    prompt.process({type: 'party', partyName: M});
    runAllActions(t.game);
    const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
    expect(skipped).deep.eq([{label: POPULAR_SUPPORT_LABEL, reason: EMPTY_SUPPORT_AREA_REASON}]);
    expect(t.after).deep.eq(['then:0']);
  });

  it('an EMPTY area is refused by the prompt itself', () => {
    const t = table({[M]: 2});
    const prompt = ask(t);
    expect(() => prompt.process({type: 'party', partyName: R})).to.throw(/Invalid party/);
    expect(t.parliament.popularSupportOf(M)).eq(2);
  });

  it('the read-only twin IS the live prompt — and asking it changes nothing', () => {
    const t = table({[M]: 3, [G]: 1});
    const before = JSON.stringify(t.parliament.serialize());
    const events = t.game.events.events.length;
    const twin = step(t).previewSelectParty();
    expect(JSON.stringify(t.parliament.serialize()), 'pure').eq(before);
    expect(t.game.events.events.length).eq(events);

    ask(t);
    const live = Server.getWaitingFor(t.p1, t.p1.getWaitingFor()) as SelectPartyModel;
    expect(twin?.title).deep.eq(live.title);
    expect(twin?.title).eq(DISCARD_POPULAR_SUPPORT_TITLE);
    expect(twin?.parties).deep.eq(live.parties);
    expect(twin?.supportPrompt).deep.eq(live.supportPrompt);
    expect(twin?.choiceContext).deep.eq(live.choiceContext);
  });

  it('the twin is undefined where nothing would be asked', () => {
    expect(step(table()).previewSelectParty()).is.undefined;
  });
});
