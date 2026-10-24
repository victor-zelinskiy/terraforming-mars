import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {ReduxParty, REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';
import {politicalSources} from '@/client/console/parliament/politicalSources';
import {politicalEffectEntries} from '@/client/console/parliament/politicalEffects';
import {parliamentActionSources, dossierPoliticalActions} from '@/client/console/parliament/parliamentActionSources';
import {withPoliticalActionTiles} from '@/client/console/infoDossierModel';
import {isResolutionActionSource} from '@/client/console/consoleCardActions';

const FORESTRY_SUPPORT = 'RDX_GREENS_FORESTRY_SUPPORT';
const OPEN_IP_TRADE = 'RDX_SCIENTISTS_OPEN_IP_TRADE';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** A table: the given parties held (by the given road), an enacted law, one seat (or two). */
function table(opts: {held?: Partial<Record<ReduxParty, Partial<PartyAccessModel>>>, enacted?: string, participates?: boolean, rival?: boolean} = {}): ParliamentModel {
  const seat = (color: Color) => ({
    color,
    participates: opts.participates ?? true,
    access: REDUX_PARTIES.map((p) => access(p, opts.held?.[p] ?? {})),
    partyActionUses: {},
    resolutionActionUses: 0,
    influence: 0,
  });
  return {
    players: [seat('red'), ...(opts.rival === true ? [seat('blue')] : [])],
    slots: [],
    ...(opts.enacted === undefined ? {} : {enacted: {instance: `${opts.enacted}#0`, resolution: opts.enacted, party: PartyName.GREENS}}),
  } as unknown as ParliamentModel;
}

/**
 * «WHAT A SEAT HOLDS FROM THE PARLIAMENT» has ONE answer (Turmoil Redux «один фреймворк»): the explorer's groups,
 * «Действия карт», the galleries and the scene's summary read `politicalSources`, in decision Р1's order.
 */
describe('politicalSources — the one answer', () => {
  it('the ALLIANCE road (TR62): the held party names its partner, and the action plate carries it (the inner step reads the plate)', () => {
    const model = table({
      held: {
        [PartyName.MARS]: {ruling: true, hasEffect: true, alliances: [{partner: PartyName.REDS, source: 'Tharsis Alliance' as never}]},
        [PartyName.REDS]: {hasEffect: true, allied: [{via: PartyName.MARS, source: 'Tharsis Alliance' as never, road: 'ruling'}], alliances: [{partner: PartyName.MARS, source: 'Tharsis Alliance' as never}]},
      },
    });
    const reds = politicalSources(model, 'red').find((s) => s.party === PartyName.REDS);
    expect(reds?.road).eq('alliance');
    expect(reds?.allyVia).eq(PartyName.MARS);
    const action = parliamentActionSources({parliament: model, color: 'red', viewerColor: 'red', waitingFor: undefined})
      .find((s) => !isResolutionActionSource(s) && s.party === PartyName.REDS);
    expect(action !== undefined && !isResolutionActionSource(action) ? action.allyVia : undefined, 'the plate names the road').eq(PartyName.MARS);
  });

  it('the law first, then the RULING party, then the rest in the board\'s order; a party not held is absent', () => {
    const model = table({
      enacted: FORESTRY_SUPPORT,
      held: {
        [PartyName.SCIENTISTS]: {hasEffect: true, byDelegates: true, delegates: 2},
        [PartyName.REDS]: {hasEffect: true, ruling: true},
        [PartyName.MARS]: {hasEffect: false, delegates: 1},
      },
    });
    const sources = politicalSources(model, 'red');
    expect(sources.map((s) => s.source)).deep.eq([
      {kind: 'law', resolution: FORESTRY_SUPPORT},
      {kind: 'party', party: PartyName.REDS},
      {kind: 'party', party: PartyName.SCIENTISTS},
    ]);
    expect(sources.map((s) => s.road)).deep.eq(['law', 'ruling', 'delegates']);
    // Printed passive vs action is the manifest's (an empty passive builder is no effect).
    expect(sources.find((s) => s.party === PartyName.REDS)?.hasPassive).is.false;
    expect(sources.find((s) => s.party === PartyName.REDS)?.hasAction).is.true;
    expect(sources.find((s) => s.party === PartyName.SCIENTISTS)?.hasPassive).is.true;
  });

  it('a seat outside the enactment (MarsBot) holds nothing; no parliament, nothing', () => {
    expect(politicalSources(table({held: {[PartyName.GREENS]: {hasEffect: true, ruling: true}}, participates: false}), 'red')).deep.eq([]);
    expect(politicalSources(undefined, 'red')).deep.eq([]);
  });
});

describe('politicalEffectEntries — the explorer\'s political groups', () => {
  it('a party\'s PASSIVE becomes entries (the Greens print two blocks → two entries, one sentence each); an action-only party none', () => {
    const model = table({enacted: OPEN_IP_TRADE, held: {[PartyName.GREENS]: {hasEffect: true, ruling: true}, [PartyName.REDS]: {hasEffect: true, byDelegates: true, delegates: 2}}});
    // Open IP Trade is an ACTION law (no standing effect): only the parties' passives remain.
    const entries = politicalEffectEntries(politicalSources(model, 'red'), {parliament: model, viewerColor: 'red'});
    expect(entries.map((e) => e.key)).deep.eq(['party:Greens#0', 'party:Greens#1']);
    expect(entries.every((e) => e.effectNode !== undefined), 'the printed effect() blocks').is.true;
    expect(entries.map((e) => e.description)).deep.eq([
      '2 M€ per TR step you gain.',
      'Raising your plant or heat production raises your M€ production as many steps.',
    ]);
    expect(entries[0].title).eq('party name: Greens');
    expect(entries[0].access).deep.eq({key: 'You have it: the party rules', params: [], tone: 'holds'});
    // Generation 1's starting-rule Greens (no law enacted) read their own rule — the glossary's sentence.
    const start = table({held: {[PartyName.GREENS]: {hasEffect: true, ruling: true}}});
    expect(politicalEffectEntries(politicalSources(start, 'red'), {parliament: start})[0].access.key)
      .eq('You have it: the Greens rule by the starting rule while no resolution is enacted');
  });

  it('the access reading follows the ROAD (delegates; a card\'s grant names its source)', () => {
    const model = table({held: {
      [PartyName.SCIENTISTS]: {hasEffect: true, byDelegates: true, delegates: 2},
      [PartyName.MARS]: {hasEffect: true, granted: ['Septem Tribus']},
    }});
    const entries = politicalEffectEntries(politicalSources(model, 'red'), {parliament: model});
    expect(entries.find((e) => e.party === PartyName.SCIENTISTS)?.access.key).eq('You have it: two of your delegates are on its resolution');
    expect(entries.find((e) => e.party === PartyName.MARS)?.access).deep.eq({key: 'You have it: granted by ${0}', params: ['Septem Tribus'], tone: 'holds'});
  });

  it('the enacted law\'s STANDING part is one group led first, read «Доступен всем»', () => {
    const model = table({enacted: FORESTRY_SUPPORT});
    const entries = politicalEffectEntries(politicalSources(model, 'red'), {parliament: model});
    expect(entries.length).greaterThan(0);
    expect(entries.every((e) => e.source.kind === 'law')).is.true;
    expect(entries[0].access).deep.eq({key: 'Available to every player', params: [], tone: 'holds'});
  });
});

describe('parliamentActionSources — one builder for every host of the action tiles', () => {
  it('another seat\'s actions are FOREIGN (public uses only, never offered); the dossier joins them to the cards', () => {
    const model = table({rival: true, enacted: OPEN_IP_TRADE, held: {[PartyName.REDS]: {hasEffect: true, ruling: true}}});
    const sources = parliamentActionSources({parliament: model, color: 'blue', viewerColor: 'red'});
    expect(sources.map((s) => (isResolutionActionSource(s) ? s.resolution : s.party))).deep.eq([OPEN_IP_TRADE, PartyName.REDS]);
    expect(sources.every((s) => s.foreign === true && !s.offered)).is.true;
    const tiles = withPoliticalActionTiles([{name: 'Ants', state: 'idle'}], dossierPoliticalActions(sources));
    expect(tiles.map((t) => t.name)).deep.eq([`law:${OPEN_IP_TRADE}`, 'party:Reds', 'Ants']);
    expect(tiles.map((t) => t.state)).deep.eq(['idle', 'idle', 'idle']);
    expect(tiles[1].political).deep.eq({party: PartyName.REDS, title: 'party name: Reds'});
  });
});
