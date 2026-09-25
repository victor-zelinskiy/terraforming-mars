import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {influenceAtAgenda, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {seatParliamentReadingOf} from '@/client/console/parliament/seatParliamentReading';
import {READING_KICKER_SEATED, READING_KICKER_SPECTATOR} from '@/client/console/parliament/voteInfoModel';

/**
 * ONE SEAT'S STANDING (the Information zone «ПАРЛАМЕНТ»): the influence AS A
 * SUM with its sources, the Agenda, the delegates, the access, and the seat's
 * own reading of every resolution on the table — composed from the readings
 * that already exist, never re-derived. Driven with the SHIPPED catalog.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const RESEARCH = 'RDX_SCIENTISTS_JOINT_RESEARCH';

function seat(color: Color, agenda: number, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function slot(resolution: string, over: Partial<ParliamentSlotModel> = {}): ParliamentSlotModel {
  const party = getResolution(resolution)?.party as ReduxParty;
  return {instance: `${resolution}#0`, resolution, party, votes: [], totalVotes: 0, isWinning: false, tiePriority: 1, viewerVotes: 0, ...over};
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const FISH = [{name: CardName.FISH}];

describe('seatParliamentReadingOf — one seat\'s standing', () => {
  it('THE INFLUENCE IS A SUM: the Agenda track, what stands on top of it, and WHO gave each part', () => {
    const m = model([seat(BLUE, 5, {influence: influenceAtAgenda(5) + 3, influenceSources: [{amount: 1, source: 'Pallas'}, {amount: 2}]})]);
    const reading = seatParliamentReadingOf(m, BLUE, []);
    expect(reading.influence.track, 'the track\'s own level at step 5').eq(3);
    expect(reading.influence.total, 'and the server\'s total').eq(6);
    expect(reading.influence.bonus, 'the difference is what stands on top').eq(3);
    expect(reading.influence.sources.map((s) => [s.source, s.amount])).deep.eq([['Pallas', 1], [undefined, 2]]);
  });

  it('…and a seat whose influence IS the track\'s has nothing to list — never a «bonuses 0» line', () => {
    const reading = seatParliamentReadingOf(model([seat(BLUE, 5)]), BLUE, []);
    expect(reading.influence.bonus).eq(0);
    expect(reading.influence.sources).deep.eq([]);
  });

  it('THE AGENDA names the step and what the NEXT one pays — and nothing at the end of the track', () => {
    // Step 2 → the next step (3) is an influence step of 2.
    expect(seatParliamentReadingOf(model([seat(BLUE, 2)]), BLUE, []).agenda).deep.eq({position: 2, next: {kind: 'influence', influence: 2}});
    // Step 1 → the next is a TR step.
    expect(seatParliamentReadingOf(model([seat(BLUE, 1)]), BLUE, []).agenda.next).deep.eq({kind: 'tr'});
    // The end of the track pays nothing more.
    expect(seatParliamentReadingOf(model([seat(BLUE, 12)]), BLUE, []).agenda.next).is.undefined;
  });

  it('THE DELEGATES are the places and the cards the seat\'s own cubes stand on — never anybody else\'s', () => {
    const contested = slot(AQUIFER, {
      votes: [{owner: BLUE, seq: 1}, {owner: RED, seq: 2}, {owner: BLUE, seq: 3}],
      totalVotes: 3, leader: BLUE, isWinning: true,
    });
    const quiet = slot(RESEARCH, {votes: [{owner: RED, seq: 4}], totalVotes: 1, leader: RED});
    const m = model([seat(BLUE, 3, {lobby: false, reserve: 4, onResolutions: 2}), seat(RED, 1)], {slots: [contested, quiet]});
    const reading = seatParliamentReadingOf(m, BLUE, FISH);
    expect(reading.delegates.lobby).eq(false);
    expect(reading.delegates.reserve).eq(4);
    expect(reading.delegates.onResolutions, 'the server\'s own count').eq(2);
    expect(reading.delegates.onSlots.map((s) => [s.resolution, s.votes, s.leads]), 'only the cards this seat stands on')
      .deep.eq([[AQUIFER, 2, true]]);
  });

  it('THE ACCESS counts what the seat may DO, and never restates the effects themselves', () => {
    const access = [
      {party: PartyName.GREENS as ReduxParty, ruling: true, delegates: 0, byDelegates: false, granted: [], hasEffect: true, satisfiesRequirement: true},
      {party: PartyName.UNITY as ReduxParty, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false},
    ];
    const m = model([seat(BLUE, 3, {access, partyActionUses: {[PartyName.GREENS]: 1, [PartyName.REDS]: 1}, resolutionActionUses: 1})]);
    const reading = seatParliamentReadingOf(m, BLUE, []);
    expect(reading.access).deep.eq({held: 1, partyActionsUsed: 2, resolutionActionsUsed: 1});
  });

  it('THE TABLE carries the seat\'s OWN reading of every resolution up for the vote', () => {
    const m = model([seat(BLUE, 5), seat(RED, 1)], {slots: [slot(AQUIFER, {isWinning: true}), slot(RESEARCH)]});
    const reading = seatParliamentReadingOf(m, BLUE, FISH);
    expect(reading.table.map((e) => [e.resolution, e.winning])).deep.eq([[AQUIFER, true], [RESEARCH, false]]);
    // Aquifer at influence 3 pays this seat 3 animals — the vote panel's own number.
    expect(reading.table[0].reading.yields.map((y) => y.amount)).deep.eq([3]);
    expect(reading.table[0].reading.kicker, 'the viewer\'s own reading speaks in the second person').eq(READING_KICKER_SEATED);
  });

  it('…and reading ANOTHER seat speaks in the third person WITHOUT naming it — the surface already does', () => {
    const m = model([seat(BLUE, 5), seat(RED, 1)], {slots: [slot(AQUIFER)]});
    const reading = seatParliamentReadingOf(m, RED, FISH, {viewer: BLUE});
    expect(reading.table[0].reading.person, 'the third person throughout').eq('they');
    expect(reading.table[0].reading.subject, 'and no name of its own — the crumb says whose standing this is').is.undefined;
    expect(reading.table[0].reading.kicker).eq(READING_KICKER_SPECTATOR);
    expect(reading.table[0].reading.yields.map((y) => y.amount), 'the numbers are RED\'s, at RED\'s influence').deep.eq([1]);
  });

  it('A SEAT THAT TAKES NO PART (MarsBot) reads as an EMPTY standing — one honest line, never a parliament of zeros', () => {
    const m = model([seat(BLUE, 5), seat(RED, 3, {participates: false})], {slots: [slot(AQUIFER)]});
    const bot = seatParliamentReadingOf(m, RED, []);
    expect(bot.participates).eq(false);
    expect(bot.color, 'the seat is still named').eq(RED);
    expect(bot.table).deep.eq([]);
    expect(bot.influence.total).eq(0);
  });

  it('no model, no seat — an empty standing rather than an invented one', () => {
    expect(seatParliamentReadingOf(undefined, BLUE, []).participates).eq(false);
    expect(seatParliamentReadingOf(model([seat(BLUE, 3)]), undefined, []).participates).eq(false);
  });

  it('THE LAST ENACTMENT is what it PAID this seat — the record, never a recomputation', () => {
    const m = model([seat(BLUE, 5)], {
      enacted: {instance: `${AQUIFER}#9`, resolution: AQUIFER, party: getResolution(AQUIFER)?.party as ReduxParty},
      lastPhase: {
        seq: 1, generation: 1, enacted: {instance: `${AQUIFER}#9`, resolution: AQUIFER, party: getResolution(AQUIFER)?.party as ReduxParty},
        winner: {player: BLUE, instance: `${AQUIFER}#9`},
        outcomes: [{player: BLUE, kind: 'cardResource', effect: 'animals', amount: 2, influence: 3}],
        refreshed: [], support: [],
      } as unknown as ParliamentModel['lastPhase'],
    });
    const reading = seatParliamentReadingOf(m, BLUE, FISH);
    expect(reading.enacted?.resolution).eq(AQUIFER);
    expect(reading.enacted?.yields.map((y) => [y.context, y.amount])).deep.eq([['applied', 2]]);
  });
});
