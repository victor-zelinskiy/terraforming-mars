import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel, PartyAccessModel, VoteProjectionModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {allResolutions, getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {ParliamentPartyVm, ParliamentSlotVm, voteForecastOf} from '@/client/console/parliament/consoleParliamentModel';
import {
  PARTY_MOMENT, SUFFIX_HINT, SUFFIX_IF_YOU_WIN, SUFFIX_STEP, READING_KICKER_SEATED, READING_KICKER_SPECTATOR, VOTE_INFO_LIMITS, VOTE_KICKER, voteFactsOf,
  voteInfoBudget, voteInfoOf, VoteInfoVm,
} from '@/client/console/parliament/voteInfoModel';
import ruParliament from '@/locales/ru/parliament.json';
import ruConsole from '@/locales/ru/console.json';
import ruUi from '@/locales/ru/ui.json';
import ruTurmoil from '@/locales/ru/turmoil.json';

/**
 * THE VOTE PANEL'S BUDGET GUARD (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §8 — «the
 * rule the overload cannot come back through»). For EVERY resolution the game
 * deals, at every influence a table can give the viewer, winning or not, on the
 * edge of the party effect or not, the panel under the cards is held to:
 *   · ONE reading (the estimate; the win's difference is its suffix, never a plate);
 *   · TWO facts — three on the edge this delegate crosses;
 *   · at most THREE kickers (it prints two);
 *   · at most 28 WORDS, counted in the language the player reads (the real RU
 *     dictionary), with every honest note included.
 * A failure names the resolution and what it exceeded — the worklist of the next
 * card. The never-dealt dev examples run apart, at the same ceilings, so the
 * dev stand cannot ship a composition the game would refuse.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const RU: Record<string, string> = {...ruTurmoil, ...ruUi, ...ruConsole, ...ruParliament} as Record<string, string>;
const interpolate = (text: string, params?: ReadonlyArray<string>): string =>
  (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), text);
const ru = (key: string, params?: ReadonlyArray<string>): string => interpolate(RU[key] ?? key, params);

/** The Agenda positions that give the four influence levels the guard walks (a level per position, no card bonus). */
const AGENDA_FOR_INFLUENCE: ReadonlyArray<[number, number]> = [[0, 0], [1, 1], [3, 2], [12, 5]];

/** A seat that can READ every declared term: a count for each counted term, a total for each sequel term. */
function seatFor(resolution: IClientResolution, agenda: number): ParliamentPlayerModel {
  const counts = (resolution.scaled ?? []).filter((e) => e.count !== undefined).map((e) => ({
    id: e.count!.id, count: 2, cards: [CardName.POWER_PLANT, CardName.ARTIFICIAL_LAKE], units: [1, 1],
  }));
  const production: Partial<Record<Resource, number>> = {};
  for (const e of resolution.scaled ?? []) {
    if (e.sequel?.total.kind === 'production') {
      production[e.sequel.total.resource] = 4;
    }
  }
  return {
    color: BLUE, participates: true, lobby: false, reserve: 5, onResolutions: 1, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts, production,
  };
}

function tableFor(resolution: IClientResolution, agenda: number, edge: boolean, winning: boolean): {model: ParliamentModel, slot: ParliamentSlotVm, party: ParliamentPartyVm, projection: VoteProjectionModel} {
  const instance = `${resolution.id}#0`;
  const mine = edge ? 1 : 0;
  const votes = [{owner: RED, seq: 1}, ...(mine > 0 ? [{owner: BLUE, seq: 2}] : [])];
  const projection: VoteProjectionModel = {
    instance, votesAfter: votes.length + 1, leaderAfter: winning ? BLUE : RED, viewerLeads: winning, becomesWinning: winning,
    unlocksEffect: edge, unlocksRequirement: edge,
  };
  const access: PartyAccessModel = {party: resolution.party, ruling: false, delegates: mine, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false};
  const seat = {...seatFor(resolution, agenda), access: [access]};
  const model: ParliamentModel = {
    slots: [{instance, resolution: resolution.id, party: resolution.party, votes, totalVotes: votes.length, leader: RED, isWinning: false, tiePriority: 1, viewerVotes: mine}],
    rulingParty: PartyName.GREENS, popularSupport: {}, players: [seat], deckSize: 3, discardSize: 0, neutralSupply: 10, botMode: 'none',
    viewer: {vote: {available: true, reason: '', source: 'reserve', cost: 5, projections: [projection]}, partyActions: []},
  };
  const slot: ParliamentSlotVm = {
    instance, resolutionId: resolution.id, resolution, party: resolution.party, votes, totalVotes: votes.length, leader: RED, leaderVotes: 1,
    isWinning: false, tiePriority: 1, viewerVotes: mine, projection,
  };
  const party: ParliamentPartyVm = {
    party: resolution.party, effect: getPartyEffect(resolution.party), rule: undefined, support: 0, inArea: true, ruling: false, access, actionId: undefined, action: undefined,
  };
  return {model, slot, party, projection};
}

function panelFor(resolution: IClientResolution, agenda: number, edge: boolean, winning: boolean, viewer: Color | undefined = BLUE): VoteInfoVm {
  const {model, slot, party} = tableFor(resolution, agenda, edge, winning);
  const mineBefore = slot.viewerVotes;
  const facts = voteFactsOf({
    slot, party, viewer, forecast: voteForecastOf(slot, viewer, model.viewer?.vote), snapshot: undefined, landed: false,
    mineBefore, mineAfter: mineBefore + 1, nameOf: (c) => c,
  });
  return voteInfoOf({
    slot, resolution, model, viewer, tableau: [], name: resolution.text.name, winning: false,
    source: 'reserve', cost: 5, facts, numbers: {votesBefore: slot.totalVotes, votesAfter: slot.totalVotes + 1, mineBefore, mineAfter: mineBefore + 1},
  });
}

type Offence = string;

function offencesOf(resolution: IClientResolution, opts: {dealt: boolean}): Array<Offence> {
  const out: Array<Offence> = [];
  for (const [agenda, influence] of AGENDA_FOR_INFLUENCE) {
    for (const winning of [true, false]) {
      for (const edge of [true, false]) {
        const vm = panelFor(resolution, agenda, edge, winning);
        const b = voteInfoBudget(vm, ru);
        const where = `${resolution.text.name} (${resolution.code ?? resolution.id}) @ influence ${influence}${winning ? ', winning' : ''}${edge ? ', on the edge' : ''}`;
        if (opts.dealt ? b.readings !== VOTE_INFO_LIMITS.readings : b.readings > VOTE_INFO_LIMITS.readings) {
          out.push(`${where}: readings ${b.readings} (must be ${opts.dealt ? '' : '≤ '}${VOTE_INFO_LIMITS.readings})`);
        }
        if (vm.reading.yields.some((y) => y.context === 'forecast')) {
          out.push(`${where}: a forecast PLATE on the panel — the win's difference is a suffix`);
        }
        const factLimit = edge ? VOTE_INFO_LIMITS.factsOnEdge : VOTE_INFO_LIMITS.facts;
        if (b.facts > factLimit) {
          out.push(`${where}: facts ${b.facts} (≤ ${factLimit})`);
        }
        if (b.kickers > VOTE_INFO_LIMITS.kickers) {
          out.push(`${where}: kickers ${b.kickers} (≤ ${VOTE_INFO_LIMITS.kickers})`);
        }
        if (b.words > VOTE_INFO_LIMITS.words) {
          out.push(`${where}: words ${b.words} (≤ ${VOTE_INFO_LIMITS.words})`);
        }
        if (b.moment > VOTE_INFO_LIMITS.momentWords) {
          out.push(`${where}: the party box's line of moment ${b.moment} words (≤ ${VOTE_INFO_LIMITS.momentWords})`);
        }
      }
    }
  }
  return out;
}

describe('voteInfoBudget — the vote panel never overloads again', () => {
  const dealt = allResolutions().filter((r) => r.copies > 0);
  const dev = allResolutions().filter((r) => r.copies === 0);

  it('the catalog deals at least the five shipped resolutions (anti-vacuity)', () => {
    expect(dealt.map((r) => r.code).sort()).to.include.members(['RX01', 'RX02', 'RX03', 'RX04', 'RX05']);
  });

  it('every DEALT resolution × influence {0, 1, 2, 5} × winning × edge fits the panel', () => {
    const offences = dealt.flatMap((r) => offencesOf(r, {dealt: true}));
    expect(offences, 'the vote panel budget (docs/TURMOIL_REDUX_PARLIAMENT_VOTE_ONE_NUMBER.md):\n' + offences.join('\n')).to.deep.eq([]);
  });

  it('every never-dealt DEV example fits the same ceilings (a stand composition the game would refuse never ships)', () => {
    const offences = dev.flatMap((r) => offencesOf(r, {dealt: false}));
    expect(offences, 'the vote panel budget (dev examples):\n' + offences.join('\n')).to.deep.eq([]);
  });

  it('the words are counted in the language the player reads — every key the panel prints has its RU line', () => {
    const keys = [READING_KICKER_SEATED, READING_KICKER_SPECTATOR, VOTE_KICKER, PARTY_MOMENT, SUFFIX_IF_YOU_WIN, SUFFIX_STEP, SUFFIX_HINT,
      'from the lobby · free', 'from the reserve', 'Leader', 'Winning', 'Party effect', 'effect is yours', '${0} of ${1}', 'yes', 'no', 'you',
      'no leader yet', 'the neutral player', 'you (earlier delegate)', 'No card can hold animals', 'No card can hold this resource'];
    const missing = keys.filter((k) => RU[k] === undefined);
    expect(missing, 'untranslated panel keys').to.deep.eq([]);
  });

  it('a spectator\'s panel counts no reading and no fact of its own — the graphic alone', () => {
    const climate = dealt.find((r) => r.code === 'RX05')!;
    const vm = panelFor(climate, 3, false, false, RED);
    expect(vm.reading.kicker).to.eq(READING_KICKER_SPECTATOR);
    const b = voteInfoBudget(vm, ru);
    expect(b.readings).to.eq(0);
    expect(b.words).to.be.at.most(VOTE_INFO_LIMITS.words);
  });

  it('the panel speaks the glossary — a RESOLUTION «принимается», the player «если победите», the effect «ваш» (ПОЛИРОВКА)', () => {
    // No `\b`: JS word boundaries are ASCII-only and never fire beside a Cyrillic letter.
    const banned = [/побежда/i, /при победе/i, /ваш эффект/i, /победивший игрок/i];
    const keys = [SUFFIX_IF_YOU_WIN, SUFFIX_HINT, 'Winning', 'effect is yours', 'Leader', VOTE_KICKER, READING_KICKER_SEATED];
    const hits = keys.flatMap((k) => banned.filter((b) => b.test(ru(k))).map((b) => `${k}: «${ru(k)}» matches ${b}`));
    expect(hits, 'retired forms in the panel\'s RU lines').to.deep.eq([]);
    expect(ru('Winning')).to.eq('Принимается');
    expect(ru(SUFFIX_IF_YOU_WIN)).to.eq('если победите');
  });
});
