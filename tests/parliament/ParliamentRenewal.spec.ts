import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {SerializedPhaseSummary, SerializedRenewalEvent} from '../../src/server/parliament/SerializedParliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {
  answerStandingGates, endGenerationThroughParliament, passToParliament, quietResolutionOf, REDS_STAND_IN, SCIENTISTS_STAND_IN, seatResolution,
  settleParliamentGates,
} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {ReduxParty, ResolutionInstanceId, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {BIODOME_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {CLIMATE_RESEARCH_ID} from '../../src/server/parliament/resolutions/greens/ClimateResearch';
import {CLOUD_DEVELOPMENT_ID} from '../../src/server/parliament/resolutions/unity/CloudDevelopment';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';

/*
 * THE RENEWAL JOURNAL («Обновление», 2026-09-22) — the refresh of the voting
 * area as an ORDERED list of physical events (`SerializedRenewalEvent`): the
 * losers leave (their delegates home first, per owner), the discard turns
 * over into a new deck (possibly mid-deal), a revealed card is rejected and
 * discarded, a card is dealt into its slot, a party's support becomes votes,
 * a slot stays empty, a free delegate enters a lobby. The client plays the
 * journal and nothing else, so the journal must be exactly what happened —
 * which is what the REPLAY below proves: applied to the table as it stood
 * before the sitting, the journal produces the table the sitting left.
 *
 * The seven scenarios of a SMALL deck (the prompt's table §5): the real
 * catalog holds three parties, so past the first enactment two parties fit
 * at most and «the deck is empty» is the norm, not an edge.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

const instance = (id: string): ResolutionInstanceId => resolutionInstanceId(id, 0);
const BIODOME = instance(BIODOME_CONTEST_ID);
const CLIMATE = instance(CLIMATE_RESEARCH_ID);
const CLOUD = instance(CLOUD_DEVELOPMENT_ID);
const ARCHITECTURE = instance(ARCHITECTURE_AWARD_ID);
const GRID = instance(CENTRAL_POWER_GRID_ID);
const REDS = instance(REDS_STAND_IN);
const SCIENTISTS = instance(SCIENTISTS_STAND_IN);

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/**
 * A two-seat Redux game with three QUIET real resolutions on the table — the Greens', Mars First's and the
 * Industrialists', in that slot order. Seated by PARTY, never taken from the deal: since Colonial Affairs
 * (RX07) the deck of every game holds FOUR real parties, so the setup may deal Unity into the area and a
 * scenario written for «the Greens win, the deck holds…» would find no Industrialists card on the table.
 */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
}

/**
 * …and the FOUR-PARTY table of a Venus game (Cloud Development is Unity's): the generation-1 area is Unity /
 * Mars First / the Industrialists, the Greens rule by the starting rule and their three cards make the deck.
 */
function fourPartyTable(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatResolution(parliament, 0, CLOUD);
  seatResolution(parliament, 1, ARCHITECTURE);
  seatResolution(parliament, 2, GRID);
  return {game, p1, p2, parliament};
}

function slotOfParty(parliament: Parliament, party: ReduxParty): number {
  const index = parliament.slots.findIndex((slot) => parliament.resolutionOf(slot.instance).party === party);
  if (index < 0) {
    throw new Error(`no ${party} card on the table`);
  }
  return index;
}

/** The pool as it stands — deck, discard, area, government. */
type Snapshot = {
  deck: Array<ResolutionInstanceId>, discard: Array<ResolutionInstanceId>, slots: Array<ResolutionInstanceId>,
  enacted: ResolutionInstanceId | undefined, support: Map<ReduxParty, number>, lobby: Set<string>,
};

function snapshot(parliament: Parliament): Snapshot {
  return {
    deck: [...parliament.deck], discard: [...parliament.discard], slots: parliament.slots.map((s) => s.instance),
    enacted: parliament.enacted, support: new Map(parliament.popularSupport), lobby: new Set(parliament.lobby),
  };
}

function kinds(journal: ReadonlyArray<SerializedRenewalEvent>): Array<string> {
  return journal.map((e) => e.kind);
}

/** The journal's shape WITHOUT the support events (each of those is pinned to its own deal by the replay). */
function moves(journal: ReadonlyArray<SerializedRenewalEvent>): Array<string> {
  return kinds(journal).filter((k) => k !== 'support');
}

function summaryOf(parliament: Parliament): SerializedPhaseSummary {
  const summary = parliament.lastPhase;
  if (summary === undefined) {
    throw new Error('no finished sitting');
  }
  return summary;
}

/**
 * THE REPLAY: apply the journal to the table as it stood BEFORE the sitting
 * (after the enactment moved the winner into the government and the old law
 * into the discard — those two moves are the enactment's, not the renewal's)
 * and demand the table the sitting LEFT. Every event is checked for its own
 * physical precondition (a card leaves a slot it stood in, is dealt off the
 * deck it lay in, is rejected off that deck; a reshuffle finds an empty deck
 * and reports the pile it turns over). A rejected card is held ASIDE until the
 * draw ends — the server's own rule: a reshuffle mid-draw must not deal it
 * again — and joins the discard with the deal (or the empty slot) that ends
 * the draw.
 */
function replay(before: Snapshot, summary: SerializedPhaseSummary, parliament: Parliament, after: Snapshot): void {
  const journal = summary.renewal ?? [];
  const deck = [...before.deck];
  const discard = [...before.discard, ...(before.enacted === undefined ? [] : [before.enacted])];
  const slots: Array<ResolutionInstanceId> = [];
  const area = before.slots.filter((i) => i !== summary.winner.instance);
  const aside: Array<ResolutionInstanceId> = [];
  let filled = 0;
  const votes = new Map<ResolutionInstanceId, number>();
  const lobby = new Set<string>();
  // The stock the deal moves is the stock AFTER the sitting's own support step (the grants the summary records).
  const support = new Map(before.support);
  for (const grant of summary.support) {
    support.set(grant.party as ReduxParty, (support.get(grant.party as ReduxParty) ?? 0) + grant.gained);
  }
  let reshuffled = false;
  const take = (pile: Array<ResolutionInstanceId>, card: ResolutionInstanceId, where: string): void => {
    const at = pile.indexOf(card);
    expect(at, `${card} lies in the ${where}`).is.greaterThanOrEqual(0);
    pile.splice(at, 1);
  };
  const endDraw = (): void => {
    discard.push(...aside);
    aside.length = 0;
  };
  journal.forEach((event, n) => {
    const at = `event ${n} (${event.kind})`;
    switch (event.kind) {
    case 'leave':
      take(area, event.instance, 'area');
      expect(event.slot, `${at}: the physical slot the card stood in`).eq(before.slots.indexOf(event.instance));
      discard.push(event.instance);
      break;
    case 'reshuffle':
      expect(deck, `${at}: the deck is empty when the discard turns over`).deep.eq([]);
      expect(event.size, `${at}: the pile that becomes the deck`).eq(discard.length);
      deck.push(...discard);
      discard.length = 0;
      reshuffled = true;
      break;
    case 'reject': {
      take(deck, event.instance, 'deck');
      const party = parliament.resolutionOf(event.instance).party;
      const enactedParty = parliament.resolutionOf(summary.enacted).party;
      expect(event.reason, `${at}: the reason is the rule`).eq(party === enactedParty ? 'party-enacted' : 'party-in-area');
      if (event.reason === 'party-in-area') {
        expect(slots.map((i) => parliament.resolutionOf(i).party), `${at}: its party is on the table`).includes(party);
      }
      aside.push(event.instance);
      break;
    }
    case 'deal':
      take(deck, event.instance, 'deck');
      expect(event.slot, `${at}: slots fill in order`).eq(filled++);
      expect(event.source, `${at}: off the deck as it was, or the reshuffled one`).eq(reshuffled ? 'reshuffled' : 'deck');
      slots.push(event.instance);
      endDraw();
      break;
    case 'support': {
      expect(journal[n - 1]?.kind, `${at}: the support follows its deal at once`).eq('deal');
      expect(slots[slots.length - 1], `${at}: the support lands on the card just dealt`).eq(event.instance);
      expect(parliament.resolutionOf(event.instance).party, `${at}: of its own party`).eq(event.party);
      expect(event.count, `${at}: the party's whole stock`).eq(support.get(event.party as ReduxParty) ?? 0);
      support.set(event.party as ReduxParty, 0);
      votes.set(event.instance, event.count);
      break;
    }
    case 'empty':
      expect(event.slot, `${at}: the empty slot is the next one`).eq(filled++);
      endDraw();
      break;
    case 'lobby':
      lobby.add(event.player);
      break;
    }
  });
  expect(area, 'every loser left').deep.eq([]);
  expect(aside, 'nothing is left aside once the deal is over').deep.eq([]);
  expect(slots, 'the area the journal builds is the area that stands').deep.eq(after.slots);
  expect(new Set(deck), 'the deck the journal leaves is the deck that stands').deep.eq(new Set(after.deck));
  expect(new Set(discard), 'the discard the journal leaves is the discard that stands').deep.eq(new Set(after.discard));
  for (const slot of parliament.slots) {
    expect(parliament.neutralVotes(slot), `neutral votes on ${slot.instance}`).eq(votes.get(slot.instance) ?? 0);
    expect(parliament.popularSupportOf(parliament.resolutionOf(slot.instance).party), 'a dealt party keeps no stock').eq(0);
  }
  expect(lobby, 'the lobby events are the refilled seats').deep.eq(new Set(summary.lobbyRefilled));
  // …and the three derived lists say the same thing as the journal, in less.
  expect(summary.discarded, 'the losers, in slot order').deep.eq(journal.filter((e) => e.kind === 'leave').map((e) => (e as {instance: string}).instance));
  expect(summary.refreshed.map((f) => f.instance)).deep.eq(journal.filter((e) => e.kind === 'deal').map((e) => (e as {instance: string}).instance));
  expect(summary.refreshed.map((f) => f.neutralVotes)).deep.eq(summary.refreshed.map((f) => votes.get(f.instance) ?? 0));
}

/** Answer every standing resolution ask with the plainest legal answer (a winner's tile: the first cell), then walk the gates. */
function answerAsks(game: IGame): void {
  for (let round = 0; round < 12; round++) {
    // Only while the PHASE stands: past its end the next generation's own prompts (research, the action menu) are nobody's business here.
    if (game.parliament?.phase === undefined) {
      return;
    }
    let answered = false;
    for (const player of game.playersInGenerationOrder) {
      const wf = player.getWaitingFor();
      if (wf === undefined || wf.parliamentPhasePrompt !== undefined) {
        continue;
      }
      if (wf instanceof SelectSpace) {
        player.process({type: 'space', spaceId: wf.spaces[0].id});
      } else if (wf instanceof SelectCard) {
        player.process({type: 'card', cards: wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name]});
      } else if (wf instanceof OrOptions) {
        player.process({type: 'or', index: 0, response: {type: 'option'}});
      } else {
        throw new Error(`cannot answer a "${wf.type}" prompt of ${player.color}`);
      }
      runAllActions(game);
      answered = true;
    }
    if (!answered) {
      settleParliamentGates(game);
    }
  }
}

/** Run the sitting to its end and hand back the journal with the before / after tables. */
function sit(t: Table): {before: Snapshot, after: Snapshot, summary: SerializedPhaseSummary, journal: ReadonlyArray<SerializedRenewalEvent>} {
  const before = snapshot(t.parliament);
  endGenerationThroughParliament(t.game);
  answerAsks(t.game);
  expect(t.parliament.phase, `the phase is over (step ${t.parliament.phase?.step}, prompts ${t.game.playersInGenerationOrder.map((p) => p.getWaitingFor()?.type ?? '-').join(' ')})`).is.undefined;
  const summary = summaryOf(t.parliament);
  const after = snapshot(t.parliament);
  replay(before, summary, t.parliament, after);
  t.parliament.assertLedger(t.game);
  return {before, after, summary, journal: summary.renewal ?? []};
}

describe('ParliamentPhase — the renewal JOURNAL (the small deck\'s seven scenarios)', () => {
  it('1 · a FULL deck: the two losers leave, three cards are dealt off the deck as it was, the support seats, the lobby refills — no reshuffle, no reject', () => {
    const t = table();
    const {parliament, p1} = t;
    // Mars wins; the deck holds three cards of three OTHER parties, so every slot is dealt straight off it.
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, M)], 'lobby');
    parliament.deck = [REDS, SCIENTISTS, BIODOME];
    parliament.discard = [];
    parliament.popularSupport.set(PartyName.REDS, 2);
    const {journal, summary} = sit(t);
    // p1 spent its lobby delegate (refilled); p2 never left the lobby. Every dealt party with a stock seats it right after its deal.
    expect(moves(journal)).deep.eq(['leave', 'leave', 'deal', 'deal', 'deal', 'lobby']);
    expect(kinds(journal).slice(2, 4), 'the Reds stock seats on the Reds card the moment it is dealt').deep.eq(['deal', 'support']);
    expect(journal.filter((e) => e.kind === 'deal').map((e) => (e as {source: string}).source)).deep.eq(['deck', 'deck', 'deck']);
    expect(journal.filter((e) => e.kind === 'deal').map((e) => (e as {instance: string}).instance)).deep.eq([REDS, SCIENTISTS, BIODOME]);
    // The Reds' stock (2 + the sitting's absent grant, capped by the supply) became votes on their card.
    const support = journal.find((e) => e.kind === 'support') as {party: string, instance: string, count: number};
    expect(support.party).eq(PartyName.REDS);
    expect(support.instance).eq(REDS);
    expect(support.count).eq(summary.refreshed[0].neutralVotes);
    expect(support.count).is.greaterThanOrEqual(2);
    expect(parliament.popularSupportOf(PartyName.REDS)).eq(0);
  });

  it('2 · an EMPTY deck, both losers dealt straight back: they leave, the discard becomes the deck, both are dealt again (reshuffled), the third slot stays empty', () => {
    const t = table();
    const {parliament, p1} = t;
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, M)], 'lobby');
    // Nothing anywhere but the table: the losers are the whole pool the deal can draw from.
    parliament.deck = [];
    parliament.discard = [];
    const losers = parliament.slots.filter((s) => parliament.resolutionOf(s.instance).party !== M).map((s) => s.instance);
    const {journal} = sit(t);
    expect(moves(journal)).deep.eq(['leave', 'leave', 'reshuffle', 'deal', 'deal', 'empty', 'lobby']);
    expect(kinds(journal).filter((k) => k === 'support'), 'both loser parties were paid by the support step and seat it on their re-dealt cards').has.length(2);
    const reshuffle = journal[2] as {size: number};
    expect(reshuffle.size, 'the two losers, and nothing else, turn over').eq(2);
    const dealt = journal.filter((e) => e.kind === 'deal') as Array<{instance: string, slot: number, source: string}>;
    expect(dealt.map((d) => d.source)).deep.eq(['reshuffled', 'reshuffled']);
    expect(dealt.map((d) => d.slot)).deep.eq([0, 1]);
    expect(new Set(dealt.map((d) => d.instance)), 'the very cards that left are the cards dealt').deep.eq(new Set(losers));
    // …and NOTHING in the journal says «stayed»: a card that left and came back is two events, like any other.
    expect(journal.filter((e) => e.kind === 'leave').map((e) => (e as {instance: string}).instance)).has.members(losers);
    expect((journal.find((e) => e.kind === 'empty') as {slot: number}).slot).eq(2);
  });

  it('3 · ONE off the deck, then the reshuffle MID-DEAL: the journal and the table agree on the moment the discard turned over', () => {
    const t = table();
    const {parliament, p1} = t;
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, M)], 'lobby');
    parliament.deck = [REDS];
    parliament.discard = [];
    const {journal} = sit(t);
    expect(moves(journal)).deep.eq(['leave', 'leave', 'deal', 'reshuffle', 'deal', 'deal', 'lobby']);
    const dealt = journal.filter((e) => e.kind === 'deal') as Array<{instance: string, source: string}>;
    expect(dealt[0], 'the first slot is dealt off the deck as it stood').deep.include({instance: REDS, source: 'deck'});
    expect(dealt.slice(1).map((d) => d.source), 'the next two come off the reshuffled discard').deep.eq(['reshuffled', 'reshuffled']);
    expect((journal.find((e) => e.kind === 'reshuffle') as {size: number}).size).eq(2);
  });

  it('4 · a card REJECTED by its party: revealed, named with its reason, discarded, the next one dealt — both reasons occur', () => {
    const t = table();
    const {parliament, p1} = t;
    // The Greens win; the deck opens with another Greens card (the enacted party) and then a Reds card.
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, G)], 'lobby');
    parliament.deck = [BIODOME, REDS, CLIMATE];
    parliament.discard = [];
    const {journal} = sit(t);
    const rejects = journal.filter((e) => e.kind === 'reject') as Array<{instance: string, slot: number, reason: string}>;
    expect(rejects.length, 'at least one card was revealed and rejected').is.greaterThanOrEqual(1);
    expect(rejects[0], 'the Greens card on top of the deck is refused for the enacted party').deep.include({instance: BIODOME, slot: 0, reason: 'party-enacted'});
    const first = journal.findIndex((e) => e.kind === 'deal');
    expect(journal[first], 'the Reds card behind it is dealt into that slot').deep.include({instance: REDS, slot: 0, source: 'deck'});
    expect(journal.indexOf(rejects[0] as SerializedRenewalEvent), 'the reject is journalled BEFORE the deal it delayed').is.lessThan(first);
    // A second Greens card is refused for the same reason; the losers (Mars, Industrialists) fit and are dealt back.
    expect(rejects.every((r) => r.reason === 'party-enacted')).is.true;
    expect(parliament.partiesInVotingArea()).has.members([PartyName.REDS, M, I]);
  });

  it('4b · …and «party already in the area» when the deck holds two cards of one party', () => {
    const t = table();
    const {parliament, p1} = t;
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, M)], 'lobby');
    parliament.deck = [BIODOME, CLIMATE, REDS];
    parliament.discard = [];
    const {journal} = sit(t);
    const rejects = journal.filter((e) => e.kind === 'reject') as Array<{instance: string, slot: number, reason: string}>;
    expect(rejects[0], 'the second Greens card is refused: a Greens card already stands in slot 0').deep.include({instance: CLIMATE, slot: 1, reason: 'party-in-area'});
    expect(journal.filter((e) => e.kind === 'deal').map((e) => (e as {instance: string}).instance).slice(0, 2)).deep.eq([BIODOME, REDS]);
  });

  it('5 · NOTHING fits anywhere: every slot stays empty and says so — the journal names each', () => {
    const t = table();
    const {parliament, p1} = t;
    const winner = parliament.slots[slotOfParty(parliament, G)];
    parliament.placeVote(p1, winner, 'lobby');
    // The table is the winner alone; the deck and the discard are empty: there is no card of another party anywhere.
    parliament.slots = [winner];
    parliament.deck = [];
    parliament.discard = [];
    const {journal} = sit(t);
    expect(kinds(journal)).deep.eq(['empty', 'empty', 'empty', 'lobby']);
    expect(journal.slice(0, 3).map((e) => (e as {slot: number}).slot)).deep.eq([0, 1, 2]);
    expect(parliament.slots).deep.eq([]);
  });

  it('6 · a PLAYER\'s delegates on a losing card go home BEFORE the card leaves — per owner, in the leave record; the ledger is whole', () => {
    const t = table();
    const {parliament, p1, p2} = t;
    const winner = parliament.slots[slotOfParty(parliament, M)];
    parliament.placeVote(p1, winner, 'lobby');
    parliament.placeVote(p1, winner, 'reserve');
    parliament.placeVote(p1, winner, 'reserve');
    const loser = parliament.slots[slotOfParty(parliament, I)];
    parliament.placeVote(p2, loser, 'lobby');
    const neutral = parliament.addNeutralVote(loser);
    expect(neutral).is.not.undefined;
    parliament.deck = [];
    parliament.discard = [];
    const reserveBefore = parliament.reserve(p2);
    const {journal} = sit(t);
    const leave = journal.find((e) => e.kind === 'leave' && (e as {instance: string}).instance === loser.instance) as {returned: Array<{owner: string, count: number}>};
    expect(leave.returned, 'who went home off the loser, in first-placement order').deep.eq([{owner: p2.id, count: 1}, {owner: 'NEUTRAL', count: 1}]);
    const other = journal.find((e) => e.kind === 'leave' && (e as {instance: string}).instance !== loser.instance) as {returned: Array<unknown>};
    expect(other.returned, 'the other loser carried nobody').deep.eq([]);
    // The delegate is back in p2's reserve, minus the one the lobby step put back into the lobby.
    expect(parliament.reserve(p2)).eq(reserveBefore + 1 - 1);
    expect(parliament.lobby.has(p2.id)).is.true;
    // The enacted card's own returns are a different record: p1's delegate came home at the enactment.
    expect(summaryOf(parliament).returned).deep.eq([{owner: p1.id, count: 3}]);
  });

  it('7 · the FINAL sitting renews nothing: no journal, no refresh, no lobby', () => {
    const t = table();
    const {game, parliament, p1} = t;
    setTemperature(game, 8);
    setOxygenLevel(game, 14);
    maxOutOceans(p1);
    expect(game.gameIsOver()).is.true;
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    passToParliament(game);
    settleParliamentGates(game);
    runAllActions(game);
    const summary = summaryOf(parliament);
    expect(summary.final).is.true;
    expect(summary.renewal, 'the final sitting writes no renewal').is.undefined;
    expect(summary.refreshed).deep.eq([]);
    expect(summary.lobbyRefilled).deep.eq([]);
  });

  it('8 · FOUR PARTIES (a Venus game): the Greens hold no generation-1 card and rule by the starting rule — paid as absent, dealt in off the deck, their second card refused for the area, the losers back off the reshuffled discard', () => {
    const t = fourPartyTable();
    const {parliament, p1} = t;
    expect(parliament.rulingParty(), 'the starting rule').eq(PartyName.GREENS);
    expect(parliament.partiesInVotingArea(), 'and no Greens card on the table').not.includes(PartyName.GREENS);
    // Unity wins on p1's vote; the deck is two of the Greens' three cards, nothing in the discard.
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, PartyName.UNITY)], 'lobby');
    parliament.deck = [BIODOME, CLIMATE];
    parliament.discard = [];
    const losers = parliament.slots.filter((s) => parliament.resolutionOf(s.instance).party !== PartyName.UNITY).map((s) => s.instance);
    const {journal, summary} = sit(t);
    // The literal rule, from the renewal's side: the office is not a card, so the Greens were paid with the absent parties…
    expect(summary.support.find((entry) => entry.party === PartyName.GREENS)).deep.include({reason: 'absent', gained: 1});
    // …and that one cube seats on their card the moment it is dealt (slot 0, straight off the deck).
    expect(moves(journal)).deep.eq(['leave', 'leave', 'deal', 'reject', 'reshuffle', 'deal', 'deal', 'lobby']);
    expect(kinds(journal).slice(2, 4)).deep.eq(['deal', 'support']);
    const first = journal.find((e) => e.kind === 'deal') as {instance: string, slot: number, source: string};
    expect(first).deep.include({instance: BIODOME, slot: 0, source: 'deck'});
    const seated = journal.find((e) => e.kind === 'support') as {party: string, instance: string, count: number};
    expect(seated).deep.include({party: PartyName.GREENS, instance: BIODOME, count: 1});
    // The second Greens card is refused for the area (never for the office); the deck is then empty, so the
    // two losers turn over MID-DEAL — the refused card is held aside and is not among them.
    const reject = journal.find((e) => e.kind === 'reject') as {instance: string, slot: number, reason: string};
    expect(reject).deep.include({instance: CLIMATE, slot: 1, reason: 'party-in-area'});
    expect((journal.find((e) => e.kind === 'reshuffle') as {size: number}).size, 'the two losers, and nothing else').eq(2);
    const dealt = journal.filter((e) => e.kind === 'deal') as Array<{instance: string, slot: number, source: string}>;
    expect(dealt.slice(1).map((d) => d.source)).deep.eq(['reshuffled', 'reshuffled']);
    expect(new Set(dealt.slice(1).map((d) => d.instance)), 'the very cards that left').deep.eq(new Set(losers));
    expect(parliament.discard, 'the refused card joins the discard once the draw is over').deep.eq([CLIMATE]);
    // The table the sitting leaves: Unity rules BY A CARD now and holds nothing; the Greens' stock is votes.
    expect(parliament.enacted).eq(CLOUD);
    expect(parliament.rulingParty()).eq(PartyName.UNITY);
    expect(parliament.popularSupportOf(PartyName.UNITY)).eq(0);
    expect(parliament.popularSupportOf(PartyName.GREENS)).eq(0);
    expect(parliament.neutralVotes(parliament.slots[0])).eq(1);
  });

  it('the wire carries the journal with resolutions and colours resolved — one event per record, in order', () => {
    const t = table();
    const {game, parliament, p1, p2} = t;
    parliament.placeVote(p1, parliament.slots[slotOfParty(parliament, M)], 'lobby');
    parliament.placeVote(p2, parliament.slots[slotOfParty(parliament, I)], 'lobby');
    parliament.deck = [];
    parliament.discard = [];
    sit(t);
    const model = getParliamentModel(game, p1)!;
    const journal = model.lastPhase?.renewal ?? [];
    expect(journal.map((e) => e.kind)).deep.eq(kinds(summaryOf(parliament).renewal ?? []));
    const leave = journal.find((e) => e.kind === 'leave' && e.returned.length > 0);
    expect(leave?.kind === 'leave' && leave.returned[0].owner).eq(p2.color);
    expect(leave?.kind === 'leave' && leave.party).eq(I);
    expect(leave?.kind === 'leave' ? leave.resolution : '').eq(leave?.kind === 'leave' ? parliament.resolutionOf(leave.instance).id : '?');
    const lobby = journal.filter((e) => e.kind === 'lobby').map((e) => e.kind === 'lobby' ? e.player : '');
    expect(lobby).deep.eq([p1.color, p2.color]);
    // The live sitting carries it too, from the refresh on (the adjourn gate reads it before the phase closes).
    const t2 = table();
    t2.parliament.placeVote(t2.p1, t2.parliament.slots[slotOfParty(t2.parliament, M)], 'lobby');
    passToParliament(t2.game);
    answerStandingGates(t2.game, 'assembly');
    expect(t2.parliament.phase?.step).eq('adjourn');
    const live = getParliamentModel(t2.game, t2.p1)!.phase?.summary?.renewal ?? [];
    expect(live.length).is.greaterThan(0);
    expect(live[0].kind).eq('leave');
  });
});
